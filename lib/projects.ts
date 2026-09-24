import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteStoredFiles, storeImage } from "@/lib/storage";
import { tagSlug } from "@/lib/tag-names";
import { setProjectTags } from "@/lib/tags";
import { UserFacingError } from "@/lib/result";
import type { ProjectInput } from "@/lib/validation";

const { comment, follow, project, projectImage, projectTag, projectViewDay, reaction, tag, user, profile } = schema;

export const MAX_PROJECT_IMAGES = 8;
export const MAX_PINNED = 6;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/* -------------------------------------------------------------------------- */
/*  Typer som sendes til sidene                                               */
/* -------------------------------------------------------------------------- */

export type ProjectOwner = { id: string; username: string; name: string; image: string | null; headline?: string | null };
export type ProjectTag = { slug: string; name: string };
export type ProjectImage = { id: string; url: string; alt: string | null };

export type ProjectCard = {
  id: string;
  title: string;
  summary: string | null;
  coverImageUrl: string | null;
  tags: ProjectTag[];
  owner: ProjectOwner;
  status: "draft" | "published";
  projectDate: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  pinned: boolean;
  removed: boolean;
  commentCount: number;
  reactionCount: number;
  viewCount: number;
};

export type ProjectDetail = ProjectCard & {
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  role: string | null;
  source: "manual" | "github";
  githubFullName: string | null;
  images: ProjectImage[];
  updatedAt: Date;
  removedReason: string | null;
  isOwner: boolean;
};

const cardColumns = {
  id: project.id,
  title: project.title,
  summary: project.summary,
  status: project.status,
  projectDate: project.projectDate,
  publishedAt: project.publishedAt,
  createdAt: project.createdAt,
  pinned: project.pinned,
  removedAt: project.removedAt,
  viewCount: project.viewCount,
  ownerId: user.id,
  ownerUsername: user.username,
  ownerName: user.name,
  ownerImage: user.image,
};

type CardRow = {
  id: string;
  title: string;
  summary: string | null;
  status: "draft" | "published";
  projectDate: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  pinned: boolean;
  removedAt: Date | null;
  viewCount: number;
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  ownerImage: string | null;
};

// Det alle kan se: publisert, ikke fjernet av en moderator, og eieren er ikke utestengt.
export const publicProject = (): SQL =>
  and(eq(project.status, "published"), isNull(project.removedAt), sql`coalesce(${user.banned}, false) = false`)!;

async function loadTags(projectIds: string[]) {
  const byProject = new Map<string, ProjectTag[]>();
  if (projectIds.length === 0) return byProject;

  const rows = await db
    .select({ projectId: projectTag.projectId, slug: tag.slug, name: tag.name })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .where(inArray(projectTag.projectId, projectIds))
    .orderBy(asc(projectTag.position));

  for (const r of rows) {
    const list = byProject.get(r.projectId) ?? [];
    list.push({ slug: r.slug, name: r.name });
    byProject.set(r.projectId, list);
  }
  return byProject;
}

async function loadCovers(projectIds: string[]) {
  const covers = new Map<string, string>();
  if (projectIds.length === 0) return covers;

  const rows = await db
    .selectDistinctOn([projectImage.projectId], {
      projectId: projectImage.projectId,
      url: projectImage.url,
    })
    .from(projectImage)
    .where(inArray(projectImage.projectId, projectIds))
    .orderBy(projectImage.projectId, asc(projectImage.position), asc(projectImage.createdAt));

  for (const r of rows) covers.set(r.projectId, r.url);
  return covers;
}

async function countBy(table: typeof comment | typeof reaction, projectIds: string[]) {
  const counts = new Map<string, number>();
  if (projectIds.length === 0) return counts;
  const rows = await db
    .select({ projectId: table.projectId, count: sql<number>`count(*)::int` })
    .from(table)
    .where(inArray(table.projectId, projectIds))
    .groupBy(table.projectId);
  for (const r of rows) counts.set(r.projectId, r.count);
  return counts;
}

