import "server-only";

import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteStoredFiles, storeImage } from "@/lib/storage";
import { setProjectTags } from "@/lib/tags";
import { UserFacingError } from "@/lib/result";
import type { ProjectInput } from "@/lib/validation";

const { comment, project, projectImage, projectTag, tag, user } = schema;

export const MAX_PROJECT_IMAGES = 8;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/* -------------------------------------------------------------------------- */
/*  Typer som sendes til sidene                                               */
/* -------------------------------------------------------------------------- */

export type ProjectOwner = { id: string; username: string; name: string; image: string | null };
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
  commentCount: number;
};

export type ProjectDetail = ProjectCard & {
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  source: "manual" | "github";
  githubFullName: string | null;
  images: ProjectImage[];
  createdAt: Date;
  updatedAt: Date;
  isOwner: boolean;
};

const cardColumns = {
  id: project.id,
  title: project.title,
  summary: project.summary,
  status: project.status,
  projectDate: project.projectDate,
  publishedAt: project.publishedAt,
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
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  ownerImage: string | null;
};

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

async function loadCommentCounts(projectIds: string[]) {
  const counts = new Map<string, number>();
  if (projectIds.length === 0) return counts;
  const rows = await db
    .select({ projectId: comment.projectId, count: sql<number>`count(*)::int` })
    .from(comment)
    .where(inArray(comment.projectId, projectIds))
    .groupBy(comment.projectId);
  for (const r of rows) counts.set(r.projectId, r.count);
  return counts;
}

async function toCards(rows: CardRow[]): Promise<ProjectCard[]> {
  const ids = rows.map((r) => r.id);
  const [tags, covers, comments] = await Promise.all([loadTags(ids), loadCovers(ids), loadCommentCounts(ids)]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    projectDate: r.projectDate,
    publishedAt: r.publishedAt,
    coverImageUrl: covers.get(r.id) ?? null,
    tags: tags.get(r.id) ?? [],
    commentCount: comments.get(r.id) ?? 0,
    owner: { id: r.ownerId, username: r.ownerUsername, name: r.ownerName, image: r.ownerImage },
  }));
}

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

// Utkast vises bare for eieren.
export async function getProjectById(
  id: string,
  viewerId?: string | null,
): Promise<ProjectDetail | null> {
  if (!isUuid(id)) return null;

  const [row] = await db
    .select({
      ...cardColumns,
      description: project.description,
      repoUrl: project.repoUrl,
      demoUrl: project.demoUrl,
      source: project.source,
      githubFullName: project.githubFullName,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(eq(project.id, id))
    .limit(1);

  if (!row) return null;
  const isOwner = viewerId === row.ownerId;
  if (row.status === "draft" && !isOwner) return null;

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
    description: row.description,
    repoUrl: row.repoUrl,
    demoUrl: row.demoUrl,
    source: row.source,
    githubFullName: row.githubFullName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    images,
    isOwner,
  };
}

// Nyeste publiserte prosjekter. Send inn `nextCursor` fra forrige side for å bla videre.
export async function getLatestProjects({
  limit = 24,
  cursor,
}: { limit?: number; cursor?: string | null } = {}) {
  const take = Math.min(Math.max(limit, 1), 60);
  const conditions = [eq(project.status, "published")];

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

function encodeCursor(publishedAt: Date, id: string) {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string) {
  const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const publishedAt = new Date(iso);
  if (!id || !isUuid(id) || Number.isNaN(publishedAt.getTime())) return null;
  return { publishedAt, id };
}

// Tekstsøk i tittel, ingress og beskrivelse, med valgfritt teknologifilter og
// sortering. "reac nat" finner "React Native". Tom søketekst gir nyeste prosjekter.
export type ProjectSort = "newest" | "az" | "za";

export async function searchProjects(
  query: string,
  { tag: tagSlug, sort = "newest", limit = 48 }: { tag?: string | null; sort?: ProjectSort; limit?: number } = {},
) {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 8);

  const conditions = [eq(project.status, "published")];
  const tsQuery = terms.map((t) => `${t}:*`).join(" & ");
  if (terms.length > 0) conditions.push(sql`${project.searchVector} @@ to_tsquery('simple', ${tsQuery})`);
  if (tagSlug) {
    conditions.push(
      inArray(
        project.id,
        db
          .select({ id: projectTag.projectId })
          .from(projectTag)
          .innerJoin(tag, eq(tag.id, projectTag.tagId))
          .where(eq(tag.slug, tagSlug)),
      ),
    );
  }

  const orderBy =
    sort === "az"
      ? [asc(sql`lower(${project.title})`)]
      : sort === "za"
        ? [desc(sql`lower(${project.title})`)]
        : [
            ...(terms.length > 0
              ? [desc(sql`ts_rank(${project.searchVector}, to_tsquery('simple', ${tsQuery}))`)]
              : []),
            desc(project.publishedAt),
          ];

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
    .where(eq(project.status, "published"))
    .groupBy(tag.id)
    .orderBy(desc(sql`count(*)`), asc(tag.name))
    .limit(limit);
}

export async function getTagBySlug(slug: string) {
  const [row] = await db.select({ slug: tag.slug, name: tag.name }).from(tag).where(eq(tag.slug, slug)).limit(1);
  return row ?? null;
}

// Prosjektene på en profil. Eieren ser også utkastene sine.
export async function getProjectsByOwner(ownerId: string, viewerId?: string | null) {
  const conditions = [eq(project.ownerId, ownerId)];
  if (viewerId !== ownerId) conditions.push(eq(project.status, "published"));

  const rows = await db
    .select(cardColumns)
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${project.projectDate}, '')`), desc(project.createdAt));

  return toCards(rows);
}

/* -------------------------------------------------------------------------- */
/*  Endringer (sjekker alltid at brukeren eier prosjektet)                    */
/* -------------------------------------------------------------------------- */

async function assertOwner(ownerId: string, projectId: string) {
  if (!isUuid(projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  const [row] = await db
    .select({ id: project.id, publishedAt: project.publishedAt })
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
    .select({ id: projectImage.id, key: projectImage.storageKey })
    .from(projectImage)
    .innerJoin(project, eq(project.id, projectImage.projectId))
    .where(and(eq(projectImage.id, imageId), eq(project.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke bildet.");

  await db.delete(projectImage).where(eq(projectImage.id, imageId));
  await deleteStoredFiles([row.key]);
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

