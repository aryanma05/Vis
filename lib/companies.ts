import "server-only";

import { cache } from "react";
import { and, asc, count, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cancelAllSubscriptions, getCompanyPlan } from "@/lib/billing";
import { log } from "@/lib/log";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { company, companyMember, job, user } = schema;

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
  const openJobs = sql<number>`(select count(*)::int from ${job} where ${job.companyId} = ${company.id} and ${job.status} = 'published' and (${job.deadline} is null or ${job.deadline} >= current_date))`;
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
