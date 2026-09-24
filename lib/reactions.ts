import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { REACTION_TYPES, type ReactionType } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { project, reaction, user } = schema;

export type ReactionSummary = { counts: Record<ReactionType, number>; mine: ReactionType[] };

export async function getReactionSummary(projectId: string, viewerId?: string | null): Promise<ReactionSummary> {
  const rows = await db
    .select({ type: reaction.type, count: sql<number>`count(*)::int`, mine: sql<boolean>`bool_or(${reaction.userId} = ${viewerId ?? ""})` })
    .from(reaction)
    .where(eq(reaction.projectId, projectId))
    .groupBy(reaction.type);
  const counts = Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<ReactionType, number>;
  const mine: ReactionType[] = [];
  for (const r of rows) {
    counts[r.type] = r.count;
    if (r.mine) mine.push(r.type);
  }
  return { counts, mine };
}

// Slår en reaksjon av eller på. Returnerer oppdatert oppsummering.
export async function toggleReaction(userId: string, projectId: string, type: ReactionType) {
  if (!isUuid(projectId) || !REACTION_TYPES.includes(type)) throw new UserFacingError("Ugyldig reaksjon.");

  const [target] = await db
    .select({ ownerId: project.ownerId, status: project.status, removedAt: project.removedAt, ownerBanned: user.banned })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(eq(project.id, projectId))
    .limit(1);
  if (!target || target.status !== "published" || target.removedAt || target.ownerBanned) {
    throw new UserFacingError("Fant ikke prosjektet.");
  }

  const removed = await db
    .delete(reaction)
    .where(and(eq(reaction.projectId, projectId), eq(reaction.userId, userId), eq(reaction.type, type)))
    .returning({ type: reaction.type });

  if (removed.length === 0) {
    await db.insert(reaction).values({ projectId, userId, type }).onConflictDoNothing();
    await notify({ userId: target.ownerId, actorId: userId, type: "reaction", projectId, data: { reaction: type } });
  }

  return getReactionSummary(projectId, userId);
}
