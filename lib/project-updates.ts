import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";

const { project, projectUpdate } = schema;

export const UPDATE_MAX = 2000;

// Oppdateringer på et prosjekt, nyeste først («Versjon 2 er ute», «Lagt til mørk modus»).
export async function listProjectUpdates(projectId: string) {
  if (!isUuid(projectId)) return [];
  return db
    .select({ id: projectUpdate.id, body: projectUpdate.body, createdAt: projectUpdate.createdAt })
    .from(projectUpdate)
    .where(eq(projectUpdate.projectId, projectId))
    .orderBy(desc(projectUpdate.createdAt))
    .limit(50);
}

async function assertOwner(ownerId: string, projectId: string) {
  if (!isUuid(projectId)) throw new UserFacingError("Fant ikke prosjektet.");
  const [row] = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke prosjektet.");
}

export async function addProjectUpdate(ownerId: string, projectId: string, body: string) {
  const text = body.trim();
  if (text.length < 3) throw new UserFacingError("Skriv hva som er nytt.");
  if (text.length > UPDATE_MAX) throw new UserFacingError("Oppdateringen kan være maks {n} tegn.", { n: UPDATE_MAX });
  await assertOwner(ownerId, projectId);
  await enforce("projectUpdate", ownerId);
  const [row] = await db.insert(projectUpdate).values({ projectId, body: text }).returning();
  // Prosjektet regnes som endret, så det havner riktig i «sist oppdatert».
  await db.update(project).set({ updatedAt: new Date() }).where(eq(project.id, projectId));
  return row;
}

export async function deleteProjectUpdate(ownerId: string, updateId: string) {
  if (!isUuid(updateId)) return null;
  const [row] = await db
    .select({ projectId: projectUpdate.projectId })
    .from(projectUpdate)
    .innerJoin(project, eq(project.id, projectUpdate.projectId))
    .where(and(eq(projectUpdate.id, updateId), eq(project.ownerId, ownerId)))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke oppdateringen.");
  await db.delete(projectUpdate).where(eq(projectUpdate.id, updateId));
  return row.projectId;
}
