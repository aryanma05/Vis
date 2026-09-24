import { inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import type { Tx } from "@/lib/db-types";
import { normalizeTagNames } from "@/lib/tag-names";

export { MAX_TAGS_PER_PROJECT, normalizeTagNames, tagSlug } from "@/lib/tag-names";

// Erstatter alle tagger på et prosjekt med de oppgitte.
export async function setProjectTags(tx: Tx, projectId: string, names: string[]) {
  const tags = normalizeTagNames(names);

  await tx.delete(schema.projectTag).where(sql`${schema.projectTag.projectId} = ${projectId}`);
  if (tags.length === 0) return;

  await tx
    .insert(schema.tag)
    .values(tags)
    .onConflictDoNothing({ target: schema.tag.slug });

  const rows = await tx
    .select({ id: schema.tag.id, slug: schema.tag.slug })
    .from(schema.tag)
    .where(inArray(schema.tag.slug, tags.map((t) => t.slug)));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  await tx.insert(schema.projectTag).values(
    tags.map((t, position) => ({
      projectId,
      tagId: idBySlug.get(t.slug)!,
      position,
    })),
  );
}
