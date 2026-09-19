import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";

const { comment, notification, project, user } = schema;

export async function getUnreadCount(userId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return count;
}

export async function listNotifications(userId: string, limit = 50) {
  const actor = alias(user, "actor");
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actorUsername: actor.username,
      actorName: actor.name,
      actorImage: actor.image,
      projectId: project.id,
      projectTitle: project.title,
      commentBody: comment.body,
    })
    .from(notification)
    .innerJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(project, eq(project.id, notification.projectId))
    .leftJoin(comment, eq(comment.id, notification.commentId))
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    unread: r.readAt === null,
    createdAt: r.createdAt,
    actor: { username: r.actorUsername, name: r.actorName, image: r.actorImage },
    project: r.projectId ? { id: r.projectId, title: r.projectTitle! } : null,
    excerpt: r.commentBody ? r.commentBody.slice(0, 160) : null,
  }));
}

export async function markAllRead(userId: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}
