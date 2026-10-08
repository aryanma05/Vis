import "server-only";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { NotificationData, NotificationPrefs } from "@/db/schema";
import { REACTION_LABELS } from "@/lib/constants";
import type { Tx } from "@/lib/db-types";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { profilePath, projectPath } from "@/lib/site";

const { comment, contactRequest, notification, profile, project, user } = schema;

export type NotificationKind = (typeof schema.notificationType.enumValues)[number];

export const DEFAULT_NOTIFICATION_PREFS: Required<NotificationPrefs> = {
  comment: true,
  reply: true,
  mention: true,
  follow: false,
  digest: true,
  contact: true,
};

export function resolvePrefs(prefs: NotificationPrefs | null | undefined): Required<NotificationPrefs> {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs ?? {}) };
}

type NotifyInput = {
  userId: string;
  actorId: string;
  type: NotificationKind;
  projectId?: string | null;
  commentId?: string | null;
  data?: NotificationData | null;
};

// Lager et varsel (aldri til seg selv). Reaksjoner og nye følgere varsles bare én gang
// per døgn per person, så det ikke blir mas av at noen trykker av og på.
export async function notify(input: NotifyInput, tx: Tx | typeof db = db) {
  if (input.userId === input.actorId) return;

  if (input.type === "reaction" || input.type === "follow") {
    const [recent] = await tx
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.userId, input.userId),
          eq(notification.actorId, input.actorId),
          eq(notification.type, input.type),
          input.projectId ? eq(notification.projectId, input.projectId) : isNull(notification.projectId),
          gte(notification.createdAt, sql`now() - interval '1 day'`),
        ),
      )
      .limit(1);
    if (recent) return;
  }

  await tx.insert(notification).values({
    userId: input.userId,
    actorId: input.actorId,
    type: input.type,
    projectId: input.projectId ?? null,
    commentId: input.commentId ?? null,
    data: input.data ?? null,
  });
}

// E-post om et nytt varsel, hvis mottakeren har slått det på. Kalles etter at
// transaksjonen er ferdig, så en treg e-posttjeneste ikke holder på databasen.
export async function emailNotification(input: NotifyInput & { excerpt?: string | null }) {
  // Reaksjoner sendes ikke på e-post. Kontaktforespørsler, søknader, team og utfordringer har
  // sine egne e-poster (lib/contact.ts, lib/applications.ts, lib/companies.ts, lib/challenges.ts).
  if (input.userId === input.actorId || ["reaction", "contact", "application", "employee", "challenge"].includes(input.type)) return;
  if (!emailProviderConfigured && process.env.NODE_ENV === "production") return;

  try {
    const actorUser = alias(user, "actor");
    const [row] = await db
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
        prefs: profile.notificationPrefs,
        actorName: actorUser.name,
        actorUsername: actorUser.username,
        projectTitle: project.title,
      })
      .from(user)
      .innerJoin(actorUser, eq(actorUser.id, input.actorId))
      .leftJoin(profile, eq(profile.userId, user.id))
      .leftJoin(project, input.projectId ? eq(project.id, input.projectId) : sql`false`)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!row || !row.emailVerified) return;
    const prefs = resolvePrefs(row.prefs);
    // «Utvalgt» og «lagt til i et prosjekt» skjer sjelden og har ikke egne innstillinger.
    if (input.type !== "featured" && input.type !== "member" && !prefs[input.type as keyof NotificationPrefs]) return;

    const title = row.projectTitle ? `«${row.projectTitle}»` : "prosjektet ditt";
    const commentPath = input.projectId ? `${projectPath(input.projectId)}#kommentarer` : "/varsler";
    const content = {
      comment: { subject: `${row.actorName} kommenterte på ${title}`, intro: `${row.actorName} skrev en kommentar på ${title}.`, button: "Se kommentaren", path: commentPath },
      reply: { subject: `${row.actorName} svarte deg`, intro: `${row.actorName} svarte på kommentaren din på ${title}.`, button: "Se svaret", path: commentPath },
      mention: { subject: `${row.actorName} nevnte deg`, intro: `${row.actorName} nevnte deg i en kommentar på ${title}.`, button: "Se kommentaren", path: commentPath },
      follow: { subject: `${row.actorName} følger deg nå`, intro: `${row.actorName} (@${row.actorUsername}) begynte å følge deg på Vis.`, button: "Se profilen", path: profilePath(row.actorUsername) },
      member: {
        subject: `${row.actorName} la deg til i ${title}`,
        intro: `${row.actorName} (@${row.actorUsername}) la deg til som medlem i ${title} på Vis. Prosjektet vises nå med deg som en del av teamet. Vil du ikke stå oppført, kan du fjerne deg selv på prosjektsiden.`,
        button: "Se prosjektet",
        path: input.projectId ? projectPath(input.projectId) : "/",
      },
      featured: {
        subject: `${title} er valgt ut på Vis`,
        intro: `${title} er valgt ut av redaksjonen og vises nå øverst på forsiden og i Utforsk. Gratulerer! Del det gjerne videre.`,
        button: "Se prosjektet",
        path: input.projectId ? projectPath(input.projectId) : "/",
      },
    }[input.type as Exclude<NotificationKind, "reaction" | "contact" | "application" | "employee" | "challenge">];
    if (!content) return;

    sendEmailInBackground(
      notificationEmail({
        to: row.email,
        subject: content.subject,
        heading: content.subject,
        intro: content.intro,
        quote: input.excerpt ?? null,
        path: content.path,
        button: content.button,
      }),
    );
  } catch (error) {
    log.error("notification.email", { error, type: input.type });
  }
}

