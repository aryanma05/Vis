import "server-only";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { extractMentions } from "@/lib/mentions";
import { emailNotification, notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { comment, project, user } = schema;

export const MAX_COMMENT_LENGTH = 2000;
const MAX_COMMENTS_PER_HOUR = 30;

export type CommentAuthor = { id: string; username: string; name: string; image: string | null };

export type ProjectComment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  author: CommentAuthor;
  canEdit: boolean;
  canDelete: boolean;
  isProjectOwner: boolean;
  replies: ProjectComment[];
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
    .select({
      id: project.id,
      ownerId: project.ownerId,
      status: project.status,
      removedAt: project.removedAt,
      ownerBanned: user.banned,
    })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(eq(project.id, projectId))
    .limit(1);
  if (!row) return null;
  const hidden = row.status === "draft" || row.removedAt !== null || Boolean(row.ownerBanned);
  if (hidden && row.ownerId !== viewerId) return null;
  return row;
}

export async function listComments(
  projectId: string,
  viewerId?: string | null,
  { isAdmin = false }: { isAdmin?: boolean } = {},
): Promise<ProjectComment[]> {
  const proj = await visibleProject(projectId, viewerId);
  if (!proj) return [];

  const rows = await db
    .select({
      id: comment.id,
      parentId: comment.parentId,
      body: comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      authorId: user.id,
      username: user.username,
      name: user.name,
      image: user.image,
      banned: user.banned,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.authorId))
    .where(eq(comment.projectId, projectId))
    .orderBy(asc(comment.createdAt));

  const all: ProjectComment[] = rows
    // Kommentarer fra utestengte brukere skjules.
    .filter((r) => !r.banned)
    .map((r) => ({
      id: r.id,
      parentId: r.parentId,
      body: r.body,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      author: { id: r.authorId, username: r.username, name: r.name, image: r.image },
      canEdit: viewerId === r.authorId,
      // Prosjekteieren (og moderatorer) kan fjerne kommentarer på prosjektet.
      canDelete: viewerId === r.authorId || viewerId === proj.ownerId || isAdmin,
      isProjectOwner: r.authorId === proj.ownerId,
      replies: [],
    }));

  const byId = new Map(all.map((c) => [c.id, c]));
  const top: ProjectComment[] = [];
  for (const c of all) {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    if (parent) parent.replies.push(c);
    else top.push(c);
  }
  return top;
}

export async function countComments(projectId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comment)
    .where(eq(comment.projectId, projectId));
  return count;
}

// Brukernavnene i teksten som faktisk finnes (så bare ekte omtaler blir lenker).
export async function existingUsernames(texts: string[]) {
  const names = [...new Set(texts.flatMap((t) => extractMentions(t, 20)))];
  if (names.length === 0) return [];
  const rows = await db.select({ username: user.username }).from(user).where(inArray(user.username, names));
  return rows.map((r) => r.username);
}

export async function addComment(authorId: string, projectId: string, body: string, parentId?: string | null) {
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

  // Svar legges alltid på toppnivå-kommentaren, så trådene holder seg på ett nivå.
  let parent: { id: string; authorId: string } | null = null;
  if (parentId) {
    if (!isUuid(parentId)) throw new UserFacingError("Fant ikke kommentaren du svarer på.");
    const [row] = await db
      .select({ id: comment.id, parentId: comment.parentId, authorId: comment.authorId, projectId: comment.projectId })
      .from(comment)
      .where(eq(comment.id, parentId))
      .limit(1);
    if (!row || row.projectId !== projectId) throw new UserFacingError("Fant ikke kommentaren du svarer på.");
    if (row.parentId) {
      const [root] = await db
        .select({ id: comment.id, authorId: comment.authorId })
        .from(comment)
        .where(eq(comment.id, row.parentId))
        .limit(1);
      parent = root ?? null;
    } else {
      parent = { id: row.id, authorId: row.authorId };
    }
    // Den man svarer direkte på skal også få varsel, selv om svaret havner i roten.
    if (parent && row.authorId !== parent.authorId) parent = { ...parent, authorId: row.authorId };
  }

  const mentioned = extractMentions(text);
  const mentionedUsers = mentioned.length
    ? await db
        .select({ id: user.id })
        .from(user)
        .where(and(inArray(user.username, mentioned), sql`coalesce(${user.banned}, false) = false`))
    : [];

  const events: { userId: string; type: "comment" | "reply" | "mention" }[] = [];
  const notified = new Set<string>([authorId]);
  if (parent && !notified.has(parent.authorId)) {
    events.push({ userId: parent.authorId, type: "reply" });
    notified.add(parent.authorId);
  }
  if (!notified.has(proj.ownerId)) {
    events.push({ userId: proj.ownerId, type: "comment" });
    notified.add(proj.ownerId);
  }
  for (const m of mentionedUsers) {
    if (notified.has(m.id)) continue;
    events.push({ userId: m.id, type: "mention" });
    notified.add(m.id);
  }

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(comment)
      .values({ projectId, authorId, body: text, parentId: parent?.id ?? null })
      .returning({ id: comment.id });
    for (const e of events) {
      await notify({ userId: e.userId, actorId: authorId, type: e.type, projectId, commentId: created.id }, tx);
    }
    return created.id;
  });

  for (const e of events) {
    await emailNotification({ userId: e.userId, actorId: authorId, type: e.type, projectId, commentId: id, excerpt: text });
  }
  return id;
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

export async function deleteComment(userId: string, commentId: string, { isAdmin = false }: { isAdmin?: boolean } = {}) {
  if (!isUuid(commentId)) throw new UserFacingError("Fant ikke kommentaren.");
  const [row] = await db
    .select({ authorId: comment.authorId, projectId: comment.projectId, ownerId: project.ownerId })
    .from(comment)
    .innerJoin(project, eq(project.id, comment.projectId))
    .where(eq(comment.id, commentId))
    .limit(1);
  if (!row || (row.authorId !== userId && row.ownerId !== userId && !isAdmin)) {
    throw new UserFacingError("Fant ikke kommentaren.");
  }
  await db.delete(comment).where(eq(comment.id, commentId));
  return row.projectId;
}
