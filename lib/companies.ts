import "server-only";

import { cache } from "react";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cancelAllSubscriptions, getCompanyPlan } from "@/lib/billing";
import { log } from "@/lib/log";
import { notify } from "@/lib/notifications";
import { getProjectCardsByOwners, isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";

const { company, companyEmployee, companyMember, job, profile, project, projectTag, tag, user } = schema;

export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"] as const;
export const MAX_COMPANIES_PER_USER = 5;
export const MAX_MEMBERS = 25;

export type CompanyRole = "owner" | "admin" | "member";
export type CompanyInput = {
  name: string;
  slug?: string;
  website?: string | null;
  about?: string | null;
  location?: string | null;
  size?: string | null;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function cleanInput(input: CompanyInput) {
  const name = input.name?.trim().slice(0, 80) ?? "";
  if (name.length < 2) throw new UserFacingError("Bedriften må ha et navn.");
  let website = input.website?.trim() || null;
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    if (!URL.canParse(website)) throw new UserFacingError("Nettsiden ser ikke riktig ut.");
  }
  const size = input.size && (COMPANY_SIZES as readonly string[]).includes(input.size) ? input.size : null;
  return {
    name,
    website,
    about: input.about?.trim().slice(0, 5000) || null,
    location: input.location?.trim().slice(0, 100) || null,
    size,
  };
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "bedrift";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [taken] = await db.select({ id: company.id }).from(company).where(eq(company.slug, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createCompany(userId: string, input: CompanyInput) {
  const fields = cleanInput(input);
  const [{ n }] = await db.select({ n: count() }).from(companyMember).where(and(eq(companyMember.userId, userId), eq(companyMember.role, "owner")));
  if (n >= MAX_COMPANIES_PER_USER) throw new UserFacingError("Du kan eie opptil {n} bedrifter.", { n: MAX_COMPANIES_PER_USER });
  const slug = await uniqueSlug(input.slug || fields.name);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(company).values({ ...fields, slug, createdById: userId }).returning({ id: company.id, slug: company.slug });
    await tx.insert(companyMember).values({ companyId: row.id, userId, role: "owner" });
    log.info("company.create", { userId, companyId: row.id });
    return row;
  });
}

export async function updateCompany(userId: string, companyId: string, input: CompanyInput) {
  await requireCompanyRole(userId, companyId, ["owner", "admin"]);
  await db.update(company).set(cleanInput(input)).where(eq(company.id, companyId));
}

export async function setCompanyLogo(userId: string, companyId: string, url: string | null) {
  await requireCompanyRole(userId, companyId, ["owner", "admin"]);
  await db.update(company).set({ logoUrl: url }).where(eq(company.id, companyId));
}

export async function deleteCompany(userId: string, companyId: string) {
  await requireCompanyRole(userId, companyId, ["owner"]);
  await cancelAllSubscriptions("company", companyId);
  await db.delete(company).where(eq(company.id, companyId));
  log.info("company.delete", { userId, companyId });
}

// Før en konto slettes: bedrifter der personen er eneste eier får en ny eier (en admin, ellers
// det eldste medlemmet). Er personen eneste medlem, slettes bedriften og abonnementet avsluttes.
export async function releaseCompaniesOf(userId: string) {
  const owned = await db
    .select({ companyId: companyMember.companyId })
    .from(companyMember)
    .where(and(eq(companyMember.userId, userId), eq(companyMember.role, "owner")));
  for (const { companyId } of owned) {
    const others = await db
      .select({ userId: companyMember.userId, role: companyMember.role })
      .from(companyMember)
      .where(and(eq(companyMember.companyId, companyId), sql`${companyMember.userId} <> ${userId}`))
      .orderBy(sql`case ${companyMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(companyMember.createdAt));
    if (others.length === 0) {
      await cancelAllSubscriptions("company", companyId);
      await db.delete(company).where(eq(company.id, companyId));
      log.info("company.delete-with-owner", { userId, companyId });
    } else if (others[0].role !== "owner") {
      await db
        .update(companyMember)
        .set({ role: "owner" })
        .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, others[0].userId)));
      log.info("company.owner-handover", { from: userId, to: others[0].userId, companyId });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Tilgang                                                                   */
/* -------------------------------------------------------------------------- */

export const getMembership = cache(async (userId: string | null | undefined, companyId: string) => {
  if (!userId || !isUuid(companyId)) return null;
  const [row] = await db
    .select({ role: companyMember.role })
    .from(companyMember)
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
    .limit(1);
  return row?.role ?? null;
});

export async function requireCompanyRole(userId: string, companyId: string, roles: CompanyRole[] = ["owner", "admin", "member"]) {
  const role = await getMembership(userId, companyId);
  if (!role || !roles.includes(role)) throw new UserFacingError("Du har ikke tilgang til denne bedriften.");
  return role;
}

// Bedrift-planen kreves for kandidatsøk, lister og å kontakte kandidater.
export async function requireBusiness(companyId: string) {
  if ((await getCompanyPlan(companyId)).plan !== "business") {
    throw new UserFacingError("Dette krever Bedrift-abonnementet.");
  }
}

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

export const getCompanyBySlug = cache(async (slug: string) => {
  const [row] = await db.select().from(company).where(eq(company.slug, slug.toLowerCase())).limit(1);
  return row ?? null;
});

export async function getCompanyById(id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(company).where(eq(company.id, id)).limit(1);
  return row ?? null;
}

export async function listMyCompanies(userId: string) {
  return db
    .select({ id: company.id, slug: company.slug, name: company.name, logoUrl: company.logoUrl, role: companyMember.role, verifiedAt: company.verifiedAt })
    .from(companyMember)
    .innerJoin(company, eq(company.id, companyMember.companyId))
    .where(eq(companyMember.userId, userId))
    .orderBy(asc(company.name));
}

export async function listCompanyMembers(companyId: string) {
  return db
    .select({ userId: user.id, name: user.name, username: user.username, image: user.image, role: companyMember.role })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(eq(companyMember.companyId, companyId))
    .orderBy(asc(companyMember.createdAt));
}

// Bedriftskatalogen: bekreftede først, så de med flest åpne stillinger.
export async function listCompanies({ q = "", limit = 60 }: { q?: string; limit?: number } = {}) {
  const like = `%${q.trim().replace(/[%_]/g, "")}%`;
  // outer(): spørringen leser bare company, så Drizzle dropper tabellnavnet, og «id» pekte på job.id.
  const openJobs = sql<number>`(select count(*)::int from ${job} where ${job.companyId} = ${outer(company.id)} and ${job.status} = 'published' and (${job.deadline} is null or ${job.deadline} >= current_date))`;
  return db
    .select({ id: company.id, slug: company.slug, name: company.name, logoUrl: company.logoUrl, location: company.location, verifiedAt: company.verifiedAt, openJobs })
    .from(company)
    .where(q.trim() ? or(ilike(company.name, like), ilike(company.location, like)) : undefined)
    .orderBy(desc(isNotNull(company.verifiedAt)), desc(openJobs), asc(company.name))
    .limit(limit);
}

/* -------------------------------------------------------------------------- */
/*  Medlemmer                                                                 */
/* -------------------------------------------------------------------------- */

export async function addCompanyMember(actorId: string, companyId: string, username: string, role: "admin" | "member") {
  await requireCompanyRole(actorId, companyId, ["owner", "admin"]);
  const [target] = await db
    .select({ id: user.id, banned: user.banned })
    .from(user)
    .where(eq(user.username, username.replace(/^@/, "").trim().toLowerCase()))
    .limit(1);
  if (!target || target.banned) throw new UserFacingError("Fant ingen med det brukernavnet.");
  const [{ n }] = await db.select({ n: count() }).from(companyMember).where(eq(companyMember.companyId, companyId));
  if (n >= MAX_MEMBERS) throw new UserFacingError("En bedrift kan ha opptil {n} medlemmer.", { n: MAX_MEMBERS });
  const inserted = await db.insert(companyMember).values({ companyId, userId: target.id, role }).onConflictDoNothing().returning();
  if (inserted.length === 0) throw new UserFacingError("Personen er allerede med.");
  log.info("company.member-add", { actorId, companyId, userId: target.id, role });
}

export async function removeCompanyMember(actorId: string, companyId: string, userId: string) {
  const actorRole = await requireCompanyRole(actorId, companyId, ["owner", "admin"]);
  const targetRole = await getMembership(userId, companyId);
  if (!targetRole) return;
  if (targetRole === "owner") throw new UserFacingError("Eieren kan ikke fjernes.");
  if (targetRole === "admin" && actorRole !== "owner" && actorId !== userId) throw new UserFacingError("Bare eieren kan fjerne en administrator.");
  await db.delete(companyMember).where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)));
}

/* -------------------------------------------------------------------------- */
/*  Admin                                                                     */
/* -------------------------------------------------------------------------- */

export async function setCompanyVerified(adminId: string, companyId: string, verified: boolean) {
  await db.update(company).set({ verifiedAt: verified ? new Date() : null }).where(eq(company.id, companyId));
  log.info("admin.company-verify", { adminId, companyId, verified });
}

/* -------------------------------------------------------------------------- */
/*  Teamet på bedriftssiden                                                   */
/* -------------------------------------------------------------------------- */

// Folk som jobber i bedriften vises på bedriftssiden med prosjektene sine. Utviklere stoler
// mer på kollegaer enn på reklame, og bedriften får en levende side uten å skrive noe selv.
// Å stå i teamet gir ingen tilgang til å administrere bedriften (det er medlemmer).

export const MAX_EMPLOYEES = 300;

export async function addEmployee(actorId: string, companyId: string, username: string, title?: string | null) {
  await requireCompanyRole(actorId, companyId, ["owner", "admin"]);
  const [target] = await db
    .select({ id: user.id, banned: user.banned })
    .from(user)
    .where(eq(user.username, username.replace(/^@/, "").trim().toLowerCase()))
    .limit(1);
  if (!target || target.banned) throw new UserFacingError("Fant ingen med det brukernavnet.");
  const [{ n }] = await db.select({ n: count() }).from(companyEmployee).where(eq(companyEmployee.companyId, companyId));
  if (n >= MAX_EMPLOYEES) throw new UserFacingError("Et team kan ha opptil {n} personer.", { n: MAX_EMPLOYEES });
  const inserted = await db
    .insert(companyEmployee)
    .values({ companyId, userId: target.id, title: title?.trim().slice(0, 80) || null })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) throw new UserFacingError("Personen er allerede i teamet.");
  const [co] = await db.select({ name: company.name, slug: company.slug }).from(company).where(eq(company.id, companyId)).limit(1);
  // Personen får vite det, og kan fjerne seg selv fra bedriftssiden.
  await notify({ userId: target.id, actorId, type: "employee", data: { companyName: co?.name, companySlug: co?.slug } });
  log.info("company.employee-add", { actorId, companyId, userId: target.id });
}

// Administratorer kan fjerne folk fra teamet, og alle kan fjerne seg selv.
export async function removeEmployee(actorId: string, companyId: string, userId: string) {
  if (actorId !== userId) await requireCompanyRole(actorId, companyId, ["owner", "admin"]);
  await db.delete(companyEmployee).where(and(eq(companyEmployee.companyId, companyId), eq(companyEmployee.userId, userId)));
}

export async function isEmployee(userId: string | null | undefined, companyId: string) {
  if (!userId) return false;
  const [row] = await db
    .select({ userId: companyEmployee.userId })
    .from(companyEmployee)
    .where(and(eq(companyEmployee.companyId, companyId), eq(companyEmployee.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export type TeamMember = { userId: string; name: string; username: string; image: string | null; headline: string | null; title: string | null; admin: boolean };

// Teamet: de som er lagt til i teamet, pluss medlemmene (administratorene).
export async function listTeam(companyId: string): Promise<TeamMember[]> {
  const [employees, members] = await Promise.all([
    db
      .select({ userId: user.id, name: user.name, username: user.username, image: user.image, headline: profile.headline, title: companyEmployee.title })
      .from(companyEmployee)
      .innerJoin(user, eq(user.id, companyEmployee.userId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(and(eq(companyEmployee.companyId, companyId), sql`coalesce(${user.banned}, false) = false`))
      .orderBy(asc(companyEmployee.createdAt)),
    db
      .select({ userId: user.id, name: user.name, username: user.username, image: user.image, headline: profile.headline })
      .from(companyMember)
      .innerJoin(user, eq(user.id, companyMember.userId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(and(eq(companyMember.companyId, companyId), sql`coalesce(${user.banned}, false) = false`))
      .orderBy(asc(companyMember.createdAt)),
  ]);
  const seen = new Set(employees.map((e) => e.userId));
  return [
    ...employees.map((e) => ({ ...e, admin: false })),
    ...members.filter((m) => !seen.has(m.userId)).map((m) => ({ ...m, title: null, admin: true })),
  ];
}

export async function getTeamProjects(team: TeamMember[], limit = 6) {
  return getProjectCardsByOwners(team.map((m) => m.userId), limit);
}

// «Verktøy vi bruker»: teknologiene i teamets prosjekter og i stillingene, flest først.
export async function getTeamTools(companyId: string, team: TeamMember[], limit = 16) {
  const ids = team.map((m) => m.userId);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const rows = await db
      .select({ name: tag.name, n: count() })
      .from(projectTag)
      .innerJoin(project, eq(project.id, projectTag.projectId))
      .innerJoin(tag, eq(tag.id, projectTag.tagId))
      .where(and(inArray(project.ownerId, ids), eq(project.status, "published"), sql`${project.removedAt} is null`))
      .groupBy(tag.name);
    for (const r of rows) counts.set(r.name, Number(r.n));
  }
  const jobs = await db.select({ tags: job.tags }).from(job).where(and(eq(job.companyId, companyId), eq(job.status, "published")));
  for (const j of jobs) for (const t of j.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb"))
    .slice(0, limit)
    .map(([name, n]) => ({ name, n }));
}
