import "server-only";

import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid, getProjectCardsByIds, publicProject } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";

const { collection, collectionItem, project, user } = schema;

export const MAX_COLLECTIONS = 50;
export const MAX_COLLECTION_ITEMS = 200;

export type CollectionInput = { title: string; description?: string | null; isPublic?: boolean };

function clean(input: CollectionInput) {
  const title = input.title?.trim().slice(0, 80) ?? "";
  if (!title) throw new UserFacingError("Samlingen må ha et navn.");
  return { title, description: input.description?.trim().slice(0, 500) || null, isPublic: Boolean(input.isPublic) };
}

// Mine samlinger, med antall prosjekter og om et bestemt prosjekt allerede ligger der.
export async function listOwnCollections(userId: string, projectId?: string | null) {
  const rows = await db
    .select({
      id: collection.id,
      title: collection.title,
      isPublic: collection.isPublic,
      updatedAt: collection.updatedAt,
      items: sql<number>`(select count(*)::int from ${collectionItem} where ${collectionItem.collectionId} = ${collection.id})`,
      hasProject:
        projectId && isUuid(projectId)
          ? sql<boolean>`exists (select 1 from ${collectionItem} where ${collectionItem.collectionId} = ${collection.id} and ${collectionItem.projectId} = ${projectId})`
          : sql<boolean>`false`,
    })
    .from(collection)
    .where(eq(collection.ownerId, userId))
    .orderBy(desc(collection.updatedAt));
  return rows;
}

export async function createCollection(userId: string, input: CollectionInput) {
  const fields = clean(input);
  await enforce("collection", userId);
  const [{ n }] = await db.select({ n: count() }).from(collection).where(eq(collection.ownerId, userId));
  if (n >= MAX_COLLECTIONS) throw new UserFacingError("Du kan ha opptil {n} samlinger.", { n: MAX_COLLECTIONS });
  const [row] = await db.insert(collection).values({ ownerId: userId, ...fields }).returning({ id: collection.id });
  return row.id;
}

export async function updateCollection(userId: string, id: string, input: CollectionInput) {
  if (!isUuid(id)) throw new UserFacingError("Fant ikke samlingen.");
  const updated = await db
    .update(collection)
    .set(clean(input))
    .where(and(eq(collection.id, id), eq(collection.ownerId, userId)))
    .returning({ id: collection.id });
  if (updated.length === 0) throw new UserFacingError("Fant ikke samlingen.");
}

export async function deleteCollection(userId: string, id: string) {
  if (!isUuid(id)) return;
  await db.delete(collection).where(and(eq(collection.id, id), eq(collection.ownerId, userId)));
}

// Legger til eller fjerner et prosjekt. Bare offentlige prosjekter (og egne) kan lagres.
export async function setCollectionItem(userId: string, collectionId: string, projectId: string, on: boolean) {
  if (!isUuid(collectionId) || !isUuid(projectId)) throw new UserFacingError("Fant ikke samlingen.");
  await enforce("collection", userId);
  const [owned] = await db
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.id, collectionId), eq(collection.ownerId, userId)))
    .limit(1);
  if (!owned) throw new UserFacingError("Fant ikke samlingen.");

  if (!on) {
    await db.delete(collectionItem).where(and(eq(collectionItem.collectionId, collectionId), eq(collectionItem.projectId, projectId)));
  } else {
    const [visible] = await db
      .select({ id: project.id })
      .from(project)
      .innerJoin(user, eq(user.id, project.ownerId))
      .where(and(eq(project.id, projectId), sql`(${publicProject()} or ${project.ownerId} = ${userId})`))
      .limit(1);
    if (!visible) throw new UserFacingError("Fant ikke prosjektet.");
    const [{ n }] = await db.select({ n: count() }).from(collectionItem).where(eq(collectionItem.collectionId, collectionId));
    if (n >= MAX_COLLECTION_ITEMS) throw new UserFacingError("En samling kan ha opptil {n} prosjekter.", { n: MAX_COLLECTION_ITEMS });
    await db.insert(collectionItem).values({ collectionId, projectId }).onConflictDoNothing();
  }
  await db.update(collection).set({ updatedAt: new Date() }).where(eq(collection.id, collectionId));
}

// En samling med prosjektene. Private samlinger vises bare for eieren, og prosjekter
// som ikke lenger er offentlige hoppes over.
export async function getCollection(id: string, viewerId?: string | null) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      isPublic: collection.isPublic,
      updatedAt: collection.updatedAt,
      ownerId: collection.ownerId,
      owner: { name: user.name, username: user.username, image: user.image, banned: user.banned },
    })
    .from(collection)
    .innerJoin(user, eq(user.id, collection.ownerId))
    .where(eq(collection.id, id))
    .limit(1);
  if (!row || row.owner.banned) return null;
  const isOwner = viewerId === row.ownerId;
  if (!row.isPublic && !isOwner) return null;

  const items = await db
    .select({ projectId: collectionItem.projectId })
    .from(collectionItem)
    .where(eq(collectionItem.collectionId, id))
    .orderBy(desc(collectionItem.addedAt));
  const projects = await getProjectCardsByIds(items.map((i) => i.projectId));
  return { ...row, isOwner, projects };
}

// Offentlige samlinger på en profil, med de første forsidebildene som forhåndsvisning.
export async function listPublicCollections(ownerId: string) {
  const rows = await db
    .select({ id: collection.id, title: collection.title, description: collection.description, updatedAt: collection.updatedAt })
    .from(collection)
    .where(and(eq(collection.ownerId, ownerId), eq(collection.isPublic, true)))
    .orderBy(desc(collection.updatedAt));
  if (rows.length === 0) return [];
  const items = await db
    .select({ collectionId: collectionItem.collectionId, projectId: collectionItem.projectId })
    .from(collectionItem)
    .where(inArray(collectionItem.collectionId, rows.map((r) => r.id)))
    .orderBy(desc(collectionItem.addedAt));
  const cards = await getProjectCardsByIds([...new Set(items.map((i) => i.projectId))]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  return rows.map((r) => {
    const projects = items.filter((i) => i.collectionId === r.id).flatMap((i) => byId.get(i.projectId) ?? []);
    return { ...r, count: projects.length, covers: projects.slice(0, 3).map((p) => p.coverImageUrl) };
  });
}

export async function countPublicCollections(ownerId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(collection)
    .where(and(eq(collection.ownerId, ownerId), eq(collection.isPublic, true)));
  return n;
}
