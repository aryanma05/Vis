import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { profileViewsByDay, projectViewsByDay } from "@/lib/views";
import { outer } from "@/lib/sql";

const { comment, follow, project, projectViewDay, reaction } = schema;

const sum = (rows: { views: number }[]) => rows.reduce((n, r) => n + r.views, 0);

async function countBetween(query: (from: number, to: number) => Promise<number>) {
  const [current, previous] = await Promise.all([query(30, 0), query(60, 30)]);
  return { current, previous };
}

// Tall til innsiktssiden: siste 30 dager sammenlignet med de 30 før.
export async function getInsights(userId: string) {
  const [profileDays, projectDays] = await Promise.all([profileViewsByDay(userId, 60), projectViewsByDay(userId, 60)]);

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
        views30: sql<number>`coalesce((select sum(${projectViewDay.views}) from ${projectViewDay} where ${projectViewDay.projectId} = ${outer(project.id)} and ${projectViewDay.day} > current_date - 30), 0)::int`,
        viewsTotal: project.viewCount,
        reactions: sql<number>`(select count(*)::int from ${reaction} where ${reaction.projectId} = ${outer(project.id)})`,
        comments: sql<number>`(select count(*)::int from ${comment} where ${comment.projectId} = ${outer(project.id)})`,
      })
      .from(project)
      .where(eq(project.ownerId, userId))
      .orderBy(desc(sql`4`), desc(project.viewCount))
      .limit(8),
  ]);

  return {
    profileViews: { current: sum(profileDays.slice(30)), previous: sum(profileDays.slice(0, 30)), days: profileDays.slice(30) },
    projectViews: { current: sum(projectDays.slice(30)), previous: sum(projectDays.slice(0, 30)), days: projectDays.slice(30) },
    followers: { ...followers, total: totals[0]?.followers ?? 0 },
    reactions,
    comments,
    projectViewsTotal: totals[0]?.projectViews ?? 0,
    topProjects,
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;
