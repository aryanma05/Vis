import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { OpenTo, ProfileSection, SocialLink } from "@/db/schema";
import { OPEN_TO, type AccentKey, type CvTemplate } from "@/lib/constants";
import { getCv } from "@/lib/cv";
import { getCvDocument } from "@/lib/cv-document";
import { getProjectsByOwner, publicProject } from "@/lib/projects";
import { getFollowCounts, isFollowing, personColumns, withFollowState, type PersonCard } from "@/lib/social";
import type { ProfileInput } from "@/lib/validation";

const { cvSkill, follow, profile, project, projectImage, projectTag, reaction, tag, user } = schema;

const profileColumns = {
  id: user.id,
  username: user.username,
  displayUsername: user.displayUsername,
  name: user.name,
  image: user.image,
  createdAt: user.createdAt,
  banned: user.banned,
  role: user.role,
  headline: profile.headline,
  bio: profile.bio,
  location: profile.location,
  websiteUrl: profile.websiteUrl,
  links: profile.links,
  readme: profile.readme,
  lookingFor: profile.lookingFor,
  openTo: profile.openTo,
  customSections: profile.customSections,
  accentColor: profile.accentColor,
  cvTemplate: profile.cvTemplate,
};

// Én oppslag per request, selv om både generateMetadata og siden spør.
export const getProfileBase = cache(async (username: string) => {
  const [row] = await db
    .select(profileColumns)
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.username, username.toLowerCase()))
    .limit(1);
  if (!row || row.banned) return null;
  return {
    ...row,
    links: (row.links ?? []) as SocialLink[],
    openTo: (row.openTo ?? []) as OpenTo[],
    customSections: (row.customSections ?? []) as ProfileSection[],
    accentColor: (row.accentColor ?? null) as AccentKey | null,
    cvTemplate: (row.cvTemplate ?? "klassisk") as CvTemplate,
  };
});

export async function getProfileByUsername(username: string, viewerId?: string | null) {
  const base = await getProfileBase(username);
  if (!base) return null;

  const [projects, cv, cvDocument, counts, following, reactionsReceived] = await Promise.all([
    getProjectsByOwner(base.id, viewerId),
    getCv(base.id),
    getCvDocument(base.id, viewerId),
    getFollowCounts(base.id),
    isFollowing(viewerId, base.id),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(reaction)
      .innerJoin(project, eq(project.id, reaction.projectId))
      .where(eq(project.ownerId, base.id)),
  ]);

  return {
    ...base,
    isOwner: viewerId === base.id,
    projects,
    cv,
    cvDocument,
    followers: counts.followers,
    following: counts.following,
    isFollowing: following,
    reactionsReceived: reactionsReceived[0]?.n ?? 0,
  };
}

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfileByUsername>>>;

// Profilfeltene til innlogget bruker, til redigeringsskjemaet.
export async function getOwnProfile(userId: string) {
  const [row] = await db.select(profileColumns).from(user).leftJoin(profile, eq(profile.userId, user.id)).where(eq(user.id, userId)).limit(1);
  if (!row) return null;
  return {
    ...row,
    links: (row.links ?? []) as SocialLink[],
    openTo: (row.openTo ?? []) as OpenTo[],
    customSections: (row.customSections ?? []) as ProfileSection[],
    accentColor: (row.accentColor ?? null) as AccentKey | null,
  };
}

