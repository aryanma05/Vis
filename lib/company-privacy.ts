import "server-only";

import { and, count, desc, eq, gt, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { audit, AUDIT_FREE_DAYS, AUDIT_MAX_MONTHS } from "@/lib/audit";
import { hasBusiness } from "@/lib/billing";
import { requireBusiness } from "@/lib/companies";
import { COMPANY_TERMS_VERSION, requireCompanyPermission } from "@/lib/company-access";
import { AUDIT_ACTION_LABELS, AUDIT_GROUPS, RETENTION_OPTIONS, type AuditAction, type AuditGroup } from "@/lib/company-labels";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { FREE_RETENTION_MONTHS } from "@/lib/retention";
import { outer } from "@/lib/sql";

const { company, companyAudit, companyBlock, companyMember, companyWebhook, contactRequest, job, jobApplication, talentList, talentListMember, user } = schema;

// Personvern for bedrifter og kandidater: databehandleravtalen, lagringstid, status til
// fanen «Personvern og logg», og kandidatens egen side «Bedrifter og deg» med blokkering.
// En blokkering er absolutt og vises aldri for bedriften: ingen varsel, ingen logg.

/* -------------------------------------------------------------------------- */
/*  Bedriften                                                                 */
/* -------------------------------------------------------------------------- */

// Databehandleravtalen (/vilkar/databehandleravtale). Kreves før publisering, kandidatsøk,
// kontakt og betaling. Lagrer hvem, når og hvilken versjon.
export async function acceptCompanyTerms(actorId: string, companyId: string) {
  await requireCompanyPermission(actorId, companyId, "company.privacy");
  await db.transaction(async (tx) => {
    await tx
      .update(company)
      .set({ termsAcceptedAt: new Date(), termsAcceptedById: actorId, termsVersion: COMPANY_TERMS_VERSION })
      .where(eq(company.id, companyId));
    await audit({ companyId, actorId, action: "company.terms_accepted", targetType: "company", targetId: companyId, meta: { version: COMPANY_TERMS_VERSION } }, tx);
  });
}

// Hvor lenge søknader beholdes etter at stillingen er lukket (Bedrift: 3, 6 eller 12 måneder).
// Gjelder fra neste natt, og forkorter bare: allerede utregnede datoer forlenges aldri.
export async function setRetentionMonths(actorId: string, companyId: string, months: number) {
  await requireCompanyPermission(actorId, companyId, "company.privacy");
  await requireBusiness(companyId);
  if (!(RETENTION_OPTIONS as readonly number[]).includes(months)) throw new UserFacingError("Velg 3, 6 eller 12 måneder.");
  const [before] = await db.select({ months: company.retentionMonths }).from(company).where(eq(company.id, companyId)).limit(1);
  if (before?.months === months) return;
  await db.update(company).set({ retentionMonths: months }).where(eq(company.id, companyId));
  await audit({ companyId, actorId, action: "company.privacy_changed", targetType: "company", targetId: companyId, meta: { retentionMonths: months, from: before?.months ?? null } });
}

export type PrivacyStatus = Awaited<ReturnType<typeof getPrivacyStatus>>;

// Alt fanen «Personvern og logg» viser: avtalen, lagringstid og tallene rundt dem.
export async function getPrivacyStatus(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "company.privacy");
  const acceptedBy = alias(user, "accepted_by");
  const memberUser = alias(user, "member_user");
  const ofCompany = eq(job.companyId, companyId);
  const [[row], business, [apps], [purged], [exports], [lists], [members], [hooks]] = await Promise.all([
    db
      .select({
        termsAcceptedAt: company.termsAcceptedAt,
        termsVersion: company.termsVersion,
        retentionMonths: company.retentionMonths,
        require2fa: company.require2fa,
        acceptedByName: acceptedBy.name,
        acceptedByUsername: acceptedBy.username,
      })
      .from(company)
      .leftJoin(acceptedBy, eq(acceptedBy.id, company.termsAcceptedById))
      .where(eq(company.id, companyId))
      .limit(1),
    hasBusiness(companyId),
    db
      .select({
        stored: count(),
        soon: sql<number>`count(*) filter (where ${jobApplication.expiresAt} < now() + interval '30 days')::int`,
        withdrawn: sql<number>`count(*) filter (where ${jobApplication.status} = 'trukket')::int`,
      })
      .from(jobApplication)
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .where(ofCompany),
    db
      .select({ n: sql<number>`coalesce(sum((${companyAudit.meta}->>'n')::int), 0)::int` })
      .from(companyAudit)
      .where(and(eq(companyAudit.companyId, companyId), eq(companyAudit.action, "retention.purged"), gt(companyAudit.createdAt, sql`now() - interval '30 days'`))),
    db
      .select({ n: count() })
      .from(companyAudit)
      .where(and(eq(companyAudit.companyId, companyId), inArray(companyAudit.action, [...AUDIT_GROUPS.eksport]), gt(companyAudit.createdAt, sql`now() - interval '30 days'`))),
    db
      .select({ n: count() })
      .from(talentListMember)
      .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
      .where(eq(talentList.companyId, companyId)),
    db
      .select({ total: count(), twoFactor: sql<number>`count(*) filter (where coalesce(${memberUser.twoFactorEnabled}, false))::int` })
      .from(companyMember)
      .innerJoin(memberUser, eq(memberUser.id, companyMember.userId))
      .where(eq(companyMember.companyId, companyId)),
    db
      .select({
        total: count(),
        personal: sql<number>`count(*) filter (where ${companyWebhook.active} and ${companyWebhook.includePersonalData})::int`,
      })
      .from(companyWebhook)
      .where(eq(companyWebhook.companyId, companyId)),
  ]);
  if (!row) throw new UserFacingError("Fant ikke bedriften.");
  return {
    terms: {
      acceptedAt: row.termsAcceptedAt,
      version: row.termsVersion,
      current: COMPANY_TERMS_VERSION,
      upToDate: row.termsAcceptedAt !== null && row.termsVersion === COMPANY_TERMS_VERSION,
      acceptedBy: row.acceptedByUsername ? { name: row.acceptedByName!, username: row.acceptedByUsername } : null,
    },
    retention: { months: row.retentionMonths, effective: business ? row.retentionMonths : FREE_RETENTION_MONTHS, business },
    applications: { stored: apps?.stored ?? 0, soon: apps?.soon ?? 0, withdrawn: apps?.withdrawn ?? 0 },
    purged30: purged?.n ?? 0,
    exports30: exports?.n ?? 0,
    listMembers: lists?.n ?? 0,
    members: { total: members?.total ?? 0, twoFactor: members?.twoFactor ?? 0, required: row.require2fa },
    webhooks: { total: hooks?.total ?? 0, personal: hooks?.personal ?? 0 },
    log: { days: business ? null : AUDIT_FREE_DAYS, months: business ? AUDIT_MAX_MONTHS : null },
  };
}

