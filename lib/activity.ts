import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { comment, project } = schema;

// Aktivitet per dag det siste året: publiserte prosjekter teller mest, kommentarer litt.
// Brukes til aktivitetskartet på profilen.
export async function getActivityByDay(userId: string, days = 365) {
  const since = sql`now() - make_interval(days => ${days})`;
  const [projects, comments] = await Promise.all([
    db
      .select({ day: sql<string>`to_char(${project.publishedAt} at time zone 'Europe/Oslo', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(project)
      .where(and(eq(project.ownerId, userId), eq(project.status, "published"), gte(project.publishedAt, since)))
      .groupBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(${comment.createdAt} at time zone 'Europe/Oslo', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
      .from(comment)
      .where(and(eq(comment.authorId, userId), gte(comment.createdAt, since)))
      .groupBy(sql`1`),
  ]);

  const byDay = new Map<string, number>();
  for (const p of projects) byDay.set(p.day, (byDay.get(p.day) ?? 0) + p.n * 3);
  for (const c of comments) byDay.set(c.day, (byDay.get(c.day) ?? 0) + c.n);
  return {
    byDay: Object.fromEntries(byDay),
    projects: projects.reduce((sum, p) => sum + p.n, 0),
    comments: comments.reduce((sum, c) => sum + c.n, 0),
  };
}
