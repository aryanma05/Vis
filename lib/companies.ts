import "server-only";

import { cache } from "react";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NotificationData } from "@/db/schema";
import { audit } from "@/lib/audit";
import { cancelAllSubscriptions, getCompanyPlan } from "@/lib/billing";
import { COMPANY_TERMS_VERSION, requireCompanyPermission } from "@/lib/company-access";
import { COMPANY_SIZES } from "@/lib/company-labels";
import { assignableRoles, can, canManageMember, COMPANY_ROLES, type CompanyRole } from "@/lib/company-permissions";
import { assertNameAvailable } from "@/lib/company-verification";
import type { Tx } from "@/lib/db-types";
import { later } from "@/lib/later";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { notify } from "@/lib/notifications";
import { getProjectCardsByOwners, isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";
import { disableWebhooksCreatedBy } from "@/lib/webhooks";

const { company, companyEmployee, companyInvite, companyMember, job, jobApplication, notification, profile, project, projectTag, tag, user } = schema;

export const MAX_COMPANIES_PER_USER = 5;
export const MAX_MEMBERS = 25;

export type { CompanyRole };
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

const canEmail = () => emailProviderConfigured || process.env.NODE_ENV !== "production";

// Den som lager siden må ha bekreftet e-posten og godta databehandleravtalen (vilkår § 6).
// Navnet kan ikke ligne på en bekreftet bedrift. Eieren vises i teamet med en gang.
export async function createCompany(userId: string, input: CompanyInput & { acceptTerms?: boolean }) {
  if (input.acceptTerms !== true) throw new UserFacingError("Godta databehandleravtalen for å lage bedriftssiden.");
  const fields = cleanInput(input);
  const [me] = await db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
  if (!me?.emailVerified) throw new UserFacingError("Bekreft e-postadressen din før du lager en bedriftsside.");
  const [{ n }] = await db.select({ n: count() }).from(companyMember).where(and(eq(companyMember.userId, userId), eq(companyMember.role, "owner")));
  if (n >= MAX_COMPANIES_PER_USER) throw new UserFacingError("Du kan eie opptil {n} bedrifter.", { n: MAX_COMPANIES_PER_USER });
  await assertNameAvailable(fields.name);
  await enforce("companyCreate", userId);
  const slug = await uniqueSlug(input.slug || fields.name);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(company)
      .values({ ...fields, slug, createdById: userId, termsAcceptedAt: new Date(), termsAcceptedById: userId, termsVersion: COMPANY_TERMS_VERSION })
      .returning({ id: company.id, slug: company.slug });
    await tx.insert(companyMember).values({ companyId: row.id, userId, role: "owner", showOnPage: true });
    await audit({ companyId: row.id, actorId: userId, action: "company.terms_accepted", targetType: "company", targetId: row.id, meta: { version: COMPANY_TERMS_VERSION } }, tx);
    log.info("company.create", { userId, companyId: row.id });
    return row;
  });
}

// Nytt navn eller ny nettside fjerner bekreftelsen, så ingen kan bekrefte «Fjordkode» og
// så kalle seg noe annet.
export async function updateCompany(userId: string, companyId: string, input: CompanyInput) {
  await requireCompanyPermission(userId, companyId, "company.edit");
  const fields = cleanInput(input);
  const [current] = await db.select({ name: company.name, website: company.website, verifiedAt: company.verifiedAt }).from(company).where(eq(company.id, companyId)).limit(1);
  if (!current) throw new UserFacingError("Fant ikke bedriften.");
  const nameChanged = fields.name !== current.name;
  const websiteChanged = (fields.website ?? null) !== (current.website ?? null);
  if (nameChanged) await assertNameAvailable(fields.name, companyId);
  const reset = current.verifiedAt !== null && (nameChanged || websiteChanged);
  await db.transaction(async (tx) => {
    await tx
      .update(company)
      .set({ ...fields, ...(reset ? { verifiedAt: null, verifiedDomain: null } : {}) })
      .where(eq(company.id, companyId));
    if (reset) {
      await audit({ companyId, actorId: userId, action: "company.verification_reset", targetType: "company", targetId: companyId, meta: { name: nameChanged, website: websiteChanged } }, tx);
    }
  });
  await audit({ companyId, actorId: userId, action: "company.updated", targetType: "company", targetId: companyId, meta: { name: nameChanged, website: websiteChanged } });
  return { verificationReset: reset };
}

