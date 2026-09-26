import type { MetadataRoute } from "next";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { siteUrl } from "@/lib/site";
import { outer } from "@/lib/sql";

const { project, projectTag, tag, user } = schema;

// Lages ved hver forespørsel, så nye profiler og prosjekter kommer med med én gang,
// og bygget trenger ikke databasen.
export const dynamic = "force-dynamic";

// Alle offentlige sider søkemotorer bør finne: profiler, prosjekter og teknologier.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const notBanned = sql`coalesce(${user.banned}, false) = false`;

  const [profiles, projects, tags] = await Promise.all([
    db
      .select({ username: user.username, updatedAt: user.updatedAt })
      .from(user)
      .where(and(notBanned, sql`exists (select 1 from ${project} p where p.owner_id = ${outer(user.id)} and p.status = 'published' and p.removed_at is null)`))
      .orderBy(desc(user.updatedAt))
      .limit(5000),
    db
      .select({ id: project.id, updatedAt: project.updatedAt })
      .from(project)
      .innerJoin(user, eq(user.id, project.ownerId))
      .where(and(eq(project.status, "published"), isNull(project.removedAt), notBanned))
      .orderBy(desc(project.updatedAt))
      .limit(20000),
    db.selectDistinct({ slug: tag.slug }).from(tag).innerJoin(projectTag, eq(projectTag.tagId, tag.id)).limit(2000),
  ]);

  const statics = ["", "/sok", "/om", "/retningslinjer", "/vilkar", "/personvern", "/register"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.5,
  }));

  return [
    ...statics,
    ...profiles.map((p) => ({ url: `${base}/@${p.username}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...projects.map((p) => ({ url: `${base}/prosjekt/${p.id}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...tags.map((t) => ({ url: `${base}/tag/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
