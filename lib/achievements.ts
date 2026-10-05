import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ACHIEVEMENTS, tierFor, type AchievementStat, type AchievementState } from "@/lib/achievement-defs";

const { userAchievement } = schema;

// De første så mange brukerne får «Pioner».
const PIONEER_LIMIT = 500;

type Stats = Record<AchievementStat, number>;

// Alt prestasjonene teller, i én spørring. Bare publiserte prosjekter som ikke er fjernet teller.
async function getStats(userId: string): Promise<Stats> {
  const published = sql`p.status = 'published' and p.removed_at is null`;
  const [row] = await db.execute<Record<AchievementStat, number | string | boolean | null>>(sql`
    select
      (select count(*) from project p where p.owner_id = ${userId} and ${published}) as "published",
      (select count(*) from reaction r join project p on p.id = r.project_id where p.owner_id = ${userId}) as "reactions",
      (select count(*) from reaction r join project p on p.id = r.project_id where p.owner_id = ${userId} and r.type = 'useful') as "useful",
      (select count(*) from follow f where f.following_id = ${userId}) as "followers",
      (select count(*) from comment c join project p on p.id = c.project_id where c.author_id = ${userId} and p.owner_id <> ${userId}) as "comments",
      (select count(*) from project p where ${published} and (
        (p.owner_id = ${userId} and exists (select 1 from project_member m where m.project_id = p.id))
        or exists (select 1 from project_member m where m.project_id = p.id and m.user_id = ${userId})
      )) as "team",
      (select count(*) from project_update u join project p on p.id = u.project_id where p.owner_id = ${userId}) as "updates",
      (select count(*) from project p where p.owner_id = ${userId} and p.featured_at is not null and p.removed_at is null) as "featured",
      (select count(distinct pt.tag_id) from project_tag pt join project p on p.id = pt.project_id where p.owner_id = ${userId} and ${published}) as "tags",
      (select count(*) from project p where p.owner_id = ${userId} and ${published} and p.repo_url is not null) as "code",
      (select count(*) from project p where p.owner_id = ${userId} and ${published}
        and coalesce(array_length(regexp_split_to_array(btrim(p.description), '\\s+'), 1), 0) >= 300) as "stories",
      (select coalesce(sum(p.view_count), 0) from project p where p.owner_id = ${userId}) as "views",
      (select (u.image is not null and pr.headline is not null and pr.location is not null and pr.bio is not null
        and (pr.website_url is not null or jsonb_array_length(pr.links) > 0))
        from "user" u left join profile pr on pr.user_id = u.id where u.id = ${userId}) as "profileComplete",
      (select count(*) from cv_experience e where e.user_id = ${userId}) + (select count(*) from cv_education e where e.user_id = ${userId}) as "cv",
      (select count(*) from project p where p.owner_id = ${userId} and ${published}
        and extract(hour from p.published_at at time zone 'Europe/Oslo') < 5) as "nightOwl",
      (select count(*) from "user" o where o.created_at <= (select created_at from "user" where id = ${userId})) as "pioneer",
      (select pr.pet is not null from profile pr where pr.user_id = ${userId}) as "pet"
  `);

  const stats = {} as Stats;
  for (const key of Object.keys(row) as AchievementStat[]) {
    const value = row[key];
    stats[key] = typeof value === "boolean" ? Number(value) : Number(value ?? 0);
  }
  // Plassen i køen gjøres om til ja/nei.
  stats.pioneer = stats.pioneer > 0 && stats.pioneer <= PIONEER_LIMIT ? 1 : 0;
  return stats;
}

// Regner ut prestasjonene på nytt og lagrer nye merker og nivåer. Kalles når profilen
// vises, så merkene alltid stemmer uten at hver handling i appen må huske på dem.
// `withProgress`: ta med tallene (bare for eieren selv; visninger er f.eks. private).
export async function syncAchievements(userId: string, { withProgress = false } = {}): Promise<AchievementState[]> {
  const [stats, stored] = await Promise.all([
    getStats(userId),
    db
      .select({ key: userAchievement.key, tier: userAchievement.tier, unlockedAt: userAchievement.unlockedAt, seenAt: userAchievement.seenAt })
      .from(userAchievement)
      .where(eq(userAchievement.userId, userId)),
  ]);
  const byKey = new Map(stored.map((r) => [r.key, r]));
  const now = new Date();

  const upgrades = ACHIEVEMENTS.flatMap((def) => {
    const tier = tierFor(def, stats[def.stat]);
    const current = byKey.get(def.key);
    return tier > (current?.tier ?? 0) ? [{ userId, key: def.key, tier }] : [];
  });

  if (upgrades.length > 0) {
    await db
      .insert(userAchievement)
      .values(upgrades.map((u) => ({ ...u, unlockedAt: now })))
      .onConflictDoUpdate({
        target: [userAchievement.userId, userAchievement.key],
        // Bare oppover: en samtidig forespørsel kan ikke sette nivået ned igjen.
        set: { tier: sql`greatest(${userAchievement.tier}, excluded.tier)`, unlockedAt: now, seenAt: null },
      });
    for (const u of upgrades) byKey.set(u.key, { key: u.key, tier: u.tier, unlockedAt: now, seenAt: null });
  }

  return ACHIEVEMENTS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      tier: row?.tier ?? 0,
      unlockedAt: row?.unlockedAt.toISOString() ?? null,
      value: withProgress ? stats[def.stat] : null,
      seen: !row || row.seenAt !== null,
    };
  });
}

// Eieren har sett feiringen av de nye merkene.
export async function markAchievementsSeen(userId: string) {
  await db
    .update(userAchievement)
    .set({ seenAt: new Date() })
    .where(and(eq(userAchievement.userId, userId), isNull(userAchievement.seenAt)));
}

// Nivået brukeren har på ett merke (0 = ikke låst opp). Brukes for tilbehør som må låses opp.
export async function achievementTiers(userId: string) {
  const rows = await db
    .select({ key: userAchievement.key, tier: userAchievement.tier })
    .from(userAchievement)
    .where(eq(userAchievement.userId, userId));
  return new Map(rows.map((r) => [r.key, r.tier]));
}