async function toCards(rows: CardRow[]): Promise<ProjectCard[]> {
  const ids = rows.map((r) => r.id);
  const [tags, covers, comments, reactions] = await Promise.all([
    loadTags(ids),
    loadCovers(ids),
    countBy(comment, ids),
    countBy(reaction, ids),
  ]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    projectDate: r.projectDate,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    pinned: r.pinned,
    removed: r.removedAt !== null,
    viewCount: r.viewCount,
    coverImageUrl: covers.get(r.id) ?? null,
    tags: tags.get(r.id) ?? [],
    commentCount: comments.get(r.id) ?? 0,
    reactionCount: reactions.get(r.id) ?? 0,
    owner: { id: r.ownerId, username: r.ownerUsername, name: r.ownerName, image: r.ownerImage },
  }));
}

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

// Utkast og fjernede prosjekter vises bare for eieren (og for admin, med `asAdmin`).
export async function getProjectById(
  id: string,
  viewerId?: string | null,
  { asAdmin = false }: { asAdmin?: boolean } = {},
): Promise<ProjectDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select({
      ...cardColumns,
      ownerBanned: user.banned,
      ownerHeadline: profile.headline,
      description: project.description,
      repoUrl: project.repoUrl,
      demoUrl: project.demoUrl,
      videoUrl: project.videoUrl,
      role: project.role,
      source: project.source,
      githubFullName: project.githubFullName,
      removedReason: project.removedReason,
      updatedAt: project.updatedAt,
    })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .leftJoin(profile, eq(profile.userId, project.ownerId))
    .where(eq(project.id, id))
    .limit(1);

  if (!row) return null;
  const isOwner = viewerId === row.ownerId;
  const hidden = row.status === "draft" || row.removedAt !== null || Boolean(row.ownerBanned);
  if (hidden && !isOwner && !asAdmin) return null;

  const [[card], images] = await Promise.all([
    toCards([row]),
    db
      .select({ id: projectImage.id, url: projectImage.url, alt: projectImage.alt })
      .from(projectImage)
      .where(eq(projectImage.projectId, id))
      .orderBy(asc(projectImage.position), asc(projectImage.createdAt)),
  ]);

  return {
    ...card,
    owner: { ...card.owner, headline: row.ownerHeadline },
    description: row.description,
    repoUrl: row.repoUrl,
    demoUrl: row.demoUrl,
    videoUrl: row.videoUrl,
    role: row.role,
    source: row.source,
    githubFullName: row.githubFullName,
    removedReason: row.removedReason,
    updatedAt: row.updatedAt,
    images,
    isOwner,
  };
}

function encodeCursor(publishedAt: Date, id: string) {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string) {
  const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const publishedAt = new Date(iso);
  if (!id || !isUuid(id) || Number.isNaN(publishedAt.getTime())) return null;
  return { publishedAt, id };
}

async function pageByPublished(conditions: SQL[], { limit = 24, cursor }: { limit?: number; cursor?: string | null }) {
  const take = Math.min(Math.max(limit, 1), 60);
  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded) {
    conditions.push(
      or(
        lt(project.publishedAt, decoded.publishedAt),
        and(eq(project.publishedAt, decoded.publishedAt), lt(project.id, decoded.id)),
      )!,
    );
  }

  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(...conditions))
    .orderBy(desc(project.publishedAt), desc(project.id))
    .limit(take + 1);

  const page = rows.slice(0, take);
  const last = page.at(-1);
  return {
    projects: await toCards(page),
    nextCursor: rows.length > take && last?.publishedAt ? encodeCursor(last.publishedAt, last.id) : null,
  };
}

// Nyeste publiserte prosjekter. Send inn `nextCursor` fra forrige side for å bla videre.
export async function getLatestProjects(options: { limit?: number; cursor?: string | null } = {}) {
  return pageByPublished([publicProject()], options);
}

// Nye prosjekter fra folk brukeren følger.
export async function getFollowingProjects(viewerId: string, options: { limit?: number; cursor?: string | null } = {}) {
  return pageByPublished(
    [
      publicProject(),
      inArray(project.ownerId, db.select({ id: follow.followingId }).from(follow).where(eq(follow.followerId, viewerId))),
    ],
    options,
  );
}

