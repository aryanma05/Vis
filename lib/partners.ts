import "server-only";

import { and, desc, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { FIELDS, type FieldKey } from "@/lib/constants";
import { outer } from "@/lib/sql";
import { personColumns, withFollowState, type PersonCard } from "@/lib/social";

const { cvSkill, profile, project, projectTag, tag, user } = schema;

// «Folk»-fanen på /partnere: de som har krysset av for «Samarbeid» under «Åpen for» på profilen.
// «Hva ser du etter?» på profilen er det viktigste her, så de som har skrevet noe står først.

export type PartnerCard = PersonCard & {
  lookingFor: string | null;
  contactEnabled: boolean;
  skills: string[];
  // Det nyeste publiserte prosjektet som er under arbeid, om noen.
  current: { id: string; title: string } | null;
};

const notBanned = sql`coalesce(${user.banned}, false) = false`;
const openToCollaborate = sql`${profile.openTo} @> '["samarbeid"]'::jsonb`;

const partnerColumns = {
  ...personColumns,
  lookingFor: profile.lookingFor,
  contactEnabled: sql<boolean>`coalesce(${profile.contactEnabled}, false)`,
  skills: sql<string[]>`array(select ${cvSkill.name} from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} order by ${cvSkill.position} limit 5)`,
  current: sql<{ id: string; title: string } | null>`(select json_build_object('id', p.id, 'title', p.title) from ${project} p
    where p.owner_id = ${outer(user.id)} and p.status = 'published' and p.removed_at is null and p.progress = 'in_progress'
    order by p.published_at desc nulls last limit 1)`,
};

export async function findPartners({
  query = "",
  location,
  field,
  viewerId,
  limit = 48,
}: {
  query?: string;
  location?: string | null;
  field?: FieldKey | null;
  viewerId?: string | null;
  limit?: number;
} = {}): Promise<PartnerCard[]> {
  const conditions: SQL[] = [notBanned, openToCollaborate];
  if (viewerId) conditions.push(ne(user.id, viewerId));

  const q = query.trim().replace(/[%_]/g, "");
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      or(
        ilike(user.name, like),
        ilike(user.username, like),
        ilike(profile.headline, like),
        ilike(profile.lookingFor, like),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and ${cvSkill.name} ilike ${like})`,
        sql`exists (select 1 from ${project} p join ${projectTag} pt on pt.project_id = p.id join ${tag} t on t.id = pt.tag_id
          where p.owner_id = ${outer(user.id)} and p.status = 'published' and p.removed_at is null and t.name ilike ${like})`,
      )!,
    );
  }
  if (location?.trim()) conditions.push(ilike(profile.location, `%${location.trim().replace(/[%_]/g, "")}%`));
  if (field && FIELDS[field]) {
    const words = FIELDS[field].words;
    conditions.push(
      or(
        ...words.map((w) => ilike(profile.headline, `%${w}%`)),
        ...words.map((w) => ilike(profile.lookingFor, `%${w}%`)),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and (${sql.join(
          words.map((w) => sql`${cvSkill.name} ilike ${`%${w}%`}`),
          sql` or `,
        )}))`,
      )!,
    );
  }

  const rows = await db
    .select(partnerColumns)
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(and(...conditions))
    .orderBy(
      desc(sql`(coalesce(trim(${profile.lookingFor}), '') <> '')::int`),
      desc(sql`(${partnerColumns.current} is not null)::int`),
      desc(personColumns.projectCount),
      desc(personColumns.followerCount),
    )
    .limit(limit);

  return withFollowState(rows.map((r) => ({ ...r, skills: r.skills ?? [] })), viewerId);
}
