import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { profileViewsByDay, projectViewsByDay } from "@/lib/views";
import { outer } from "@/lib/sql";

const { comment, follow, project, projectViewDay, reaction } = schema;

const sum = (rows: { views: number }[]) => rows.reduce((n, r) => n + r.views, 0);

// Lange perioder vises per uke, så stolpene ikke blir for tynne.
function byWeek(days: { day: string; views: number }[]) {
  const out: { day: string; views: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    out.push({ day: chunk[0].day, views: sum(chunk) });
  }
  return out;
}

// Tall til innsiktssiden: siste `days` dager sammenlignet med perioden før.
// Gratis: 30 dager. Pro: også 90 og 365.
export async function getInsights(userId: string, days = 30) {
  const countBetween = async (query: (from: number, to: number) => Promise<number>) => {
    const [current, previous] = await Promise.all([query(days, 0), query(days * 2, days)]);
    return { current, previous };
  };
  const [profileDays, projectDays] = await Promise.all([profileViewsByDay(userId, days * 2), projectViewsByDay(userId, days * 2)]);

  const window = (from: number, to: number) => ({
    from: sql`now() - make_interval(days => ${from})`,
    to: sql`now() - make_interval(days => ${to})`,
  });

  const [followers, reactions, comments, totals, topProjects] = await Promise.all([
    countBetween(async (from, to) => {
      const w = window(from, to);
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(follow)
        .where(and(eq(follow.followingId, userId), gte(follow.createdAt, w.from), lt(follow.createdAt, w.to)));
      return row.n;
    }),
    countBetween(async (from, to) => {
      const w = window(from, to);
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(reaction)
        .innerJoin(project, eq(project.id, reaction.projectId))
        .where(and(eq(project.ownerId, userId), gte(reaction.createdAt, w.from), lt(reaction.createdAt, w.to)));
      return row.n;
    }),
    countBetween(async (from, to) => {
      const w = window(from, to);
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(comment)
        .innerJoin(project, eq(project.id, comment.projectId))
        .where(and(eq(project.ownerId, userId), sql`${comment.authorId} <> ${userId}`, gte(comment.createdAt, w.from), lt(comment.createdAt, w.to)));
      return row.n;
    }),
    Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(follow).where(eq(follow.followingId, userId)),
      db.select({ n: sql<number>`coalesce(sum(${project.viewCount}), 0)::int` }).from(project).where(eq(project.ownerId, userId)),
    ]).then(([[f], [v]]) => [{ followers: f.n, projectViews: v.n }]),
    db
      .select({
        id: project.id,
        title: project.title,
        status: project.status,
        views30: sql<number>`coalesce((select sum(${projectViewDay.views}) from ${projectViewDay} where ${projectViewDay.projectId} = ${outer(project.id)} and ${projectViewDay.day} > current_date - ${days}::int), 0)::int`,
        viewsTotal: project.viewCount,
        reactions: sql<number>`(select count(*)::int from ${reaction} where ${reaction.projectId} = ${outer(project.id)})`,
        comments: sql<number>`(select count(*)::int from ${comment} where ${comment.projectId} = ${outer(project.id)})`,
      })
      .from(project)
      .where(eq(project.ownerId, userId))
      .orderBy(desc(sql`4`), desc(project.viewCount))
      .limit(days > 30 ? 20 : 8),
  ]);

  const shape = (list: { day: string; views: number }[]) => (days > 90 ? byWeek(list) : list);
  return {
    days,
    profileViews: { current: sum(profileDays.slice(days)), previous: sum(profileDays.slice(0, days)), days: shape(profileDays.slice(days)) },
    projectViews: { current: sum(projectDays.slice(days)), previous: sum(projectDays.slice(0, days)), days: shape(projectDays.slice(days)) },
    followers: { ...followers, total: totals[0]?.followers ?? 0 },
    reactions,
    comments,
    projectViewsTotal: totals[0]?.projectViews ?? 0,
    topProjects,
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;