// «Trender»: engasjement de siste 30 dagene (reaksjoner, kommentarer og visninger),
// delt på alderen slik at nye prosjekter med mye aktivitet havner øverst.
export async function getTrendingProjects({ limit = 12, excludeOwnerId }: { limit?: number; excludeOwnerId?: string } = {}) {
  const reactions = db
    .select({ projectId: reaction.projectId, reactionCount: sql<number>`count(*)::int`.as("trend_reactions") })
    .from(reaction)
    .where(sql`${reaction.createdAt} > now() - interval '30 days'`)
    .groupBy(reaction.projectId)
    .as("r");
  const comments = db
    .select({ projectId: comment.projectId, commentCount: sql<number>`count(*)::int`.as("trend_comments") })
    .from(comment)
    .where(sql`${comment.createdAt} > now() - interval '30 days'`)
    .groupBy(comment.projectId)
    .as("c");
  const views = db
    .select({ projectId: projectViewDay.projectId, viewSum: sql<number>`sum(${projectViewDay.views})::int`.as("trend_views") })
    .from(projectViewDay)
    .where(sql`${projectViewDay.day} > current_date - 30`)
    .groupBy(projectViewDay.projectId)
    .as("v");

  const score = sql<number>`(coalesce(${reactions.reactionCount}, 0) * 3 + coalesce(${comments.commentCount}, 0) * 4 + coalesce(${views.viewSum}, 0) * 0.2 + 1)
    / power(extract(epoch from (now() - ${project.publishedAt})) / 3600 + 2, 1.15)`;

  const conditions = [publicProject()];
  if (excludeOwnerId) conditions.push(ne(project.ownerId, excludeOwnerId));

  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .leftJoin(reactions, eq(reactions.projectId, project.id))
    .leftJoin(comments, eq(comments.projectId, project.id))
    .leftJoin(views, eq(views.projectId, project.id))
    .where(and(...conditions))
    .orderBy(desc(score), desc(project.publishedAt))
    .limit(Math.min(limit, 60));

  return toCards(rows);
}

// Tekstsøk i tittel, ingress, beskrivelse (README), teknologier og hvem som laget det.
// "reac nat" finner "React Native". Tom søketekst gir nyeste prosjekter.
export type ProjectSort = "relevant" | "newest" | "trending" | "popular" | "discussed" | "az";

export async function searchProjects(
  query: string,
  { tag: tagFilter, sort = "relevant", limit = 48 }: { tag?: string | null; sort?: ProjectSort; limit?: number } = {},
) {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);

  if (sort === "trending" && terms.length === 0 && !tagFilter) return getTrendingProjects({ limit });

  const conditions: SQL[] = [publicProject()];
  const tsQuery = terms.map((t) => `${t.replace(/'/g, "")}:*`).join(" & ");
  const textMatch = terms.length > 0 ? sql`${project.searchVector} @@ to_tsquery('simple', ${tsQuery})` : null;

  if (terms.length > 0) {
    const like = `%${query.trim().toLowerCase()}%`;
    const tagPatterns = terms.map((t) => `${tagSlug(t)}%`).filter((p) => p !== "%");
    const tagMatch = tagPatterns.length
      ? sql`exists (select 1 from ${projectTag} pt join ${tag} t on t.id = pt.tag_id where pt.project_id = ${project.id} and (${sql.join(
          tagPatterns.map((p) => sql`t.slug like ${p}`),
          sql` or `,
        )}))`
      : sql`false`;
    conditions.push(or(textMatch!, tagMatch, sql`lower(${user.name}) like ${like}`, sql`${user.username} like ${like}`)!);
  }
  if (tagFilter) {
    conditions.push(
      inArray(
        project.id,
        db
          .select({ id: projectTag.projectId })
          .from(projectTag)
          .innerJoin(tag, eq(tag.id, projectTag.tagId))
          .where(eq(tag.slug, tagFilter)),
      ),
    );
  }

  const reactionCount = sql`(select count(*) from ${reaction} where ${reaction.projectId} = ${project.id})`;
  const commentCount = sql`(select count(*) from ${comment} where ${comment.projectId} = ${project.id})`;

  const orderBy =
    sort === "az"
      ? [asc(sql`lower(${project.title})`)]
      : sort === "popular"
        ? [desc(sql`${reactionCount} * 3 + ${project.viewCount} * 0.1`), desc(project.publishedAt)]
        : sort === "discussed"
          ? [desc(commentCount), desc(project.publishedAt)]
          : sort === "relevant" && textMatch
            ? [desc(sql`ts_rank(${project.searchVector}, to_tsquery('simple', ${tsQuery}))`), desc(project.publishedAt)]
            : [desc(project.publishedAt)];

  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(Math.min(limit, 60));

  return toCards(rows);
}

