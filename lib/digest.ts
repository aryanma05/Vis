import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { log } from "@/lib/log";
import { digestEmail, sendEmail, type DigestContent } from "@/lib/mailer";
import { resolvePrefs, setNotificationPrefs } from "@/lib/notifications";
import { getFeaturedProjects, getTrendingProjects, publicProject } from "@/lib/projects";
import { projectPath, siteUrl } from "@/lib/site";

const { comment, follow, profile, profileViewDay, project, projectViewDay, reaction, user } = schema;

// Ukesoppsummering på e-post. Kjøres av en planlagt jobb (app/api/cron/ukesoppsummering),
// helst mandag morgen. Hver kjøring tar en porsjon brukere, så den kan kjøres flere
// ganger på rad til alle har fått sin; samme person får aldri to på under seks dager.

// Lenken i e-posten for å melde seg av, signert så ingen kan melde av andre.
function signature(userId: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "utvikling";
  return createHmac("sha256", secret).update(`avmeld:${userId}`).digest("base64url").slice(0, 32);
}

export function unsubscribeUrl(userId: string) {
  return `${siteUrl()}/avmeld?u=${encodeURIComponent(userId)}&t=${signature(userId)}`;
}

// Adressen e-postprogrammet sender ett-klikks avmeldingen til (POST).
export function oneClickUnsubscribeUrl(userId: string) {
  return `${siteUrl()}/api/avmeld?u=${encodeURIComponent(userId)}&t=${signature(userId)}`;
}

export function verifyUnsubscribe(userId: string, token: string) {
  const expected = Buffer.from(signature(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function unsubscribeDigest(userId: string) {
  const [row] = await db.select({ prefs: profile.notificationPrefs }).from(profile).where(eq(profile.userId, userId)).limit(1);
  await setNotificationPrefs(userId, { ...resolvePrefs(row?.prefs), digest: false });
}

const sum = (rows: { n: number | null }[]) => Number(rows[0]?.n ?? 0);

// Innholdet for én person. null betyr at det ikke skjedde noe verdt en e-post.
export async function buildDigest(userId: string, name: string, picks: DigestContent["featured"]): Promise<DigestContent | null> {
  const weekAgo = sql`now() - interval '7 days'`;
  const ownProjects = db.select({ id: project.id }).from(project).where(eq(project.ownerId, userId));

  const [profileViews, projectViews, followers, reactions, comments, fromFollowing] = await Promise.all([
    db.select({ n: sql<number>`sum(${profileViewDay.views})::int` }).from(profileViewDay).where(and(eq(profileViewDay.userId, userId), gte(profileViewDay.day, sql`current_date - 7`))),
    db
      .select({ n: sql<number>`sum(${projectViewDay.views})::int` })
      .from(projectViewDay)
      .where(and(inArray(projectViewDay.projectId, ownProjects), gte(projectViewDay.day, sql`current_date - 7`))),
    db
      .select({ name: user.name, username: user.username })
      .from(follow)
      .innerJoin(user, eq(user.id, follow.followerId))
      .where(and(eq(follow.followingId, userId), gte(follow.createdAt, weekAgo)))
      .orderBy(desc(follow.createdAt))
      .limit(20),
    db.select({ n: sql<number>`count(*)::int` }).from(reaction).where(and(inArray(reaction.projectId, ownProjects), gte(reaction.createdAt, weekAgo))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(comment)
      .where(and(inArray(comment.projectId, ownProjects), gte(comment.createdAt, weekAgo), sql`${comment.authorId} <> ${userId}`)),
    db
      .select({ id: project.id, title: project.title, owner: user.name })
      .from(project)
      .innerJoin(user, eq(user.id, project.ownerId))
      .where(
        and(
          publicProject(),
          gte(project.publishedAt, weekAgo),
          inArray(project.ownerId, db.select({ id: follow.followingId }).from(follow).where(eq(follow.followerId, userId))),
        ),
      )
      .orderBy(desc(project.publishedAt))
      .limit(5),
  ]);

  const content: DigestContent = {
    name,
    profileViews: sum(profileViews),
    projectViews: sum(projectViews),
    newFollowers: followers,
    reactions: sum(reactions),
    comments: sum(comments),
    fromFollowing: fromFollowing.map((p) => ({ title: p.title, owner: p.owner, path: projectPath(p.id) })),
    featured: picks,
    unsubscribeUrl: unsubscribeUrl(userId),
    oneClickUrl: oneClickUnsubscribeUrl(userId),
  };

  // Uten noe som handler om personen selv, sendes ingenting (bare utvalgte prosjekter er ikke nok).
  const personal = content.profileViews + content.projectViews + content.reactions + content.comments + content.newFollowers.length + content.fromFollowing.length;
  return personal > 0 ? content : null;
}

// Sender til neste porsjon. Returnerer hvor mange som fikk e-post og hvor mange som ble hoppet over.
export async function sendWeeklyDigests({ batch = 200 }: { batch?: number } = {}) {
  const featured = await getFeaturedProjects(3);
  const picksSource = featured.length > 0 ? featured : await getTrendingProjects({ limit: 3 });
  const picks = picksSource.map((p) => ({ title: p.title, owner: p.owner.name, path: projectPath(p.id) }));

  const candidates = await db
    .select({ id: user.id, name: user.name, email: user.email, prefs: profile.notificationPrefs })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(
      and(
        eq(user.emailVerified, true),
        sql`coalesce(${user.banned}, false) = false`,
        or(isNull(profile.digestSentAt), lt(profile.digestSentAt, sql`now() - interval '6 days'`)),
        // Ikke helt nye kontoer: de har fått velkomst-e-poster nok.
        lt(user.createdAt, sql`now() - interval '3 days'`),
      ),
    )
    .orderBy(user.createdAt)
    .limit(batch);

  let sent = 0;
  let skipped = 0;
  for (const c of candidates) {
    // Markeres først, så en feil i e-posttjenesten ikke gir dobbel utsending neste gang.
    await db.insert(profile).values({ userId: c.id, digestSentAt: new Date() }).onConflictDoUpdate({ target: profile.userId, set: { digestSentAt: new Date() } });
    if (!resolvePrefs(c.prefs).digest) {
      skipped++;
      continue;
    }
    try {
      const content = await buildDigest(c.id, c.name, picks);
      if (!content) {
        skipped++;
        continue;
      }
      await sendEmail(digestEmail(c.email, content));
      sent++;
    } catch (error) {
      log.error("digest.send", { error, userId: c.id });
    }
  }
  log.info("digest.batch", { sent, skipped, remaining: candidates.length === batch });
  return { sent, skipped, more: candidates.length === batch };
}