export async function setCompanyLogo(userId: string, companyId: string, url: string | null) {
  await requireCompanyPermission(userId, companyId, "company.edit");
  await db.update(company).set({ logoUrl: url }).where(eq(company.id, companyId));
  await audit({ companyId, actorId: userId, action: "company.updated", targetType: "company", targetId: companyId, meta: { logo: url !== null } });
}

// Varsler kandidater med åpne søknader (Ny, Intervju, Tilbud) om at stillingen er borte, før
// søknadene slettes sammen med bedriften. Uten actorId er kandidaten selv avsender: varselet
// vises med bedriftens navn (app/varsler), og en slettet konto ville tatt varselet med seg.
async function noticeOpenApplications(tx: Tx, companyId: string, actorId: string | null) {
  const rows = await tx
    .select({
      userId: jobApplication.userId,
      jobId: job.id,
      jobTitle: job.title,
      companyName: company.name,
      companySlug: company.slug,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(company, eq(company.id, job.companyId))
    .innerJoin(user, eq(user.id, jobApplication.userId))
    .where(and(eq(job.companyId, companyId), inArray(jobApplication.status, ["ny", "intervju", "tilbud"])));
  if (rows.length === 0) return [];
  await tx.insert(notification).values(
    rows.map((r) => ({
      userId: r.userId,
      actorId: actorId ?? r.userId,
      type: "application" as const,
      data: { event: "job_closed", jobId: r.jobId, jobTitle: r.jobTitle, companyName: r.companyName, companySlug: r.companySlug } satisfies NotificationData,
    })),
  );
  return rows;
}

function emailClosedApplications(rows: Awaited<ReturnType<typeof noticeOpenApplications>>) {
  if (rows.length === 0 || !canEmail()) return;
  later(() => {
    for (const r of rows) {
      if (!r.emailVerified) continue;
      sendEmailInBackground(
        notificationEmail({
          to: r.email,
          subject: `Søknaden din hos ${r.companyName} er avsluttet`,
          heading: `«${r.jobTitle}» er avsluttet`,
          intro: `${r.companyName} har slettet bedriftssiden sin på Vis, så søknaden din på ${r.jobTitle} er avsluttet. Søknaden og det bedriften skrev om den er slettet.`,
          path: "/soknader",
          button: "Se søknadene dine",
        }),
      );
    }
  });
}

export async function deleteCompany(userId: string, companyId: string) {
  await requireCompanyPermission(userId, companyId, "company.delete");
  await cancelAllSubscriptions("company", companyId);
  const closed = await db.transaction(async (tx) => {
    const rows = await noticeOpenApplications(tx, companyId, userId);
    await tx.delete(company).where(eq(company.id, companyId));
    return rows;
  });
  emailClosedApplications(closed);
  log.info("company.delete", { userId, companyId, candidatesNotified: closed.length });
}

// Varsel fra bedriften når personen som gjorde det ikke lenger finnes (se noticeOpenApplications).
async function companyNotice(tx: Tx, userId: string, data: NotificationData) {
  await tx.insert(notification).values({ userId, actorId: userId, type: "company_access", data });
}

// Før en konto slettes: bedrifter der personen er eneste eier får en ny eier, først den eldste
// administratoren, så den eldste rekruttereren, aldri en vurderer. Er det ingen som kan overta,
// avsluttes abonnementet og bedriften slettes, og de som var igjen får beskjed.
export async function releaseCompaniesOf(userId: string) {
  const owned = await db
    .select({ companyId: companyMember.companyId, name: company.name, slug: company.slug })
    .from(companyMember)
    .innerJoin(company, eq(company.id, companyMember.companyId))
    .where(and(eq(companyMember.userId, userId), eq(companyMember.role, "owner")));
  for (const co of owned) {
    const others = await db
      .select({ userId: companyMember.userId, role: companyMember.role, email: user.email, emailVerified: user.emailVerified })
      .from(companyMember)
      .innerJoin(user, eq(user.id, companyMember.userId))
      .where(and(eq(companyMember.companyId, co.companyId), ne(companyMember.userId, userId)))
      .orderBy(sql`case ${companyMember.role} when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end`, asc(companyMember.createdAt));
    if (others.some((o) => o.role === "owner")) continue;
    const heir = others.find((o) => o.role === "admin" || o.role === "member");
    const data = { companyName: co.name, companySlug: co.slug };

    if (heir) {
      await db.transaction(async (tx) => {
        await tx.update(companyMember).set({ role: "owner" }).where(and(eq(companyMember.companyId, co.companyId), eq(companyMember.userId, heir.userId)));
        await audit({ companyId: co.companyId, actorId: null, action: "owner.transferred", targetType: "user", targetId: heir.userId, subjectUserId: heir.userId, meta: { from: heir.role, accountDeleted: true } }, tx);
        await companyNotice(tx, heir.userId, { ...data, event: "ownership", role: "owner" });
      });
      if (heir.emailVerified && canEmail()) {
        sendEmailInBackground(
          notificationEmail({
            to: heir.email,
            subject: `Du er nå eier av ${co.name} på Vis`,
            heading: `Du er nå eier av ${co.name}`,
            intro: `Eieren av ${co.name} har slettet kontoen sin, så du har overtatt bedriftssiden. Som eier bestemmer du hvem som har tilgang, abonnementet og om bedriften skal slettes.`,
            path: `/bedrift/${co.slug}/admin?fane=medlemmer`,
            button: "Åpne Team og tilgang",
          }),
        );
      }
      log.info("company.owner-handover", { from: userId, to: heir.userId, companyId: co.companyId });
      continue;
    }

    await cancelAllSubscriptions("company", co.companyId);
    const closed = await db.transaction(async (tx) => {
      for (const o of others) await companyNotice(tx, o.userId, { ...data, event: "removed" });
      const rows = await noticeOpenApplications(tx, co.companyId, null);
      await tx.delete(company).where(eq(company.id, co.companyId));
      return rows;
    });
    emailClosedApplications(closed);
    if (canEmail()) {
      for (const o of others) {
        if (!o.emailVerified) continue;
        sendEmailInBackground(
          notificationEmail({
            to: o.email,
            subject: `${co.name} er slettet fra Vis`,
            heading: `Du har ikke lenger tilgang til ${co.name}`,
            intro: `Eieren av ${co.name} har slettet kontoen sin, og ingen med rett til å overta var igjen. Bedriftssiden, stillingene og søknadene er derfor slettet.`,
            path: "/bedrifter",
            button: "Se bedrifter på Vis",
          }),
        );
      }
    }
    log.info("company.delete-with-owner", { userId, companyId: co.companyId, remaining: others.length });
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

// UTGÅR: bruk requireCompanyPermission (lib/company-access.ts). Står til alle har byttet.
export async function requireCompanyRole(userId: string, companyId: string, roles: readonly CompanyRole[] = COMPANY_ROLES) {
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

export type CompanyMemberRow = Awaited<ReturnType<typeof listCompanyMembers>>[number];

// Alle med tilgang, eieren først. Om de har tofaktor ser bare eier og administratorer.
export async function listCompanyMembers(viewerId: string, companyId: string) {
  const viewerRole = await requireCompanyPermission(viewerId, companyId, "members.view");
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      role: companyMember.role,
      showOnPage: companyMember.showOnPage,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: companyMember.createdAt,
    })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(eq(companyMember.companyId, companyId))
    .orderBy(sql`case ${companyMember.role} when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end`, asc(companyMember.createdAt));
  const managers = can(viewerRole, "members.manage");
  return rows.map((r) => ({ ...r, twoFactorEnabled: managers ? Boolean(r.twoFactorEnabled) : null }));
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

// Man kommer bare inn med en godtatt invitasjon (lib/company-invites.ts), eller ved å lage bedriften.

// Invitasjoner personen har sendt og som venter, trekkes tilbake når personen mister retten til
// å invitere. Ventende eierskap til personen likeså.
async function revokeInvitesOf(tx: Tx, companyId: string, userId: string) {
  const rows = await tx
    .update(companyInvite)
    .set({ status: "revoked", respondedAt: new Date() })
    .where(
      and(
        eq(companyInvite.companyId, companyId),
        eq(companyInvite.status, "pending"),
        or(eq(companyInvite.invitedById, userId), and(eq(companyInvite.invitedUserId, userId), eq(companyInvite.kind, "owner"))),
      ),
    )
    .returning({ id: companyInvite.id });
  return rows.length;
}

async function companyName(companyId: string) {
  const [co] = await db.select({ name: company.name, slug: company.slug }).from(company).where(eq(company.id, companyId)).limit(1);
  if (!co) throw new UserFacingError("Fant ikke bedriften.");
  return co;
}

export async function removeCompanyMember(actorId: string, companyId: string, userId: string) {
  if (actorId === userId) return leaveCompany(userId, companyId);
  const actorRole = await requireCompanyPermission(actorId, companyId, "members.manage");
  const targetRole = await getMembership(userId, companyId);
  if (!targetRole) throw new UserFacingError("Personen er ikke med i bedriften.");
  if (!canManageMember(actorRole, targetRole, false)) {
    const isOwner = targetRole === "owner";
    throw new UserFacingError(isOwner ? "Eieren kan ikke fjernes." : "Bare eieren kan fjerne en administrator.");
  }
  const co = await companyName(companyId);
  const removed = await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(companyMember)
      .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
      .returning({ userId: companyMember.userId });
    if (deleted.length === 0) return false;
    const invitesRevoked = await revokeInvitesOf(tx, companyId, userId);
    await audit({ companyId, actorId, action: "member.removed", targetType: "user", targetId: userId, subjectUserId: userId, meta: { role: targetRole, invitesRevoked } }, tx);
    await notify({ userId, actorId, type: "company_access", data: { event: "removed", companyName: co.name, companySlug: co.slug } }, tx);
    return true;
  });
  if (!removed) return;
  await disableWebhooksCreatedBy(companyId, userId);
  log.info("company.member-remove", { actorId, companyId, userId });

  later(async () => {
    const [target] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, userId)).limit(1);
    if (!target?.emailVerified || !canEmail()) return;
    sendEmailInBackground(
      notificationEmail({
        to: target.email,
        subject: `Du har ikke lenger tilgang til ${co.name}`,
        heading: `Du har ikke lenger tilgang til ${co.name}`,
        intro: `Tilgangen din til administrasjonen av ${co.name} på Vis er fjernet. Du ser ikke lenger stillinger, søkere eller lister der. Profilen din på Vis er ikke endret.`,
        path: `/bedrift/${co.slug}`,
        button: "Se bedriftssiden",
      }),
    );
  });
}