/* -------------------------------------------------------------------------- */
/*  Aktivitetsloggen som CSV                                                  */
/* -------------------------------------------------------------------------- */

const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  // Hindrer at regneark tolker celler som formler («=HYPERLINK(...)»).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const metaText = (meta: Record<string, unknown>) =>
  Object.entries(meta)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");

// Hele loggen (24 måneder) som CSV, for Bedrift. Begrenset per bedrift, og eksporten logges selv.
export async function auditCsv(viewerId: string, companyId: string, group?: string | null) {
  await requireCompanyPermission(viewerId, companyId, "audit.export");
  await requireBusiness(companyId);
  await enforce("auditExport", companyId);
  const actions = group && Object.hasOwn(AUDIT_GROUPS, group) ? AUDIT_GROUPS[group as AuditGroup] : null;
  const actor = alias(user, "actor");
  const subject = alias(user, "subject");
  const rows = await db
    .select({
      createdAt: companyAudit.createdAt,
      action: companyAudit.action,
      label: companyAudit.label,
      meta: companyAudit.meta,
      targetType: companyAudit.targetType,
      actorName: actor.name,
      actorUsername: actor.username,
      subjectName: subject.name,
      subjectUsername: subject.username,
    })
    .from(companyAudit)
    .leftJoin(actor, eq(actor.id, companyAudit.actorId))
    .leftJoin(subject, eq(subject.id, companyAudit.subjectUserId))
    .where(
      and(
        eq(companyAudit.companyId, companyId),
        gt(companyAudit.createdAt, sql`now() - make_interval(months => ${AUDIT_MAX_MONTHS})`),
        actions ? inArray(companyAudit.action, [...actions]) : undefined,
      ),
    )
    .orderBy(desc(companyAudit.createdAt))
    .limit(50_000);
  const header = ["Tidspunkt", "Hvem", "Handling", "Gjelder", "Hva", "Type", "Detaljer"];
  const lines = rows.map((r) => [
    r.createdAt.toISOString(),
    r.actorUsername ? `${r.actorName} (@${r.actorUsername})` : "Vis",
    AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action,
    r.subjectUsername ? `${r.subjectName} (@${r.subjectUsername})` : "",
    r.label ?? "",
    r.targetType ?? "",
    metaText(r.meta),
  ]);
  const footer = ["Personopplysninger – slett filen når dere er ferdige (vilkår § 6)"];
  await audit({ companyId, actorId: viewerId, action: "audit.exported", targetType: "company", targetId: companyId, meta: { rows: rows.length, group: actions ? group! : null } });
  // BOM så Excel leser æ, ø og å riktig.
  return `﻿${[header, ...lines, [], footer].map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/* -------------------------------------------------------------------------- */
/*  Kandidaten: «Bedrifter og deg» og blokkering                              */
/* -------------------------------------------------------------------------- */

// For kandidatsøk, lister og varsler: personen har ikke blokkert bedriften. userId er den
// ytre kolonnen (som regel user.id).
export const notBlockedSql = (companyId: string, userId: SQL = outer(user.id)) =>
  sql`not exists (select 1 from company_block cb where cb.user_id = ${userId} and cb.company_id = ${companyId})`;

export async function isBlocked(userId: string, companyId: string) {
  if (!isUuid(companyId)) return false;
  const [row] = await db
    .select({ userId: companyBlock.userId })
    .from(companyBlock)
    .where(and(eq(companyBlock.userId, userId), eq(companyBlock.companyId, companyId)))
    .limit(1);
  return Boolean(row);
}

export type CompanyRelation = Awaited<ReturnType<typeof listCompanyRelations>>[number];

// Bedrifter som har lagret, kontaktet, fått en søknad fra eller åpnet søknaden til personen,
// og de personen har blokkert. Bare personens egne data; aldri hvem i bedriften som gjorde det.
export async function listCompanyRelations(userId: string) {
  const [saved, contacted, applied, viewed, blocked] = await Promise.all([
    db
      .select({ companyId: talentList.companyId, lists: sql<number>`count(distinct ${talentList.id})::int`, at: sql<Date>`max(${talentListMember.addedAt})` })
      .from(talentListMember)
      .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
      .where(and(eq(talentListMember.userId, userId), gt(talentListMember.expiresAt, sql`now()`)))
      .groupBy(talentList.companyId),
    db
      .select({ companyId: sql<string>`${contactRequest.companyId}`, n: count(), at: sql<Date>`max(${contactRequest.createdAt})` })
      .from(contactRequest)
      .where(and(eq(contactRequest.recipientId, userId), isNotNull(contactRequest.companyId)))
      .groupBy(contactRequest.companyId),
    db
      .select({ companyId: job.companyId, n: count(), at: sql<Date>`max(${jobApplication.createdAt})` })
      .from(jobApplication)
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .where(eq(jobApplication.userId, userId))
      .groupBy(job.companyId),
    db
      .select({ companyId: companyAudit.companyId, at: sql<Date>`max(${companyAudit.createdAt})` })
      .from(companyAudit)
      .where(and(eq(companyAudit.subjectUserId, userId), eq(companyAudit.action, "application.viewed")))
      .groupBy(companyAudit.companyId),
    db.select({ companyId: companyBlock.companyId, at: companyBlock.createdAt }).from(companyBlock).where(eq(companyBlock.userId, userId)),
  ]);
  const ids = [...new Set([...saved, ...contacted, ...applied, ...viewed, ...blocked].map((r) => r.companyId))];
  if (ids.length === 0) return [];
  const companies = await db
    .select({ id: company.id, name: company.name, slug: company.slug, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt })
    .from(company)
    .where(inArray(company.id, ids));
  const date = (d: Date | string | null | undefined) => (d ? new Date(d) : null);
  return companies
    .map((c) => {
      const s = saved.find((r) => r.companyId === c.id);
      const k = contacted.find((r) => r.companyId === c.id);
      const a = applied.find((r) => r.companyId === c.id);
      const v = viewed.find((r) => r.companyId === c.id);
      const b = blocked.find((r) => r.companyId === c.id);
      const relation = {
        company: { id: c.id, name: c.name, slug: c.slug, logoUrl: c.logoUrl, verified: c.verifiedAt !== null },
        saved: s ? { lists: s.lists, at: date(s.at)! } : null,
        contacted: k ? { count: k.n, at: date(k.at)! } : null,
        applied: a ? { count: a.n, at: date(a.at)! } : null,
        viewedAt: date(v?.at),
        blockedAt: date(b?.at),
      };
      const latest = Math.max(...[relation.saved?.at, relation.contacted?.at, relation.applied?.at, relation.viewedAt, relation.blockedAt].map((d) => d?.getTime() ?? 0));
      return { ...relation, latest: new Date(latest) };
    })
    .sort((x, y) => y.latest.getTime() - x.latest.getTime());
}

async function requireCompany(companyId: string) {
  if (!isUuid(companyId)) throw new UserFacingError("Fant ikke bedriften.");
  const [row] = await db.select({ id: company.id }).from(company).where(eq(company.id, companyId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke bedriften.");
}

const ownListsOf = (companyId: string) => sql`${talentListMember.listId} in (select ${talentList.id} from ${talentList} where ${talentList.companyId} = ${companyId})`;

// «Fjern meg fra listene»: personen forsvinner fra alle listene til bedriften. Gir antall.
export async function removeMeFromCompanyLists(userId: string, companyId: string) {
  await requireCompany(companyId);
  const rows = await db
    .delete(talentListMember)
    .where(and(eq(talentListMember.userId, userId), ownListsOf(companyId)))
    .returning({ listId: talentListMember.listId });
  return rows.length;
}

// Blokker: bedriften finner deg aldri i søk, lister eller varsler, og kan ikke kontakte deg.
// Du fjernes fra listene deres med en gang. Bedriften får ikke vite noe.
export async function blockCompany(userId: string, companyId: string) {
  await requireCompany(companyId);
  const [member] = await db
    .select({ role: companyMember.role })
    .from(companyMember)
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
    .limit(1);
  if (member) throw new UserFacingError("Du kan ikke blokkere en bedrift du er med i.");
  await db.transaction(async (tx) => {
    await tx.insert(companyBlock).values({ userId, companyId }).onConflictDoNothing();
    await tx.delete(talentListMember).where(and(eq(talentListMember.userId, userId), ownListsOf(companyId)));
  });
}

export async function unblockCompany(userId: string, companyId: string) {
  if (!isUuid(companyId)) return;
  await db.delete(companyBlock).where(and(eq(companyBlock.userId, userId), eq(companyBlock.companyId, companyId)));
}

// Til kontosiden: hvor mange bedrifter som har lagret personen, hvor mange som er blokkert, og
// om personen selv er med i en bedrift (da vises valget for den daglige oppsummeringen).
export async function countCompanyRelations(userId: string) {
  const [[saved], [blocked], [member]] = await Promise.all([
    db
      .select({ n: sql<number>`count(distinct ${talentList.companyId})::int` })
      .from(talentListMember)
      .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
      .where(and(eq(talentListMember.userId, userId), gt(talentListMember.expiresAt, sql`now()`))),
    db.select({ n: count() }).from(companyBlock).where(eq(companyBlock.userId, userId)),
    db.select({ n: count() }).from(companyMember).where(eq(companyMember.userId, userId)),
  ]);
  return { saved: saved?.n ?? 0, blocked: blocked?.n ?? 0, memberOf: member?.n ?? 0 };
}
