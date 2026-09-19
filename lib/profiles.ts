import "server-only";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCv } from "@/lib/cv";
import { getProjectsByOwner } from "@/lib/projects";
import type { ProfileInput } from "@/lib/validation";

const { profile, user } = schema;

export async function getProfileByUsername(username: string, viewerId?: string | null) {
  const [row] = await db
    .select({
      id: user.id,
      username: user.username,
      displayUsername: user.displayUsername,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      websiteUrl: profile.websiteUrl,
      links: profile.links,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.username, username.toLowerCase()))
    .limit(1);

  if (!row) return null;

  const [projects, cv] = await Promise.all([getProjectsByOwner(row.id, viewerId), getCv(row.id)]);

  return {
    ...row,
    links: row.links ?? [],
    isOwner: viewerId === row.id,
    projects,
    cv,
  };
}

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfileByUsername>>>;

// Profilfeltene til innlogget bruker, til redigeringsskjemaet.
export async function getOwnProfile(userId: string) {
  const [row] = await db
    .select({
      name: user.name,
      username: user.username,
      image: user.image,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      websiteUrl: profile.websiteUrl,
      links: profile.links,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  return row ? { ...row, links: row.links ?? [] } : null;
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const fields = {
    headline: input.headline,
    bio: input.bio,
    location: input.location,
    websiteUrl: input.websiteUrl,
    links: input.links,
  };

  await db.transaction(async (tx) => {
    await tx.update(user).set({ name: input.name }).where(eq(user.id, userId));
    await tx
      .insert(profile)
      .values({ userId, ...fields })
      .onConflictDoUpdate({ target: profile.userId, set: fields });
  });
}

export async function setAvatar(userId: string, url: string | null) {
  await db.update(user).set({ image: url }).where(eq(user.id, userId));
}