// Eieren gir hvem som helst unntatt eier; administratorer gir rekrutterer og vurderer.
export async function changeMemberRole(actorId: string, companyId: string, userId: string, role: CompanyRole) {
  const actorRole = await requireCompanyPermission(actorId, companyId, "members.manage");
  if (!(COMPANY_ROLES as readonly string[]).includes(role)) throw new UserFacingError("Velg en rolle.");
  if (!assignableRoles(actorRole).includes(role)) {
    const toAdmin = role === "admin";
    throw new UserFacingError(toAdmin ? "Bare eieren kan gi administratortilgang." : "Rollen din gir ikke tilgang til dette.");
  }
  const targetRole = await getMembership(userId, companyId);
  if (!targetRole) throw new UserFacingError("Personen er ikke med i bedriften.");
  if (!canManageMember(actorRole, targetRole, actorId === userId)) throw new UserFacingError("Rollen din gir ikke tilgang til dette.");
  if (targetRole === role) return;
  const co = await companyName(companyId);
  await db.transaction(async (tx) => {
    await tx.update(companyMember).set({ role }).where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)));
    const invitesRevoked = can(role, "members.invite") ? 0 : await revokeInvitesOf(tx, companyId, userId);
    await audit({ companyId, actorId, action: "member.role_changed", targetType: "user", targetId: userId, subjectUserId: userId, meta: { from: targetRole, to: role, invitesRevoked } }, tx);
    await notify({ userId, actorId, type: "company_access", data: { event: "role", role, companyName: co.name, companySlug: co.slug } }, tx);
  });
  // Webhooks sender data videre; den som ikke lenger kan styre dem, skal ikke ha egne som går.
  if (!can(role, "webhooks.manage")) await disableWebhooksCreatedBy(companyId, userId);
  log.info("company.member-role", { actorId, companyId, userId, role });
}