export async function getUnreadCount(userId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return count;
}

export type NotificationItem = Awaited<ReturnType<typeof listNotifications>>[number];

export async function listNotifications(userId: string, { limit = 60, unreadOnly = false } = {}) {
  const actor = alias(user, "actor");
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      data: notification.data,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      actorUsername: actor.username,
      actorName: actor.name,
      actorImage: actor.image,
      projectId: project.id,
      projectTitle: project.title,
      commentId: comment.id,
      commentBody: comment.body,
      contactMessage: contactRequest.message,
      contactReason: contactRequest.reason,
    })
    .from(notification)
    .innerJoin(actor, eq(actor.id, notification.actorId))
    .leftJoin(project, eq(project.id, notification.projectId))
    .leftJoin(comment, eq(comment.id, notification.commentId))
    .leftJoin(contactRequest, sql`${contactRequest.id}::text = ${notification.data}->>'contactId'`)
    .where(and(eq(notification.userId, userId), unreadOnly ? isNull(notification.readAt) : undefined))
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    unread: r.readAt === null,
    createdAt: r.createdAt,
    actor: { username: r.actorUsername, name: r.actorName, image: r.actorImage },
    project: r.projectId ? { id: r.projectId, title: r.projectTitle! } : null,
    commentId: r.commentId,
    contactId: r.data?.contactId ?? null,
    contactReason: r.contactReason,
    excerpt: (r.commentBody ?? r.contactMessage)?.slice(0, 180) ?? null,
    reaction: r.data?.reaction ? REACTION_LABELS[r.data.reaction] : null,
    data: r.data ?? {},
  }));
}

export async function markAllRead(userId: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}

export async function markRead(userId: string, notificationId: string) {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), eq(notification.id, notificationId), isNull(notification.readAt)));
}

export async function getNotificationPrefs(userId: string) {
  const [row] = await db.select({ prefs: profile.notificationPrefs }).from(profile).where(eq(profile.userId, userId)).limit(1);
  return resolvePrefs(row?.prefs);
}

export async function setNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  await db
    .insert(profile)
    .values({ userId, notificationPrefs: prefs })
    .onConflictDoUpdate({ target: profile.userId, set: { notificationPrefs: prefs } });
}
