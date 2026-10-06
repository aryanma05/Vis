import "server-only";

import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Tx } from "@/lib/db-types";
import { emailNotification, notify } from "@/lib/notifications";
import { UserFacingError } from "@/lib/result";
import { outer } from "@/lib/sql";

const { notification, profile, project, projectMember, user } = schema;

export type ProjectMember = { id: string; username: string; name: string; image: string | null; headline?: string | null };

const notBanned = sql`coalesce(${user.banned}, false) = false`;

// Medlemmene til ett eller flere prosjekter, i rekkefølgen eieren valgte. Utestengte vises ikke.
export async function loadMembers(projectIds: string[]) {
  const byProject = new Map<string, ProjectMember[]>();
  if (projectIds.length === 0) return byProject;

  const rows = await db
    .select({
      projectId: projectMember.projectId,
      id: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      headline: profile.headline,
    })
    .from(projectMember)
    .innerJoin(user, eq(user.id, projectMember.userId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(and(inArray(projectMember.projectId, projectIds), notBanned))
    .orderBy(asc(projectMember.position), asc(projectMember.createdAt));

  for (const { projectId, ...member } of rows) {
    const list = byProject.get(projectId) ?? [];
    list.push(member);
    byProject.set(projectId, list);
  }
  return byProject;
}

// Erstatter medlemmene med brukernavnene i `usernames`, i den rekkefølgen. Eieren selv
// hoppes over. Finnes ikke et brukernavn, stopper lagringen med en feil, i stedet for at
// personen forsvinner uten at noen merker det.
export async function setProjectMembers(tx: Tx, projectId: string, ownerId: string, usernames: string[]) {
  const found = usernames.length
    ? await tx
        .select({ id: user.id, username: user.username })
        .from(user)
        .where(and(inArray(user.username, usernames), notBanned))
    : [];
  const idByUsername = new Map(found.map((u) => [u.username, u.id]));
  const missing = usernames.find((u) => !idByUsername.has(u));
  if (missing) throw new UserFacingError("Fant ingen på Vis med brukernavnet @{username}.", { username: missing });
  const ids = usernames.flatMap((u) => {
    const id = idByUsername.get(u);
    return id && id !== ownerId ? [id] : [];
  });

  // Beholder datoen for dem som allerede er med, så rekkefølgen bare endrer posisjonen.
  if (ids.length > 0) {
    await tx.delete(projectMember).where(and(eq(projectMember.projectId, projectId), notInArray(projectMember.userId, ids)));
    await tx
      .insert(projectMember)
      .values(ids.map((userId, position) => ({ projectId, userId, position })))
      .onConflictDoUpdate({ target: [projectMember.projectId, projectMember.userId], set: { position: sql`excluded.position` } });
  } else {
    await tx.delete(projectMember).where(eq(projectMember.projectId, projectId));
  }
}

// Gir beskjed til medlemmer som ikke har fått det ennå. Utkast varsles først når de
// publiseres, så ingen får en lenke til et prosjekt de ikke kan åpne. Trygt å kalle flere ganger.
export async function notifyProjectMembers(actorId: string, projectId: string) {
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(project.status, "published"),
        isNull(project.removedAt),
        sql`not exists (select 1 from ${notification} where ${notification.userId} = ${outer(projectMember.userId)} and ${notification.projectId} = ${outer(projectMember.projectId)} and ${notification.type} = 'member')`,
      ),
    );

  for (const { userId } of rows) {
    await notify({ userId, actorId, type: "member", projectId });
    void emailNotification({ userId, actorId, type: "member", projectId });
  }
}

// Et medlem tar seg selv av prosjektet.
export async function leaveProject(userId: string, projectId: string) {
  const removed = await db
    .delete(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .returning({ projectId: projectMember.projectId });
  if (removed.length === 0) throw new UserFacingError("Du er ikke med på dette prosjektet.");
}
