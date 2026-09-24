"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { publicProject } from "@/lib/projects";

const { profile, project, projectImage, tag, user } = schema;

export type QuickResult = {
  people: { username: string; name: string; image: string | null; headline: string | null }[];
  projects: { id: string; title: string; owner: string; cover: string | null }[];
  tags: { slug: string; name: string }[];
};

// Raske treff til søkepaletten (⌘K). Holdes lett: noen få treff av hver type.
export async function quickSearchAction(query: string): Promise<QuickResult> {
  const q = String(query ?? "").trim().slice(0, 80);
  if (q.length < 1) return { people: [], projects: [], tags: [] };
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const prefix = `${q.replace(/[%_]/g, "").toLowerCase()}%`;

  const [people, projects, tags] = await Promise.all([
    db
      .select({ username: user.username, name: user.name, image: user.image, headline: profile.headline })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(and(sql`coalesce(${user.banned}, false) = false`, or(ilike(user.name, like), ilike(user.username, like), ilike(profile.headline, like))))
      .orderBy(desc(sql`(lower(${user.name}) like ${prefix} or ${user.username} like ${prefix})::int`), user.name)
      .limit(5),
    db
      .select({
        id: project.id,
        title: project.title,
        owner: user.name,
        cover: sql<string | null>`(select ${projectImage.url} from ${projectImage} where ${projectImage.projectId} = ${project.id} order by ${projectImage.position} limit 1)`,
      })
      .from(project)
      .innerJoin(user, eq(user.id, project.ownerId))
      .where(and(publicProject(), or(ilike(project.title, like), ilike(project.summary, like))))
      .orderBy(desc(sql`(lower(${project.title}) like ${prefix})::int`), desc(project.publishedAt))
      .limit(6),
    db
      .select({ slug: tag.slug, name: tag.name })
      .from(tag)
      .where(or(ilike(tag.name, like), ilike(tag.slug, like)))
      .orderBy(desc(sql`(lower(${tag.name}) like ${prefix})::int`), tag.name)
      .limit(5),
  ]);

  return { people, projects, tags };
}
