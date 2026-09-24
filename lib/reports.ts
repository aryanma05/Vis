import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { log } from "@/lib/log";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { profilePath, projectPath } from "@/lib/site";

const { comment, project, report, user } = schema;

export type ReportTarget = "project" | "comment" | "user";
const MAX_REPORTS_PER_HOUR = 10;

// Finner det som rapporteres og tar et øyeblikksbilde av det.
async function snapshot(targetType: ReportTarget, targetId: string) {
  if (targetType === "project") {
    if (!isUuid(targetId)) return null;
    const [row] = await db
      .select({ title: project.title, summary: project.summary, ownerId: project.ownerId })
      .from(project)
      .where(eq(project.id, targetId))
      .limit(1);
    return row ? { label: row.title, url: projectPath(targetId), excerpt: row.summary, ownerId: row.ownerId } : null;
  }
  if (targetType === "comment") {
    if (!isUuid(targetId)) return null;
    const [row] = await db
      .select({ body: comment.body, projectId: comment.projectId, authorId: comment.authorId, authorName: user.name })
      .from(comment)
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(eq(comment.id, targetId))
      .limit(1);
    return row
      ? { label: `Kommentar av ${row.authorName}`, url: `${projectPath(row.projectId)}#kommentar-${targetId}`, excerpt: row.body.slice(0, 500), ownerId: row.authorId }
      : null;
  }
  const [row] = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);
  return row ? { label: `${row.name} (@${row.username})`, url: profilePath(row.username), excerpt: null, ownerId: targetId } : null;
}

export async function createReport(
  reporterId: string,
  { targetType, targetId, reason, details }: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string | null },
) {
  if (!["project", "comment", "user"].includes(targetType)) throw new UserFacingError("Ugyldig rapport.");
  if (!REPORT_REASONS.includes(reason)) throw new UserFacingError("Velg en grunn.");

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(report)
    .where(and(eq(report.reporterId, reporterId), gte(report.createdAt, sql`now() - interval '1 hour'`)));
  if (recent >= MAX_REPORTS_PER_HOUR) throw new UserFacingError("Du har sendt mange rapporter på kort tid. Vent litt.");

  const snap = await snapshot(targetType, targetId);
  if (!snap) throw new UserFacingError("Fant ikke det du vil rapportere.");
  if (snap.ownerId === reporterId) throw new UserFacingError("Du kan ikke rapportere ditt eget innhold.");

  // Samme person rapporterer det samme igjen: oppdater i stedet for å lage en ny.
  const [existing] = await db
    .select({ id: report.id })
    .from(report)
    .where(and(eq(report.reporterId, reporterId), eq(report.targetType, targetType), eq(report.targetId, targetId), eq(report.status, "open")))
    .limit(1);
  const values = { reason, details: details?.trim().slice(0, 1000) || null };
  if (existing) {
    await db.update(report).set(values).where(eq(report.id, existing.id));
    return;
  }
  await db.insert(report).values({
    reporterId,
    targetType,
    targetId,
    targetLabel: snap.label.slice(0, 200),
    targetUrl: snap.url,
    excerpt: snap.excerpt?.slice(0, 500) ?? null,
    targetOwnerId: snap.ownerId,
    ...values,
  });
  log.info("report.created", { targetType, reason });
}

export async function listReports(status: "open" | "resolved" | "dismissed" | "all" = "open", limit = 100) {
  const reporter = alias(user, "reporter");
  const owner = alias(user, "owner");
  return db
    .select({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      targetLabel: report.targetLabel,
      targetUrl: report.targetUrl,
      excerpt: report.excerpt,
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolution: report.resolution,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt,
      reporterName: reporter.name,
      reporterUsername: reporter.username,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerUsername: owner.username,
      ownerBanned: owner.banned,
      sameTarget: sql<number>`(select count(*)::int from ${report} r2 where r2.target_type = ${report.targetType} and r2.target_id = ${report.targetId})`,
      projectRemoved: sql<boolean>`${report.targetType} = 'project' and exists (select 1 from ${project} p where p.id::text = ${report.targetId} and p.removed_at is not null)`,
      commentExists: sql<boolean>`${report.targetType} <> 'comment' or exists (select 1 from ${comment} c where c.id::text = ${report.targetId})`,
    })
    .from(report)
    .leftJoin(reporter, eq(reporter.id, report.reporterId))
    .leftJoin(owner, eq(owner.id, report.targetOwnerId))
    .where(status === "all" ? undefined : eq(report.status, status))
    .orderBy(desc(report.createdAt))
    .limit(limit);
}

export type ReportRow = Awaited<ReturnType<typeof listReports>>[number];

export async function resolveReport(adminId: string, reportId: string, status: "resolved" | "dismissed", resolution?: string) {
  if (!isUuid(reportId)) throw new UserFacingError("Fant ikke rapporten.");
  await db
    .update(report)
    .set({ status, resolution: resolution?.slice(0, 500) ?? null, resolvedById: adminId, resolvedAt: new Date() })
    .where(eq(report.id, reportId));
}

// Løser alle åpne rapporter om samme innhold (f.eks. når det er fjernet).
export async function resolveReportsFor(adminId: string, targetType: ReportTarget, targetId: string, resolution: string) {
  await db
    .update(report)
    .set({ status: "resolved", resolution, resolvedById: adminId, resolvedAt: new Date() })
    .where(and(eq(report.targetType, targetType), eq(report.targetId, targetId), eq(report.status, "open")));
}