// Alle unntatt eieren kan gå selv. Eieren må overføre eierskapet først.
export async function leaveCompany(userId: string, companyId: string) {
  const role = await getMembership(userId, companyId);
  if (!role) throw new UserFacingError("Du er ikke med i bedriften.");
  if (role === "owner") throw new UserFacingError("Eieren kan ikke forlate bedriften. Overfør eierskapet først.");
  const co = await companyName(companyId);
  await db.transaction(async (tx) => {
    await tx.delete(companyMember).where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)));
    const invitesRevoked = await revokeInvitesOf(tx, companyId, userId);
    await audit({ companyId, actorId: userId, action: "member.left", targetType: "user", targetId: userId, subjectUserId: userId, meta: { role, invitesRevoked } }, tx);
    const owners = await tx.select({ userId: companyMember.userId }).from(companyMember).where(and(eq(companyMember.companyId, companyId), eq(companyMember.role, "owner")));
    for (const o of owners) await notify({ userId: o.userId, actorId: userId, type: "company_access", data: { event: "left", role, companyName: co.name, companySlug: co.slug } }, tx);
  });
  await disableWebhooksCreatedBy(companyId, userId);
  log.info("company.member-leave", { userId, companyId });
}

// «Vis meg på bedriftssiden»: bare personen selv bestemmer.
export async function setShowOnPage(userId: string, companyId: string, show: boolean) {
  if (!isUuid(companyId)) throw new UserFacingError("Du er ikke med i bedriften.");
  const rows = await db
    .update(companyMember)
    .set({ showOnPage: show })
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
    .returning({ userId: companyMember.userId });
  if (rows.length === 0) throw new UserFacingError("Du er ikke med i bedriften.");
}

