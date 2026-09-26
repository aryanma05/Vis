import "server-only";

import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { emailNotification, notify } from "@/lib/notifications";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";

const { follow, profile, project, user } = schema;

export type PersonCard = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  headline: string | null;
  location: string | null;
  followerCount: number;
  projectCount: number;
  isFollowing: boolean;
};

const notBanned = sql`coalesce(${user.banned}, false) = false`;

const followerCount = sql<number>`(select count(*)::int from ${follow} where ${follow.followingId} = ${outer(user.id)})`;
const publishedCount = sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${outer(user.id)} and ${project.status} = 'published' and ${project.removedAt} is null)`;

export const personColumns = {
  id: user.id,
  username: user.username,
  name: user.name,
  image: user.image,
  headline: profile.headline,
  location: profile.location,
  followerCount,
  projectCount: publishedCount,
};

// Legger på «følger du denne personen?» for innlogget bruker.
export async function withFollowState<T extends { id: string }>(people: T[], viewerId?: string | null) {
  if (!viewerId || people.length === 0) return people.map((p) => ({ ...p, isFollowing: false }));
  const rows = await db
    .select({ id: follow.followingId })
    .from(follow)
    .where(and(eq(follow.followerId, viewerId), inArray(follow.followingId, people.map((p) => p.id))));
  const following = new Set(rows.map((r) => r.id));
  return people.map((p) => ({ ...p, isFollowing: following.has(p.id) }));
}

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) throw new UserFacingError("Du kan ikke følge deg selv.");
  const [target] = await db
    .select({ id: user.id, banned: user.banned })
    .from(user)
    .where(eq(user.id, followingId))
    .limit(1);
  if (!target || target.banned) throw new UserFacingError("Fant ikke personen.");

  const inserted = await db
    .insert(follow)
    .values({ followerId, followingId })
    .onConflictDoNothing()
    .returning({ followingId: follow.followingId });
  if (inserted.length > 0) {
    await notify({ userId: followingId, actorId: followerId, type: "follow" });
    await emailNotification({ userId: followingId, actorId: followerId, type: "follow" });
  }
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db.delete(follow).where(and(eq(follow.followerId, followerId), eq(follow.followingId, followingId)));
}

export async function isFollowing(viewerId: string | null | undefined, targetId: string) {
  if (!viewerId || viewerId === targetId) return false;
  const [row] = await db
    .select({ id: follow.followingId })
    .from(follow)
    .where(and(eq(follow.followerId, viewerId), eq(follow.followingId, targetId)))
    .limit(1);
  return Boolean(row);
}

export async function getFollowCounts(userId: string) {
  const [[followers], [following]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(follow).where(eq(follow.followingId, userId)),
    db.select({ n: sql<number>`count(*)::int` }).from(follow).where(eq(follow.followerId, userId)),
  ]);
  return { followers: followers.n, following: following.n };
}

export async function listFollowers(userId: string, viewerId?: string | null, limit = 200) {
  const rows = await db
    .select(personColumns)
    .from(follow)
    .innerJoin(user, eq(user.id, follow.followerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(eq(follow.followingId, userId), notBanned))
    .orderBy(desc(follow.createdAt))
    .limit(limit);
  return withFollowState(rows, viewerId);
}

export async function listFollowing(userId: string, viewerId?: string | null, limit = 200) {
  const rows = await db
    .select(personColumns)
    .from(follow)
    .innerJoin(user, eq(user.id, follow.followingId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(eq(follow.followerId, userId), notBanned))
    .orderBy(desc(follow.createdAt))
    .limit(limit);
  return withFollowState(rows, viewerId);
}

// Folk å følge: aktive skapere man ikke følger ennå, med flest prosjekter og følgere først.
export async function suggestPeople(viewerId: string | null | undefined, limit = 5): Promise<PersonCard[]> {
  const conditions = [notBanned, sql`${publishedCount} > 0`];
  if (viewerId) {
    conditions.push(ne(user.id, viewerId));
    conditions.push(notInArray(user.id, db.select({ id: follow.followingId }).from(follow).where(eq(follow.followerId, viewerId))));
  }
  const rows = await db
    .select(personColumns)
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(sql`${publishedCount} * 2 + ${followerCount}`), desc(user.createdAt))
    .limit(limit);
  return withFollowState(rows, viewerId);
}