export async function updateProfile(userId: string, input: ProfileInput) {
  const fields = {
    headline: input.headline,
    bio: input.bio,
    location: input.location,
    websiteUrl: input.websiteUrl,
    links: input.links,
    readme: input.readme,
    lookingFor: input.lookingFor,
    openTo: input.openTo,
    customSections: input.customSections,
    accentColor: input.accentColor,
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

export async function setCvTemplate(userId: string, template: CvTemplate) {
  await db
    .insert(profile)
    .values({ userId, cvTemplate: template })
    .onConflictDoUpdate({ target: profile.userId, set: { cvTemplate: template } });
}

/* -------------------------------------------------------------------------- */
/*  Søk og oppdagelse                                                         */
/* -------------------------------------------------------------------------- */

const notBanned = sql`coalesce(${user.banned}, false) = false`;

export async function searchPeople(
  query: string,
  {
    viewerId,
    location,
    openTo,
    tag: tagSlug,
    limit = 36,
  }: { viewerId?: string | null; location?: string | null; openTo?: OpenTo | null; tag?: string | null; limit?: number } = {},
): Promise<PersonCard[]> {
  const conditions: SQL[] = [notBanned];
  const q = query.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(
        ilike(user.name, like),
        ilike(user.username, like),
        ilike(profile.headline, like),
        ilike(profile.location, like),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${user.id} and ${cvSkill.name} ilike ${like})`,
      )!,
    );
  }
  if (location?.trim()) conditions.push(ilike(profile.location, `%${location.trim().replace(/[%_]/g, "")}%`));
  if (openTo && OPEN_TO.includes(openTo)) conditions.push(sql`${profile.openTo} @> ${JSON.stringify([openTo])}::jsonb`);
  if (tagSlug) {
    conditions.push(
      sql`exists (select 1 from ${project} p join ${projectTag} pt on pt.project_id = p.id join ${tag} t on t.id = pt.tag_id
        where p.owner_id = ${user.id} and p.status = 'published' and p.removed_at is null and t.slug = ${tagSlug})`,
    );
  }

  const rows = await db
    .select(personColumns)
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(personColumns.projectCount), desc(personColumns.followerCount), asc(user.name))
    .limit(limit);
  return withFollowState(rows, viewerId);
}

// Steder folk har skrevet at de bor, til filteret i søket.
export async function getPopularLocations(limit = 8) {
  const rows = await db
    .select({ location: sql<string>`initcap(trim(split_part(${profile.location}, ',', 1)))`, count: sql<number>`count(*)::int` })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(and(notBanned, sql`coalesce(trim(${profile.location}), '') <> ''`))
    .groupBy(sql`1`)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows;
}

export type FeaturedProfile = {
  username: string;
  name: string;
  image: string | null;
  headline: string | null;
  location: string | null;
  coverUrl: string | null;
  tags: string[];
  projectCount: number;
  followerCount: number;
  accentColor: AccentKey | null;
};

// Profiler til forsiden: aktive folk med bilder i prosjektene sine.
export async function getFeaturedProfiles(limit = 6): Promise<FeaturedProfile[]> {
  const rows = await db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      headline: profile.headline,
      location: profile.location,
      accentColor: profile.accentColor,
      projectCount: personColumns.projectCount,
      followerCount: personColumns.followerCount,
      reactions: sql<number>`(select count(*)::int from ${reaction} r join ${project} p on p.id = r.project_id where p.owner_id = ${user.id})`,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(notBanned, sql`${personColumns.projectCount} > 0`))
    .orderBy(
      desc(sql`(${user.image} is not null)::int + (${profile.headline} is not null)::int`),
      desc(sql`${personColumns.followerCount} * 2 + ${personColumns.projectCount} * 3 + (select count(*) from ${reaction} r join ${project} p on p.id = r.project_id where p.owner_id = ${user.id})`),
    )
    .limit(limit);

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Forsidebildet: det første bildet i det mest festede/nyeste prosjektet med bilder.
  const covers = await db
    .selectDistinctOn([project.ownerId], { ownerId: project.ownerId, url: projectImage.url })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .innerJoin(projectImage, eq(projectImage.projectId, project.id))
    .where(and(inArray(project.ownerId, ids), publicProject()))
    .orderBy(project.ownerId, desc(project.pinned), desc(project.publishedAt), asc(projectImage.position));
  const coverBy = new Map(covers.map((c) => [c.ownerId, c.url]));

  const tagRows = await db
    .select({ ownerId: project.ownerId, name: tag.name, n: sql<number>`count(*)::int` })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .innerJoin(project, eq(project.id, projectTag.projectId))
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(inArray(project.ownerId, ids), publicProject()))
    .groupBy(project.ownerId, tag.name)
    .orderBy(desc(sql`count(*)`));
  const tagsBy = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = tagsBy.get(t.ownerId) ?? [];
    if (list.length < 4) list.push(t.name);
    tagsBy.set(t.ownerId, list);
  }

  return rows.map((r) => ({
    username: r.username,
    name: r.name,
    image: r.image,
    headline: r.headline,
    location: r.location,
    accentColor: (r.accentColor ?? null) as AccentKey | null,
    coverUrl: coverBy.get(r.id) ?? null,
    tags: tagsBy.get(r.id) ?? [],
    projectCount: r.projectCount,
    followerCount: r.followerCount,
  }));
}

// Tall til forsiden.
export async function getPlatformStats() {
  const [row] = await db
    .select({
      people: sql<number>`(select count(*)::int from ${user} where coalesce(${user.banned}, false) = false)`,
      projects: sql<number>`(select count(*)::int from ${project} where ${project.status} = 'published' and ${project.removedAt} is null)`,
      tags: sql<number>`(select count(distinct ${projectTag.tagId})::int from ${projectTag})`,
      follows: sql<number>`(select count(*)::int from ${follow})`,
    })
    .from(user)
    .limit(1);
  return row ?? { people: 0, projects: 0, tags: 0, follows: 0 };
}

/* -------------------------------------------------------------------------- */
/*  Kom i gang                                                                */
/* -------------------------------------------------------------------------- */

export type OnboardingStep = { key: string; label: string; description: string; href: string; done: boolean };

// Stegene en ny bruker bør gjøre. Vises på forsiden og profilen til alt er gjort.
export async function getOnboarding(userId: string, username: string): Promise<OnboardingStep[]> {
  const [row] = await db
    .select({
      image: user.image,
      headline: profile.headline,
      bio: profile.bio,
      readme: profile.readme,
      projects: sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${userId} and ${project.status} = 'published')`,
      cv: sql<number>`(select count(*)::int from ${schema.cvExperience} where ${schema.cvExperience.userId} = ${userId}) + (select count(*)::int from ${schema.cvEducation} where ${schema.cvEducation.userId} = ${userId}) + (select count(*)::int from ${schema.cvDocument} where ${schema.cvDocument.userId} = ${userId})`,
      following: sql<number>`(select count(*)::int from ${follow} where ${follow.followerId} = ${userId})`,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return [];
  return [
    {
      key: "profil",
      label: "Fyll ut visittkortet",
      description: "Bilde, tittel og et par setninger om deg.",
      href: "/profil/rediger",
      done: Boolean(row.image && row.headline && (row.bio || row.readme)),
    },
    {
      key: "cv",
      label: "Importer CV-en",
      description: "Last opp PDF, så fyller vi ut erfaring og utdanning.",
      href: "/profil/rediger/cv",
      done: row.cv > 0,
    },
    {
      key: "prosjekt",
      label: "Del ditt første prosjekt",
      description: "Fra GitHub, en mappe på maskinen eller med bilder.",
      href: "/ny",
      done: row.projects > 0,
    },
    {
      key: "folg",
      label: "Følg noen",
      description: "Da fylles strømmen din med prosjekter du bryr deg om.",
      href: "/sok?type=personer",
      done: row.following > 0,
    },
    {
      key: "del",
      label: "Del profilen",
      description: `vis.no/@${username} – lim den inn i LinkedIn eller søknaden.`,
      href: `/@${username}`,
      done: row.projects > 0 && Boolean(row.headline),
    },
  ];
}