// Teknologiene flest publiserte prosjekter bruker.
export async function getPopularTags(limit = 16) {
  return db
    .select({ slug: tag.slug, name: tag.name, count: sql<number>`count(*)::int` })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .innerJoin(project, eq(project.id, projectTag.projectId))
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(publicProject())
    .groupBy(tag.id)
    .orderBy(desc(sql`count(*)`), asc(tag.name))
    .limit(limit);
}

export async function getTagBySlug(slug: string) {
  const [row] = await db.select({ slug: tag.slug, name: tag.name }).from(tag).where(eq(tag.slug, slug)).limit(1);
  return row ?? null;
}

// Teknologier som ofte brukes sammen med en gitt teknologi.
export async function getRelatedTags(slug: string, limit = 10) {
  const withTag = db
    .select({ id: projectTag.projectId })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .where(eq(tag.slug, slug));
  return db
    .select({ slug: tag.slug, name: tag.name, count: sql<number>`count(*)::int` })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .innerJoin(project, eq(project.id, projectTag.projectId))
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(publicProject(), inArray(projectTag.projectId, withTag), ne(tag.slug, slug)))
    .groupBy(tag.id)
    .orderBy(desc(sql`count(*)`), asc(tag.name))
    .limit(limit);
}

// Folk som har laget flest prosjekter med en teknologi.
export async function getTopCreatorsForTag(slug: string, limit = 6) {
  return db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      headline: profile.headline,
      count: sql<number>`count(*)::int`,
    })
    .from(projectTag)
    .innerJoin(tag, eq(tag.id, projectTag.tagId))
    .innerJoin(project, eq(project.id, projectTag.projectId))
    .innerJoin(user, eq(user.id, project.ownerId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(publicProject(), eq(tag.slug, slug)))
    .groupBy(user.id, profile.headline)
    .orderBy(desc(sql`count(*)`), asc(user.name))
    .limit(limit);
}

// Prosjektene på en profil. Eieren ser også utkastene og fjernede prosjekter sine.
// Festede prosjekter først.
export async function getProjectsByOwner(ownerId: string, viewerId?: string | null) {
  const conditions: SQL[] = [eq(project.ownerId, ownerId)];
  if (viewerId !== ownerId) conditions.push(publicProject());

  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(...conditions))
    .orderBy(desc(project.pinned), desc(sql`coalesce(${project.projectDate}, '')`), desc(project.createdAt));

  return toCards(rows);
}

// «Mer fra …» på prosjektsiden.
export async function getMoreFromOwner(ownerId: string, excludeId: string, limit = 3) {
  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(publicProject(), eq(project.ownerId, ownerId), ne(project.id, excludeId)))
    .orderBy(desc(project.pinned), desc(project.publishedAt))
    .limit(limit);
  return toCards(rows);
}

// Prosjekter fra andre som bruker de samme teknologiene.
export async function getRelatedProjects(projectId: string, ownerId: string, tagSlugs: string[], limit = 3) {
  if (tagSlugs.length === 0) return [];
  const shared = sql<number>`(select count(*) from ${projectTag} pt join ${tag} t on t.id = pt.tag_id where pt.project_id = ${project.id} and t.slug in ${tagSlugs})`;
  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(publicProject(), ne(project.id, projectId), ne(project.ownerId, ownerId), sql`${shared} > 0`))
    .orderBy(desc(shared), desc(project.publishedAt))
    .limit(limit);
  return toCards(rows);
}

