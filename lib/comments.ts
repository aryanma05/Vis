import "server-only";

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { comment, notification, project, user } = schema;

export const MAX_COMMENT_LENGTH = 2000;
const MAX_COMMENTS_PER_HOUR = 30;

export type ProjectComment = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { id: string; username: string; name: string; image: string | null };
  canEdit: boolean;
  canDelete: boolean;
};

function cleanBody(body: string) {
  const text = body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new UserFacingError("Kommentaren er tom.");
  if (text.length > MAX_COMMENT_LENGTH) throw new UserFacingError(`Maks ${MAX_COMMENT_LENGTH} tegn.`);
  return text;
}

// Prosjektet må finnes og være synlig for brukeren (publisert, eller eget utkast).
async function visibleProject(projectId: string, viewerId?: string | null) {
  if (!isUuid(projectId)) return null;
  const [row] = await db
    .select({ id: project.id, ownerId: project.ownerId, status: project.status })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (!row || (row.status === "draft" && row.ownerId !== viewerId)) return null;
  return row;
}

export async function listComments(projectId: string, viewerId?: string | null): Promise<ProjectComment[]> {
  const proj = await visibleProject(projectId, viewerId);
  if (!proj) return [];

  const rows = await db
    .select({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      authorId: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(eq(comment.projectId, projectId))
    .orderBy(asc(comment.createdAt));

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    editedAt: r.editedAt,
    author: { id: r.authorId, username: r.username, name: r.name, image: r.image },
    canEdit: viewerId === r.authorId,
    // Prosjekteieren kan fjerne kommentarer på sitt eget prosjekt.
    canDelete: viewerId === r.authorId || viewerId === proj.ownerId,
  }));
}

export async function addComment(authorId: string, projectId: string, body: string) {
  const proj = await visibleProject(projectId, authorId);
  if (!proj) throw new UserFacingError("Fant ikke prosjektet.");
  const text = cleanBody(body);

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(comment)
    .where(and(eq(comment.authorId, authorId), gte(comment.createdAt, sql`now() - interval '1 hour'`)));
  if (recent >= MAX_COMMENTS_PER_HOUR) {
    throw new UserFacingError("Du har skrevet mange kommentarer på kort tid. Vent litt.");
  }

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(comment).values({ projectId, authorId, body: text }).returning({ id: comment.id });
    if (proj.ownerId !== authorId) {
      await tx.insert(notification).values({
        userId: proj.ownerId,
        actorId: authorId,
        type: "comment",
        projectId,
        commentId: created.id,
      });
    }
    return created.id;
  });
}

export async function editComment(authorId: string, commentId: string, body: string) {
  if (!isUuid(commentId)) throw new UserFacingError("Fant ikke kommentaren.");
  const text = cleanBody(body);
  const updated = await db
    .update(comment)
    .set({ body: text, editedAt: new Date() })
    .where(and(eq(comment.id, commentId), eq(comment.authorId, authorId)))
    .returning({ projectId: comment.projectId });
  if (updated.length === 0) throw new UserFacingError("Fant ikke kommentaren.");
  return updated[0].projectId;
}

export async function deleteComment(userId: string, commentId: string) {
  if (!isUuid(commentId)) throw new UserFacingError("Fant ikke kommentaren.");
  const [row] = await db
    .select({ authorId: comment.authorId, projectId: comment.projectId, ownerId: project.ownerId })
    .from(comment)
    .innerJoin(project, eq(project.id, comment.projectId))
    .where(eq(comment.id, commentId))
    .limit(1);
  if (!row || (row.authorId !== userId && row.ownerId !== userId)) {
    throw new UserFacingError("Fant ikke kommentaren.");
  }
  await db.delete(comment).where(eq(comment.id, commentId));
  return row.projectId;
}
