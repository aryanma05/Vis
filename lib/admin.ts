import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { adminEmails } from "@/lib/auth";
import { log } from "@/lib/log";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

const { comment, project, report, session, user } = schema;

// Admin: rollen "admin" i databasen, eller e-posten står i ADMIN_EMAILS.
export function isAdmin(u: { role?: string | null; email?: string | null } | null | undefined) {
  if (!u) return false;
  return u.role === "admin" || (u.email ? adminEmails.has(u.email.toLowerCase()) : false);
}

export async function getAdmin(): Promise<CurrentUser | null> {
  const u = await getCurrentUser();
  return isAdmin(u) ? u : null;
}

export async function requireAdminForAction() {
  const u = await getCurrentUser();
  if (!isAdmin(u)) throw new UserFacingError("Du har ikke tilgang til dette.");
  return u!;
}

export async function removeProject(adminId: string, projectId: string, reason: string) {
  if (!isUuid(projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  const updated = await db
    .update(project)
    .set({ removedAt: new Date(), removedReason: reason.trim().slice(0, 500) || "Brudd på retningslinjene." })
    .where(eq(project.id, projectId))
    .returning({ id: project.id });
  if (updated.length === 0) throw new UserFacingError("Fant ikke prosjektet.");
  log.info("admin.remove-project", { adminId, projectId });
}

export async function restoreProject(adminId: string, projectId: string) {
  if (!isUuid(projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  await db.update(project).set({ removedAt: null, removedReason: null }).where(eq(project.id, projectId));
  log.info("admin.restore-project", { adminId, projectId });
}

export async function adminDeleteComment(adminId: string, commentId: string) {
  if (!isUuid(commentId)) throw new UserFacingError("Fant ikke kommentaren.");
  const [row] = await db.delete(comment).where(eq(comment.id, commentId)).returning({ projectId: comment.projectId });
  log.info("admin.delete-comment", { adminId, commentId });
  return row?.projectId ?? null;
}

// Stenger en konto: brukeren logges ut overalt og innholdet skjules for andre.
export async function banUser(adminId: string, userId: string, reason: string, days?: number | null) {
  if (adminId === userId) throw new UserFacingError("Du kan ikke stenge din egen konto.");
  const [target] = await db.select({ role: user.role, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  if (!target) throw new UserFacingError("Fant ikke brukeren.");
  if (isAdmin(target)) throw new UserFacingError("Du kan ikke stenge en annen admin.");
  await db
    .update(user)
    .set({
      banned: true,
      banReason: reason.trim().slice(0, 500) || "Brudd på retningslinjene.",
      banExpires: days ? new Date(Date.now() + days * 86_400_000) : null,
    })
    .where(eq(user.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
  log.info("admin.ban", { adminId, userId, days: days ?? null });
}

export async function unbanUser(adminId: string, userId: string) {
  await db.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, userId));
  log.info("admin.unban", { adminId, userId });
}

export async function listUsers(query: string, limit = 50) {
  const q = query.trim();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
      projects: sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${user.id})`,
      reports: sql<number>`(select count(*)::int from ${report} where ${report.targetOwnerId} = ${user.id})`,
    })
    .from(user)
    .where(q ? or(ilike(user.name, like), ilike(user.username, like), ilike(user.email, like)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit);
}

export async function getModerationCounts() {
  const [row] = await db
    .select({
      open: sql<number>`count(*) filter (where ${report.status} = 'open')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(report);
  const [removed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(project)
    .where(and(sql`${project.removedAt} is not null`));
  const [banned] = await db.select({ n: sql<number>`count(*)::int` }).from(user).where(eq(user.banned, true));
  return { openReports: row?.open ?? 0, totalReports: row?.total ?? 0, removedProjects: removed?.n ?? 0, bannedUsers: banned?.n ?? 0 };
}