/* -------------------------------------------------------------------------- */
/*  Endringer (sjekker alltid at brukeren eier prosjektet)                    */
/* -------------------------------------------------------------------------- */

async function assertOwner(ownerId: string, projectId: string) {
  if (!isUuid(projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  const [row] = await db
    .select({ id: project.id, publishedAt: project.publishedAt, removedAt: project.removedAt })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke prosjektet.");
  return row;
}

export async function createProject(
  ownerId: string,
  input: ProjectInput,
  github?: { repoId: number; fullName: string },
) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(project)
      .values({
        ownerId,
        title: input.title,
        summary: input.summary,
        description: input.description,
        repoUrl: input.repoUrl,
        demoUrl: input.demoUrl,
        videoUrl: input.videoUrl,
        role: input.role,
        projectDate: input.projectDate,
        status: input.status,
        publishedAt: input.status === "published" ? new Date() : null,
        source: github ? "github" : "manual",
        githubRepoId: github?.repoId,
        githubFullName: github?.fullName,
        githubSyncedAt: github ? new Date() : null,
      })
      .returning({ id: project.id });

    await setProjectTags(tx, created.id, input.tags);
    return created.id;
  });
}

export async function updateProject(ownerId: string, projectId: string, input: ProjectInput) {
  const existing = await assertOwner(ownerId, projectId);

  await db.transaction(async (tx) => {
    await tx
      .update(project)
      .set({
        title: input.title,
        summary: input.summary,
        description: input.description,
        repoUrl: input.repoUrl,
        demoUrl: input.demoUrl,
        videoUrl: input.videoUrl,
        role: input.role,
        projectDate: input.projectDate,
        status: input.status,
        // Beholder opprinnelig publiseringsdato hvis prosjektet publiseres på nytt.
        publishedAt:
          input.status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      })
      .where(eq(project.id, projectId));

    await setProjectTags(tx, projectId, input.tags);
  });
}

export async function setProjectStatus(
  ownerId: string,
  projectId: string,
  status: "draft" | "published",
) {
  const existing = await assertOwner(ownerId, projectId);
  await db
    .update(project)
    .set({
      status,
      publishedAt: status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    })
    .where(eq(project.id, projectId));
}

export async function setProjectPinned(ownerId: string, projectId: string, pinned: boolean) {
  await assertOwner(ownerId, projectId);
  if (pinned) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(project)
      .where(and(eq(project.ownerId, ownerId), eq(project.pinned, true), ne(project.id, projectId)));
    if (count >= MAX_PINNED) throw new UserFacingError(`Du kan feste maks ${MAX_PINNED} prosjekter.`);
  }
  await db.update(project).set({ pinned }).where(eq(project.id, projectId));
}

export async function deleteProject(ownerId: string, projectId: string) {
  await assertOwner(ownerId, projectId);

  const images = await db
    .select({ key: projectImage.storageKey })
    .from(projectImage)
    .where(eq(projectImage.projectId, projectId));

  await db.delete(project).where(and(eq(project.id, projectId), eq(project.ownerId, ownerId)));
  await deleteStoredFiles(images.map((i) => i.key));
}

/* -------------------------------------------------------------------------- */
/*  Bilder                                                                    */
/* -------------------------------------------------------------------------- */

async function countImages(projectId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectImage)
    .where(eq(projectImage.projectId, projectId));
  return count;
}

async function nextImagePosition(projectId: string) {
  const [{ max }] = await db
    .select({ max: sql<number | null>`max(${projectImage.position})` })
    .from(projectImage)
    .where(eq(projectImage.projectId, projectId));
  return (max ?? -1) + 1;
}

