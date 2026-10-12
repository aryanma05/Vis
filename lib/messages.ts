import "server-only";

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { notify } from "@/lib/notifications";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";

const { follow, message, notification, user } = schema;

export const MESSAGE_MAX = 2000;

const between = (a: string, b: string) =>
  or(and(eq(message.senderId, a), eq(message.recipientId, b)), and(eq(message.senderId, b), eq(message.recipientId, a)));

// Venner er to som følger hverandre. Bare venner kan sende meldinger til hverandre.
export async function areFriends(a: string, b: string) {
  if (a === b) return false;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(follow)
    .where(or(and(eq(follow.followerId, a), eq(follow.followingId, b)), and(eq(follow.followerId, b), eq(follow.followingId, a))));
  return n === 2;
}

// Innboksen: alle vennene, med siste melding og antall uleste. Nyeste samtale først.
export async function listConversations(userId: string) {
  const back = alias(follow, "back");
  const last = db
    .select({ body: message.body, senderId: message.senderId, createdAt: message.createdAt })
    .from(message)
    .where(
      sql`(${message.senderId} = ${outer(user.id)} and ${message.recipientId} = ${userId}) or (${message.senderId} = ${userId} and ${message.recipientId} = ${outer(user.id)})`,
    )
    .orderBy(desc(message.createdAt))
    .limit(1)
    .as("last");
  const rows = await db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      lastBody: last.body,
      lastSenderId: last.senderId,
      lastAt: last.createdAt,
      unread: sql<number>`(select count(*)::int from ${message} where ${message.senderId} = ${outer(user.id)} and ${message.recipientId} = ${userId} and ${message.readAt} is null)`,
    })
    .from(follow)
    .innerJoin(back, and(eq(back.followerId, follow.followingId), eq(back.followingId, follow.followerId)))
    .innerJoin(user, eq(user.id, follow.followingId))
    .leftJoinLateral(last, sql`true`)
    .where(and(eq(follow.followerId, userId), sql`coalesce(${user.banned}, false) = false`))
    .orderBy(sql`${last.createdAt} desc nulls last`, asc(user.name));
  return rows.map(({ lastSenderId, ...r }) => ({ ...r, lastMine: lastSenderId === userId }));
}

// De siste meldingene mellom to personer, eldste først.
export async function getMessages(userId: string, friendId: string, limit = 200) {
  const rows = await db
    .select({ id: message.id, body: message.body, senderId: message.senderId, readAt: message.readAt, createdAt: message.createdAt })
    .from(message)
    .where(between(userId, friendId))
    .orderBy(desc(message.createdAt))
    .limit(limit);
  return rows.reverse().map(({ senderId, readAt, ...m }) => ({ ...m, mine: senderId === userId, unread: senderId !== userId && !readAt }));
}

export async function sendMessage(senderId: string, recipientId: string, text: string) {
  const body = text.trim().replace(/\n{3,}/g, "\n\n");
  if (!body) throw new UserFacingError("Skriv en melding først.");
  if (body.length > MESSAGE_MAX) throw new UserFacingError("Meldingen kan være maks {n} tegn.", { n: MESSAGE_MAX });
  if (!(await areFriends(senderId, recipientId))) throw new UserFacingError("Dere må følge hverandre for å sende meldinger.");
  const [recipient] = await db.select({ banned: user.banned }).from(user).where(eq(user.id, recipientId)).limit(1);
  if (!recipient || recipient.banned) throw new UserFacingError("Denne personen tar ikke imot meldinger akkurat nå.");
  await enforce("message", senderId);
  await db.insert(message).values({ senderId, recipientId, body });
  await notify({ userId: recipientId, actorId: senderId, type: "message" });
}

// Samtalen er åpnet: meldingene og varselet om dem er lest.
export async function markMessagesRead(userId: string, friendId: string) {
  const now = new Date();
  await db.update(message).set({ readAt: now }).where(and(eq(message.recipientId, userId), eq(message.senderId, friendId), isNull(message.readAt)));
  await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.userId, userId), eq(notification.actorId, friendId), eq(notification.type, "message"), isNull(notification.readAt)));
}

// Til «Last ned dataene dine»: meldingene du har sendt og fått.
export async function exportMessages(userId: string) {
  const other = alias(user, "other");
  const [sent, received] = await Promise.all([
    db
      .select({ to: other.username, body: message.body, createdAt: message.createdAt })
      .from(message)
      .innerJoin(other, eq(other.id, message.recipientId))
      .where(eq(message.senderId, userId))
      .orderBy(asc(message.createdAt)),
    db
      .select({ from: other.username, body: message.body, createdAt: message.createdAt, readAt: message.readAt })
      .from(message)
      .innerJoin(other, eq(other.id, message.senderId))
      .where(eq(message.recipientId, userId))
      .orderBy(asc(message.createdAt)),
  ]);
  return { sent, received };
}