// «Krev tofaktor» (Bedrift, bare eieren). Eieren må selv ha tofaktor for å slå det på, ellers
// stenger man seg ute. Å slå det av går alltid, også når abonnementet er avsluttet.
export async function setCompanySecurity(actorId: string, companyId: string, { require2fa }: { require2fa: boolean }) {
  await requireCompanyPermission(actorId, companyId, "company.security");
  if (require2fa) {
    await requireBusiness(companyId);
    const [me] = await db.select({ twoFactorEnabled: user.twoFactorEnabled }).from(user).where(eq(user.id, actorId)).limit(1);
    if (!me?.twoFactorEnabled) throw new UserFacingError("Slå på tofaktor for din egen konto først.");
  }
  await db.transaction(async (tx) => {
    await tx.update(company).set({ require2fa }).where(eq(company.id, companyId));
    await audit({ companyId, actorId, action: "company.privacy_changed", targetType: "company", targetId: companyId, meta: { require2fa } }, tx);
  });
  log.info("company.security", { actorId, companyId, require2fa });
}

/* -------------------------------------------------------------------------- */
/*  Admin                                                                     */
/* -------------------------------------------------------------------------- */

// Vis-admin bekrefter (eller fjerner bekreftelsen). Logges uten person: det er Vis som gjør det.
export async function setCompanyVerified(adminId: string, companyId: string, verified: boolean) {
  await db
    .update(company)
    .set(verified ? { verifiedAt: new Date() } : { verifiedAt: null, verifiedDomain: null })
    .where(eq(company.id, companyId));
  await audit({ companyId, actorId: null, action: verified ? "company.verified" : "company.verification_reset", targetType: "company", targetId: companyId, meta: { byVis: true } });
  log.info("admin.company-verify", { adminId, companyId, verified });
}

/* -------------------------------------------------------------------------- */
/*  Teamet på bedriftssiden                                                   */
/* -------------------------------------------------------------------------- */

// Folk som jobber i bedriften vises på bedriftssiden med prosjektene sine. Utviklere stoler
// mer på kollegaer enn på reklame, og bedriften får en levende side uten å skrive noe selv.
// Å stå i teamet gir ingen tilgang til å administrere bedriften (det er medlemmer), og ingen
// står der uten å ha sagt ja til en invitasjon.

export const MAX_EMPLOYEES = 300;

// Administratorer kan fjerne folk fra teamet, og alle kan fjerne seg selv.
export async function removeEmployee(actorId: string, companyId: string, userId: string) {
  if (!isUuid(companyId)) throw new UserFacingError("Fant ikke bedriften.");
  if (actorId !== userId) await requireCompanyPermission(actorId, companyId, "members.manage");
  const deleted = await db
    .delete(companyEmployee)
    .where(and(eq(companyEmployee.companyId, companyId), eq(companyEmployee.userId, userId)))
    .returning({ userId: companyEmployee.userId });
  if (deleted.length > 0) {
    await audit({ companyId, actorId, action: "employee.removed", targetType: "user", targetId: userId, subjectUserId: userId, meta: { self: actorId === userId } });
  }
}

// Bedriftene der personen står i teamet på bedriftssiden (/invitasjoner).
export async function listMyTeams(userId: string) {
  return db
    .select({ id: company.id, slug: company.slug, name: company.name, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt, title: companyEmployee.title })
    .from(companyEmployee)
    .innerJoin(company, eq(company.id, companyEmployee.companyId))
    .where(eq(companyEmployee.userId, userId))
    .orderBy(asc(company.name));
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

// admin: et medlem (med tilgang) som selv har valgt å vises på siden.
export type TeamMember = { userId: string; name: string; username: string; image: string | null; headline: string | null; title: string | null; admin: boolean };

// Teamet: de som har godtatt å stå i teamet, pluss medlemmer som har valgt «Vis meg på bedriftssiden».
export async function listTeam(companyId: string): Promise<TeamMember[]> {
  if (!isUuid(companyId)) return [];
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
      .where(and(eq(companyMember.companyId, companyId), eq(companyMember.showOnPage, true), sql`coalesce(${user.banned}, false) = false`))
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