export async function addProjectImages(ownerId: string, projectId: string, files: File[]) {
  await assertOwner(ownerId, projectId);

  const existing = await countImages(projectId);
  if (existing + files.length > MAX_PROJECT_IMAGES) {
    throw new UserFacingError(`Et prosjekt kan ha maks ${MAX_PROJECT_IMAGES} bilder.`);
  }

  // Last opp alle først, så vi ikke ender med halvveis lagrede prosjekter.
  const results = await Promise.allSettled(files.map((f) => storeImage(f, `projects/${projectId}`, { ownerId })));
  const stored = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    await deleteStoredFiles(stored.map((s) => s.key));
    throw failed.reason;
  }
  let position = await nextImagePosition(projectId);

  try {
    return await db
      .insert(projectImage)
      .values(stored.map((s) => ({ projectId, url: s.url, storageKey: s.key, position: position++ })))
      .returning({ id: projectImage.id, url: projectImage.url, alt: projectImage.alt });
  } catch (error) {
    await deleteStoredFiles(stored.map((s) => s.key));
    throw error;
  }
}

// For bilder som allerede ligger på nett, f.eks. fra en GitHub-README.
export async function addExternalProjectImages(
  projectId: string,
  images: { url: string; alt?: string | null }[],
) {
  if (images.length === 0) return;
  let position = await nextImagePosition(projectId);
  await db.insert(projectImage).values(
    images.slice(0, MAX_PROJECT_IMAGES).map((img) => ({
      projectId,
      url: img.url,
      alt: img.alt ?? null,
      position: position++,
    })),
  );
}

export async function deleteProjectImage(ownerId: string, imageId: string) {
  if (!isUuid(imageId)) throw new UserFacingError("Fant ikke bildet.");

  const [row] = await db
    .select({ id: projectImage.id, key: projectImage.storageKey, projectId: projectImage.projectId })
    .from(projectImage)
    .innerJoin(project, eq(project.id, projectImage.projectId))
    .where(and(eq(projectImage.id, imageId), eq(project.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke bildet.");

  await db.delete(projectImage).where(eq(projectImage.id, imageId));
  await deleteStoredFiles([row.key]);
  return row.projectId;
}

// imageIds i ønsket rekkefølge. Det første blir forsidebildet.
export async function reorderProjectImages(ownerId: string, projectId: string, imageIds: string[]) {
  await assertOwner(ownerId, projectId);

  const current = await db
    .select({ id: projectImage.id })
    .from(projectImage)
    .where(eq(projectImage.projectId, projectId));
  const currentIds = new Set(current.map((c) => c.id));

  if (imageIds.length !== currentIds.size || !imageIds.every((id) => currentIds.has(id))) {
    throw new UserFacingError("Bildelisten stemmer ikke med prosjektet.");
  }

  await db.transaction(async (tx) => {
    for (const [position, id] of imageIds.entries()) {
      await tx.update(projectImage).set({ position }).where(eq(projectImage.id, id));
    }
  });
}

export async function updateImageAlt(ownerId: string, imageId: string, alt: string | null) {
  if (!isUuid(imageId)) throw new UserFacingError("Fant ikke bildet.");
  const result = await db
    .update(projectImage)
    .set({ alt: alt?.trim().slice(0, 300) || null })
    .where(
      and(
        eq(projectImage.id, imageId),
        inArray(
          projectImage.projectId,
          db.select({ id: project.id }).from(project).where(eq(project.ownerId, ownerId)),
        ),
      ),
    )
    .returning({ id: projectImage.id });
  if (result.length === 0) throw new UserFacingError("Fant ikke bildet.");
}

// Brukes av GitHub-importen for å unngå duplikater.
export async function findProjectByGithubRepo(ownerId: string, repoId: number) {
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.ownerId, ownerId), eq(project.githubRepoId, repoId)))
    .limit(1);
  return row?.id ?? null;
}

export async function getImportedRepoIds(ownerId: string) {
  const rows = await db
    .select({ repoId: project.githubRepoId })
    .from(project)
    .where(and(eq(project.ownerId, ownerId), sql`${project.githubRepoId} is not null`));
  return new Set(rows.map((r) => r.repoId!));
}
