import "server-only";

import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { AuditMeta } from "@/db/schema";
import { hasBusiness } from "@/lib/billing";
import { requireCompanyPermission } from "@/lib/company-access";
import { AUDIT_GROUPS, FEED_ACTIONS, type AuditAction, type AuditGroup, type AuditTargetType } from "@/lib/company-labels";
import type { Tx } from "@/lib/db-types";
import { later } from "@/lib/later";
import { log } from "@/lib/log";

const { companyAudit, user } = schema;

// Aktivitetsloggen: hvem gjorde hva, og med hvem sine data. Svarer på «Hvem avslo Kari?» og
// «Hvem eksporterte lista?», og er dokumentasjon hvis en kandidat mener seg diskriminert.
// meta har bare id-er, tall, statuser og ja/nei, aldri fritekst. Radene endres aldri.

export const AUDIT_FREE_DAYS = 30;
export const AUDIT_MAX_MONTHS = 24;
const META_MAX = 64;

export type AuditEntry = {
  companyId: string;
  actorId: string | null;
  action: AuditAction;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  subjectUserId?: string | null;
  label?: string | null;
  meta?: AuditMeta;
};

// meta: bare tekst (maks 64 tegn), endelige tall, ja/nei og null. Alt annet (objekter, lister)
// tas ikke med, så det aldri havner fritekst eller hele objekter i loggen.
function toRow(entry: AuditEntry) {
  const meta: AuditMeta = {};
  for (const [key, value] of Object.entries(entry.meta ?? {})) {
    if (typeof value === "string") meta[key] = value.slice(0, META_MAX);
    else if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean" || value === null) meta[key] = value;
  }
  return {
    companyId: entry.companyId,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId == null ? null : String(entry.targetId),
    subjectUserId: entry.subjectUserId ?? null,
    label: entry.label == null ? null : String(entry.label).slice(0, 200),
    meta,
  };
}

// Med tx skrives raden i transaksjonen (sikkerhetskritisk: tilgang, eierskap). Uten skrives den
// etter at svaret er sendt, og feil logges i stedet for å kastes.
export async function audit(entry: AuditEntry, tx?: Tx): Promise<void> {
  if (tx) {
    await tx.insert(companyAudit).values(toRow(entry));
    return;
  }
  later(async () => {
    try {
      await db.insert(companyAudit).values(toRow(entry));
    } catch (error) {
      log.error("audit.write", { error, action: entry.action, companyId: entry.companyId });
    }
  });
}

// «Åpnet en søknad» logges maks én gang per person, søknad og dag (Oslo-tid). Kaster aldri.
export async function auditViewOnce(companyId: string, actorId: string, applicationId: string, subjectUserId: string | null): Promise<void> {
  try {
    await db.execute(sql`
      insert into ${companyAudit} (company_id, actor_id, action, target_type, target_id, subject_user_id)
      select ${companyId}::uuid, ${actorId}, 'application.viewed', 'application', ${applicationId}, ${subjectUserId}
      where not exists (
        select 1 from ${companyAudit}
        where company_id = ${companyId} and actor_id = ${actorId} and action = 'application.viewed' and target_id = ${applicationId}
          and (created_at at time zone 'Europe/Oslo')::date = (now() at time zone 'Europe/Oslo')::date)`);
  } catch (error) {
    log.error("audit.view", { error, companyId, applicationId });
  }
}

export type AuditRow = Awaited<ReturnType<typeof listAudit>>[number];

// feed: alle roller, bare FEED_ACTIONS, siste 30 dager (Oversikt).
// full: krever audit.view; 30 dager på Gratis, 24 måneder med Bedrift (Personvern og logg).
// before = createdAt på siste rad som er vist («Vis flere»).
export async function listAudit(
  viewerId: string,
  companyId: string,
  {
    scope,
    group,
    actorId,
    before,
    limit = 50,
  }: { scope: "feed" | "full"; group?: AuditGroup | null; actorId?: string | null; before?: Date | string | null; limit?: number },
) {
  await requireCompanyPermission(viewerId, companyId, scope === "feed" ? "company.view" : "audit.view");
  const long = scope === "full" && (await hasBusiness(companyId));
  const since = long ? sql`now() - make_interval(months => ${AUDIT_MAX_MONTHS})` : sql`now() - make_interval(days => ${AUDIT_FREE_DAYS})`;
  // group kan komme rett fra adressen (?logg=…): bare egne nøkler, ikke f.eks. «toString».
  const actions: readonly AuditAction[] | null = scope === "feed" ? FEED_ACTIONS : group && Object.hasOwn(AUDIT_GROUPS, group) ? AUDIT_GROUPS[group] : null;
  const beforeDate = before ? new Date(before) : null;

  const actor = alias(user, "actor");
  const subject = alias(user, "subject");
  const rows = await db
    .select({
      id: companyAudit.id,
      action: companyAudit.action,
      targetType: companyAudit.targetType,
      targetId: companyAudit.targetId,
      label: companyAudit.label,
      meta: companyAudit.meta,
      createdAt: companyAudit.createdAt,
      actorId: actor.id,
      actorName: actor.name,
      actorUsername: actor.username,
      actorImage: actor.image,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectUsername: subject.username,
    })
    .from(companyAudit)
    .leftJoin(actor, eq(actor.id, companyAudit.actorId))
    .leftJoin(subject, eq(subject.id, companyAudit.subjectUserId))
    .where(
      and(
        eq(companyAudit.companyId, companyId),
        sql`${companyAudit.createdAt} > ${since}`,
        actions ? inArray(companyAudit.action, [...actions]) : undefined,
        actorId ? eq(companyAudit.actorId, actorId) : undefined,
        beforeDate && !Number.isNaN(beforeDate.getTime()) ? lt(companyAudit.createdAt, beforeDate) : undefined,
      ),
    )
    .orderBy(desc(companyAudit.createdAt))
    .limit(Math.min(Math.max(1, Math.floor(limit) || 50), 200));

  return rows.map((r) => ({
    id: r.id,
    action: r.action as AuditAction,
    targetType: r.targetType as AuditTargetType | null,
    targetId: r.targetId,
    label: r.label,
    meta: r.meta,
    createdAt: r.createdAt,
    actor: r.actorId ? { id: r.actorId, name: r.actorName!, username: r.actorUsername!, image: r.actorImage } : null,
    subject: r.subjectId ? { id: r.subjectId, name: r.subjectName!, username: r.subjectUsername! } : null,
  }));
}

// Planlagt jobb: sletter rader eldre enn 24 måneder. Gir antall slettet.
export async function purgeAudit(): Promise<number> {
  const deleted = await db
    .delete(companyAudit)
    .where(lt(companyAudit.createdAt, sql`now() - make_interval(months => ${AUDIT_MAX_MONTHS})`))
    .returning({ id: companyAudit.id });
  return deleted.length;
}
