import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";

// Nøkkeltall for admin: vekst (nye brukere), aktivering (publiserer de noe?) og
// gjenbruk (kommer de tilbake?). Alt regnes ut fra tabellene vi allerede har, uten
// sporing av enkeltbesøk. «Aktiv» betyr at innloggingen ble brukt (Better Auth
// fornyer økten når man kommer tilbake etter et døgn), så tallene er omtrentlige.

export type WeekPoint = { week: string; value: number };

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);

async function weekly(query: ReturnType<typeof sql>): Promise<WeekPoint[]> {
  const rows = await db.execute<Row>(query);
  return rows.map((r) => ({ week: String(r.week).slice(0, 10), value: n(r.value) }));
}

const weeks = (table: string, column: string, where = "true") =>
  sql.raw(`
    with w as (
      select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as week
    )
    select w.week, count(t.*)::int as value
    from w left join "${table}" t on date_trunc('week', t.${column}) = w.week and ${where}
    group by w.week order by w.week`);

export async function getKeyMetrics() {
  const [[totals], [activation], [active], [retention], signups, published, [engagement]] = await Promise.all([
    db.execute<Row>(sql`
      select
        (select count(*) from "user")::int as users,
        (select count(*) from "user" where created_at > now() - interval '7 days')::int as users7,
        (select count(*) from "user" where created_at > now() - interval '30 days')::int as users30,
        (select count(*) from project where status = 'published' and removed_at is null)::int as projects,
        (select count(*) from project where status = 'published' and removed_at is null and published_at > now() - interval '7 days')::int as projects7`),
    // Av de som ble med for 2–30 dager siden: hvor mange har publisert et prosjekt, fylt
    // ut profilen og lagt inn CV? (Det siste døgnet telles ikke, de har ikke rukket noe.)
    db.execute<Row>(sql`
      with cohort as (
        select id from "user" where created_at between now() - interval '30 days' and now() - interval '1 day'
      )
      select
        count(*)::int as cohort,
        count(*) filter (where exists (select 1 from project p where p.owner_id = c.id and p.status = 'published'))::int as published,
        count(*) filter (where exists (select 1 from profile pr where pr.user_id = c.id and coalesce(pr.headline, '') <> ''))::int as profile,
        count(*) filter (where exists (select 1 from cv_experience e where e.user_id = c.id) or exists (select 1 from cv_document d where d.user_id = c.id))::int as cv
      from cohort c`),
    db.execute<Row>(sql`
      select
        count(distinct user_id) filter (where updated_at > now() - interval '1 day')::int as dau,
        count(distinct user_id) filter (where updated_at > now() - interval '7 days')::int as wau,
        count(distinct user_id) filter (where updated_at > now() - interval '30 days')::int as mau
      from session`),
    // Kom de som ble med for 30–60 dager siden tilbake de siste 30 dagene?
    db.execute<Row>(sql`
      with cohort as (
        select id, created_at from "user" where created_at between now() - interval '60 days' and now() - interval '30 days'
      )
      select
        count(*)::int as cohort,
        count(*) filter (where exists (
          select 1 from session s where s.user_id = c.id and s.updated_at > now() - interval '30 days'
        ))::int as returned
      from cohort c`),
    weekly(weeks("user", "created_at")),
    weekly(weeks("project", "published_at", "t.status = 'published'")),
    db.execute<Row>(sql`
      select
        (select count(*) from comment where created_at > now() - interval '7 days')::int as comments,
        (select count(*) from reaction where created_at > now() - interval '7 days')::int as reactions,
        (select count(*) from follow where created_at > now() - interval '7 days')::int as follows,
        (select coalesce(sum(views), 0) from profile_view_day where day > current_date - 7)::int as profile_views,
        (select coalesce(sum(views), 0) from project_view_day where day > current_date - 7)::int as project_views`),
  ]);

  const pct = (part: unknown, whole: unknown) => (n(whole) > 0 ? Math.round((n(part) / n(whole)) * 100) : null);

  return {
    users: n(totals.users),
    users7: n(totals.users7),
    users30: n(totals.users30),
    projects: n(totals.projects),
    projects7: n(totals.projects7),
    activation: {
      cohort: n(activation.cohort),
      published: pct(activation.published, activation.cohort),
      profile: pct(activation.profile, activation.cohort),
      cv: pct(activation.cv, activation.cohort),
    },
    active: { dau: n(active.dau), wau: n(active.wau), mau: n(active.mau) },
    retention: { cohort: n(retention.cohort), returned: pct(retention.returned, retention.cohort) },
    engagement: {
      comments: n(engagement.comments),
      reactions: n(engagement.reactions),
      follows: n(engagement.follows),
      profileViews: n(engagement.profile_views),
      projectViews: n(engagement.project_views),
    },
    signups,
    published,
  };
}

export type KeyMetrics = Awaited<ReturnType<typeof getKeyMetrics>>;
