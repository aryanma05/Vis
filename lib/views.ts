import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid } from "@/lib/projects";

const { profileViewDay, project, projectViewDay } = schema;

// Visninger telles per dag uten å lagre hvem som så på. Nettleseren sender én
// visning per økt (se components/ViewTracker.tsx), og eierens egne visninger telles ikke.

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|headless/i;
export const isBot = (userAgent: string | null) => !userAgent || BOT.test(userAgent);

export async function recordProjectView(projectId: string, viewerId?: string | null) {
  if (!isUuid(projectId)) return;
  const [row] = await db
    .select({ ownerId: project.ownerId, status: project.status })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (!row || row.status !== "published" || row.ownerId === viewerId) return;

  await db.transaction(async (tx) => {
    await tx.update(project).set({ viewCount: sql`${project.viewCount} + 1` }).where(eq(project.id, projectId));
    await tx
      .insert(projectViewDay)
      .values({ projectId, day: sql`current_date`, views: 1 })
      .onConflictDoUpdate({
        target: [projectViewDay.projectId, projectViewDay.day],
        set: { views: sql`${projectViewDay.views} + 1` },
      });
  });
}

export async function recordProfileView(userId: string, viewerId?: string | null) {
  if (userId === viewerId) return;
  await db
    .insert(profileViewDay)
    .values({ userId, day: sql`current_date`, views: 1 })
    .onConflictDoUpdate({
      target: [profileViewDay.userId, profileViewDay.day],
      set: { views: sql`${profileViewDay.views} + 1` },
    });
}

// Visninger per dag de siste `days` dagene (dager uten visninger tas med som 0).
export async function profileViewsByDay(userId: string, days = 30) {
  const rows = await db
    .select({ day: sql<string>`to_char(${profileViewDay.day}, 'YYYY-MM-DD')`, views: profileViewDay.views })
    .from(profileViewDay)
    .where(and(eq(profileViewDay.userId, userId), gte(profileViewDay.day, sql`current_date - ${days - 1}::int`)));
  return fillDays(rows, days);
}

export async function projectViewsByDay(ownerId: string, days = 30) {
  const rows = await db
    .select({ day: sql<string>`to_char(${projectViewDay.day}, 'YYYY-MM-DD')`, views: sql<number>`sum(${projectViewDay.views})::int` })
    .from(projectViewDay)
    .innerJoin(project, eq(project.id, projectViewDay.projectId))
    .where(and(eq(project.ownerId, ownerId), gte(projectViewDay.day, sql`current_date - ${days - 1}::int`)))
    .groupBy(projectViewDay.day);
  return fillDays(rows, days);
}

function fillDays(rows: { day: string; views: number }[], days: number) {
  const byDay = new Map(rows.map((r) => [r.day, r.views]));
  const out: { day: string; views: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, views: byDay.get(key) ?? 0 });
  }
  return out;
}
