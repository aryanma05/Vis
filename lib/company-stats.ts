import "server-only";

import { and, desc, eq, gte, ne, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, listAudit } from "@/lib/audit";
import { getDisplayPrices, hasBusiness } from "@/lib/billing";
import { MAX_MEMBERS } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import type { AuditAction } from "@/lib/company-labels";
import { can } from "@/lib/company-permissions";
import { FREE_ACTIVE_JOBS } from "@/lib/jobs";
import type { OnboardingStep } from "@/lib/profiles";
import { isUuid } from "@/lib/projects";
import { clampRoiSettings, computeRoi, storedRoiSettings, type Roi, type RoiInput, type RoiValues } from "@/lib/roi";

const { company, companyAudit, companyInvite, companyMember, interviewSlot, job, jobApplication, jobViewDay, user } = schema;

// Tall til administrasjonen: Oversikt, nøkkeltall og Spart med Vis. Bare summer og antall,
// aldri navn (unntatt aktiviteten, som viser det alle i bedriften uansett ser under Søkere).
// Dager regnes i Oslo-tid, som job_view_day.

export type AdminBadges = { freshApplicants: number; newSinceYesterday: number; waitingOver7: number; pendingInvites: number };

// Tallene på fanene og i toppen av administrasjonen: søkere i Ny, nye siste døgn, søkere som
// har ventet over 7 dager i Ny, og invitasjoner som venter på svar. Én spørring.
export async function getAdminBadges(companyId: string): Promise<AdminBadges> {
  if (!isUuid(companyId)) return { freshApplicants: 0, newSinceYesterday: 0, waitingOver7: 0, pendingInvites: 0 };
  const rows = await db.execute<AdminBadges>(sql`
    select
      count(*) filter (where a.status = 'ny')::int as "freshApplicants",
      count(*) filter (where a.status <> 'trukket' and a.created_at > now() - interval '1 day')::int as "newSinceYesterday",
      count(*) filter (where a.status = 'ny' and a.status_changed_at < now() - interval '7 days')::int as "waitingOver7",
      (select count(*)::int from ${companyInvite} i
        where i.company_id = ${companyId} and i.status = 'pending' and i.expires_at > now()) as "pendingInvites"
    from ${jobApplication} a
    join ${job} j on j.id = a.job_id
    where j.company_id = ${companyId}`);
  const row = rows[0];
  return {
    freshApplicants: Number(row?.freshApplicants ?? 0),
    newSinceYesterday: Number(row?.newSinceYesterday ?? 0),
    waitingOver7: Number(row?.waitingOver7 ?? 0),
    pendingInvites: Number(row?.pendingInvites ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/*  Perioder og dager                                                         */
/* -------------------------------------------------------------------------- */

// Gratis: 30 dager. Bedrift: også 90 og 365 (?periode=…).
export const OVERVIEW_PERIODS = [30, 90, 365] as const;
export type OverviewDays = (typeof OVERVIEW_PERIODS)[number];

export function overviewDays(raw: unknown, business: boolean): OverviewDays {
  const n = Number(raw);
  return business && (OVERVIEW_PERIODS as readonly number[]).includes(n) ? (n as OverviewDays) : 30;
}

const today = sql`(now() at time zone 'Europe/Oslo')::date`;
const osloDay = (column: SQL) => sql`(${column} at time zone 'Europe/Oslo')::date`;
const num = (v: unknown) => Number(v ?? 0) || 0;
const sum = (list: number[]) => list.reduce((n, v) => n + v, 0);

// Lange perioder vises per uke (som /innsikt), så søylene ikke blir for tynne.
function byWeek<T extends { day: string; views: number }>(days: T[]) {
  const out: { day: string; views: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    out.push({ day: chunk[0].day, views: sum(chunk.map((d) => d.views)) });
  }
  return out;
}

// Sparklines: én verdi per dag opptil 90 dager, ellers per uke.
const spark = (values: number[], days: number) => (days > 90 ? byWeek(values.map((views, i) => ({ day: String(i), views }))).map((w) => w.views) : values);

// Sekunder → dager med én desimal.
const toDays = (seconds: unknown) => (seconds === null || seconds === undefined ? null : Math.round((Number(seconds) / 86_400) * 10) / 10);

/* -------------------------------------------------------------------------- */
/*  Spart med Vis                                                             */
/* -------------------------------------------------------------------------- */

// M: statusmeldinger fra mal. Én per application.status, n per application.bulk_status.
// Flyttet tilbake til Ny sendes det ingen melding om.
const messageCount = sql`sum(case when c.action = 'application.bulk_status'
    then (case when c.meta->>'n' ~ '^[0-9]+$' then (c.meta->>'n')::int else 0 end) else 1 end)`;
const messageWhere = sql`c.action in ('application.status', 'application.bulk_status') and coalesce(c.meta->>'to', c.meta->>'status', '') <> 'ny'`;

// Tallene bak «Spart med Vis» siden `since` (null = alt). Bare det som finnes: søknader som er
// slettet etter lagringstiden og intervjutider som er ryddet bort, telles ikke (tallet blir lavere,
// aldri høyere). Annonser og byrå bare når bedriften har krysset av.
export async function getRoiInput(companyId: string, since: Date | null): Promise<RoiInput> {
  const empty = { applications: 0, hires: 0, interviews: 0, messages: 0, replacedAds: 0, agencyHires: 0 };
  if (!isUuid(companyId)) return empty;
  // Som tekst: driveren tar ikke Date-objekter i rå SQL.
  const from = sql`${(since ?? new Date(0)).toISOString()}::timestamptz`;
  const rows = await db.execute<Record<keyof typeof empty, number>>(sql`
    select
      (select count(*)::int from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.status <> 'trukket' and a.created_at >= ${from}) as applications,
      (select count(*)::int from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.hired_at >= ${from}) as hires,
      (select count(*)::int from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.hired_at >= ${from} and a.agency_avoided) as "agencyHires",
      (select count(*)::int from ${interviewSlot} s
        where s.company_id = ${companyId} and s.application_id is not null and s.booked_at >= ${from}) as interviews,
      (select coalesce(${messageCount}, 0)::int from ${companyAudit} c
        where c.company_id = ${companyId} and ${messageWhere} and c.created_at >= ${from}) as messages,
      (select count(*)::int from ${job} j
        where j.company_id = ${companyId} and j.replaced_paid_ad and j.published_at >= ${from}) as "replacedAds"`);
  const row = rows[0];
  return {
    applications: num(row?.applications),
    hires: num(row?.hires),
    interviews: num(row?.interviews),
    messages: num(row?.messages),
    replacedAds: num(row?.replacedAds),
    agencyHires: num(row?.agencyHires),
  };
}

async function getRoiSettings(companyId: string): Promise<RoiValues> {
  const [row] = await db.select({ roiSettings: company.roiSettings }).from(company).where(eq(company.id, companyId)).limit(1);
  return clampRoiSettings(row?.roiSettings ?? null);
}

// Hva Bedrift koster for `days` dager (månedspris, eks. mva). 365 dager = 12 måneder.
async function subscriptionCost(days: number) {
  const monthly = (await getDisplayPrices())["business:month"].amount;
  return Math.round(monthly * (days >= 365 ? 12 : days / 30));
}

// «Slik regner vi»: eier og administrator kan endre timekost, årslønn, byråhonorar og
// annonsepris. Bare det som avviker fra standarden lagres. Gir tallene som nå gjelder.
export async function setRoiSettings(actorId: string, companyId: string, raw: unknown): Promise<RoiValues> {
  await requireCompanyPermission(actorId, companyId, "company.edit");
  const stored = storedRoiSettings(raw);
  await db.update(company).set({ roiSettings: stored }).where(eq(company.id, companyId));
  await audit({ companyId, actorId, action: "company.updated", targetType: "company", targetId: companyId, meta: { roi: true, custom: stored !== null } });
  return clampRoiSettings(stored);
}

/* -------------------------------------------------------------------------- */
/*  Oversikt                                                                  */
/* -------------------------------------------------------------------------- */

export type Funnel = { views: number; applicants: number; interview: number; offer: number; hired: number };

export type JobInsight = {
  id: string;
  title: string;
  status: "draft" | "published" | "closed";
  deadline: string | null;
  applyMode: string;
  views: number;
  viewsTotal: number;
  spark: number[];
  applicants: number;
  fresh: number;
  responseDays: number | null;
  funnel: Funnel;
};

export type Overview = Awaited<ReturnType<typeof getOverview>>;

// Alt på Oversikt utenom aktiviteten: nøkkeltall med forrige periode og sparklines, søknader per
// dag, trakten og Spart med Vis. Med Bedrift også 90/365 dager og tallene per stilling.
export async function getOverview(viewerId: string, companyId: string, { days }: { days?: number } = {}) {
  await requireCompanyPermission(viewerId, companyId, "company.view");
  const business = await hasBusiness(companyId);
  const d = overviewDays(days, business);
  const startCur = sql`${today} - ${d - 1}::int`;
  const startPrev = sql`${today} - ${2 * d - 1}::int`;
  const recent = sql`now() - make_interval(days => ${2 * d + 1})`;

  const [series, response, responseSpark, funnelRows, settings, cost, jobs] = await Promise.all([
    db.execute<{ day: string; applications: number; views: number; visViews: number; hires: number; agencyHires: number; interviews: number; messages: number; ads: number }>(sql`
      with days as (
        select g::date as day from generate_series(${startPrev}, ${today}, interval '1 day') g
      ),
      apps as (
        select ${osloDay(sql`a.created_at`)} as day, count(*)::int as n
        from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.status <> 'trukket' and a.created_at > ${recent}
        group by 1
      ),
      hires as (
        select ${osloDay(sql`a.hired_at`)} as day, count(*)::int as n, count(*) filter (where a.agency_avoided)::int as agency
        from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.hired_at > ${recent}
        group by 1
      ),
      views as (
        select v.day, sum(v.views)::int as n, coalesce(sum(v.views) filter (where j.apply_mode = 'vis'), 0)::int as vis
        from ${jobViewDay} v join ${job} j on j.id = v.job_id
        where j.company_id = ${companyId} and v.day >= ${startPrev}
        group by 1
      ),
      booked as (
        select ${osloDay(sql`s.booked_at`)} as day, count(*)::int as n
        from ${interviewSlot} s
        where s.company_id = ${companyId} and s.application_id is not null and s.booked_at > ${recent}
        group by 1
      ),
      messages as (
        select ${osloDay(sql`c.created_at`)} as day, ${messageCount}::int as n
        from ${companyAudit} c
        where c.company_id = ${companyId} and ${messageWhere} and c.created_at > ${recent}
        group by 1
      ),
      ads as (
        select ${osloDay(sql`j.published_at`)} as day, count(*)::int as n
        from ${job} j
        where j.company_id = ${companyId} and j.replaced_paid_ad and j.published_at > ${recent}
        group by 1
      )
      select to_char(days.day, 'YYYY-MM-DD') as day,
        coalesce(apps.n, 0) as applications, coalesce(views.n, 0) as views, coalesce(views.vis, 0) as "visViews",
        coalesce(hires.n, 0) as hires, coalesce(hires.agency, 0) as "agencyHires", coalesce(booked.n, 0) as interviews,
        coalesce(messages.n, 0) as messages, coalesce(ads.n, 0) as ads
      from days
      left join apps on apps.day = days.day
      left join hires on hires.day = days.day
      left join views on views.day = days.day
      left join booked on booked.day = days.day
      left join messages on messages.day = days.day
      left join ads on ads.day = days.day
      order by days.day`),
    // Svartid: fra søknaden kom til den første gang ble flyttet ut av Ny (median).
    db.execute<{ current: number | null; previous: number | null }>(sql`
      select
        percentile_cont(0.5) within group (order by extract(epoch from a.first_response_at - a.created_at))
          filter (where ${osloDay(sql`a.first_response_at`)} >= ${startCur}) as current,
        percentile_cont(0.5) within group (order by extract(epoch from a.first_response_at - a.created_at))
          filter (where ${osloDay(sql`a.first_response_at`)} < ${startCur}) as previous
      from ${jobApplication} a join ${job} j on j.id = a.job_id
      where j.company_id = ${companyId} and a.first_response_at is not null and ${osloDay(sql`a.first_response_at`)} >= ${startPrev}`),
    // Median svartid per uke i perioden (eldste først), til sparklinen.
    db.execute<{ bucket: number; median: number }>(sql`
      select floor((${today} - ${osloDay(sql`a.first_response_at`)}) / 7)::int as bucket,
        percentile_cont(0.5) within group (order by extract(epoch from a.first_response_at - a.created_at)) as median
      from ${jobApplication} a join ${job} j on j.id = a.job_id
      where j.company_id = ${companyId} and a.first_response_at is not null and ${osloDay(sql`a.first_response_at`)} >= ${startCur}
      group by 1
      order by 1 desc`),
    // Trakten for søknader som kom i perioden, etter hvor langt de har kommet nå.
    db.execute<Omit<Funnel, "views">>(sql`
      select count(*)::int as applicants,
        count(*) filter (where a.status in ('intervju', 'tilbud') or a.hired_at is not null)::int as interview,
        count(*) filter (where a.status = 'tilbud' or a.hired_at is not null)::int as offer,
        count(*) filter (where a.hired_at is not null)::int as hired
      from ${jobApplication} a join ${job} j on j.id = a.job_id
      where j.company_id = ${companyId} and a.status <> 'trukket' and ${osloDay(sql`a.created_at`)} >= ${startCur}`),
    getRoiSettings(companyId),
    subscriptionCost(d),
    business ? jobInsights(companyId, d) : Promise.resolve(null),
  ]);

  const rows = series.map((r) => ({
    day: r.day,
    applications: num(r.applications),
    views: num(r.views),
    visViews: num(r.visViews),
    hires: num(r.hires),
    agencyHires: num(r.agencyHires),
    interviews: num(r.interviews),
    messages: num(r.messages),
    ads: num(r.ads),
  }));
  const previousRows = rows.slice(0, rows.length - d);
  const currentRows = rows.slice(-d);
  const total = (list: typeof rows, key: Exclude<keyof (typeof rows)[number], "day">) => sum(list.map((r) => r[key]));
  const roiInput = (list: typeof rows): RoiInput => ({
    applications: total(list, "applications"),
    hires: total(list, "hires"),
    interviews: total(list, "interviews"),
    messages: total(list, "messages"),
    replacedAds: total(list, "ads"),
    agencyHires: total(list, "agencyHires"),
  });

  const input = roiInput(currentRows);
  const roi = computeRoi({ ...input, subscriptionCost: cost }, settings);
  const previousRoi = computeRoi(roiInput(previousRows), settings);
  // Spart med Vis vokser dag for dag: summen av alt hittil i perioden (uten avrunding).
  let running = 0;
  const roiSpark = currentRows.map((r) => {
    const day = computeRoi({ applications: r.applications, hires: r.hires, interviews: r.interviews, messages: r.messages, replacedAds: r.ads, agencyHires: 0 }, settings);
    running += sum(day.parts.map((p) => p.kroner));
    return Math.round(running);
  });

  const visViews = total(currentRows, "visViews");
  const previousVisViews = total(previousRows, "visViews");
  const applicants = total(currentRows, "applications");
  const previousApplicants = total(previousRows, "applications");
  // Visning → søknad i prosent med én desimal, bare for stillinger med «Søk med Vis-profilen».
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
  const funnelRow = funnelRows[0];
  const daily = currentRows.map((r) => ({ day: r.day, views: r.applications }));

  return {
    days: d,
    business,
    applicants: { current: applicants, previous: previousApplicants, spark: spark(currentRows.map((r) => r.applications), d) },
    views: { current: total(currentRows, "views"), previous: total(previousRows, "views"), spark: spark(currentRows.map((r) => r.views), d) },
    conversion: { current: pct(applicants, visViews), previous: pct(previousApplicants, previousVisViews) },
    response: {
      current: toDays(response[0]?.current),
      previous: toDays(response[0]?.previous),
      spark: responseSpark.map((r) => toDays(r.median) ?? 0),
    },
    roi: {
      hours: roi.hours,
      kroner: roi.kroner,
      agency: roi.agency,
      multiple: roi.multiple,
      // Gratis: bare hovedtallet. Fordelingen er en del av Bedrift.
      parts: business ? roi.parts : [],
      previousKroner: previousRoi.kroner,
      spark: spark(roiSpark, d),
      input: business ? input : null,
      settings,
      cost,
    },
    daily: d > 90 ? byWeek(daily) : daily,
    funnel: {
      views: visViews,
      applicants: num(funnelRow?.applicants),
      interview: num(funnelRow?.interview),
      offer: num(funnelRow?.offer),
      hired: num(funnelRow?.hired),
    } satisfies Funnel,
    jobs,
  };
}

// Per stilling (Bedrift): visninger med sparkline, søkere i perioden, hvor mange som står i Ny,
// median svartid og trakten. Stillinger som er ute nå, eller som var ute i perioden.
async function jobInsights(companyId: string, d: number): Promise<JobInsight[]> {
  const startCur = sql`${today} - ${d - 1}::int`;
  const inPeriod = sql`${osloDay(sql`a.created_at`)} >= ${startCur}`;
  const [rows, viewRows, dayKeys] = await Promise.all([
    db.execute<{
      id: string;
      title: string;
      status: JobInsight["status"];
      deadline: string | null;
      applyMode: string;
      viewsTotal: number;
      applicants: number;
      fresh: number;
      interview: number;
      offer: number;
      hired: number;
      responseSeconds: number | null;
    }>(sql`
      select j.id, j.title, j.status, to_char(j.deadline, 'YYYY-MM-DD') as deadline, j.apply_mode as "applyMode", j.views as "viewsTotal",
        count(a.id) filter (where a.status <> 'trukket' and ${inPeriod})::int as applicants,
        count(a.id) filter (where a.status = 'ny')::int as fresh,
        count(a.id) filter (where a.status <> 'trukket' and ${inPeriod} and (a.status in ('intervju', 'tilbud') or a.hired_at is not null))::int as interview,
        count(a.id) filter (where a.status <> 'trukket' and ${inPeriod} and (a.status = 'tilbud' or a.hired_at is not null))::int as offer,
        count(a.id) filter (where a.status <> 'trukket' and ${inPeriod} and a.hired_at is not null)::int as hired,
        percentile_cont(0.5) within group (order by extract(epoch from a.first_response_at - a.created_at))
          filter (where a.first_response_at is not null and ${osloDay(sql`a.first_response_at`)} >= ${startCur}) as "responseSeconds"
      from ${job} j
      left join ${jobApplication} a on a.job_id = j.id
      where j.company_id = ${companyId} and j.status <> 'draft'
        and (j.status = 'published' or j.closed_at > now() - make_interval(days => ${d}))
      group by j.id
      order by (j.status = 'published') desc, j.created_at desc
      limit 30`),
    db.execute<{ jobId: string; day: string; views: number }>(sql`
      select v.job_id as "jobId", to_char(v.day, 'YYYY-MM-DD') as day, v.views
      from ${jobViewDay} v join ${job} j on j.id = v.job_id
      where j.company_id = ${companyId} and v.day >= ${startCur}`),
    db.execute<{ day: string }>(sql`select to_char(g::date, 'YYYY-MM-DD') as day from generate_series(${startCur}, ${today}, interval '1 day') g order by 1`),
  ]);
  const keys = dayKeys.map((r) => r.day);
  const byJob = new Map<string, Map<string, number>>();
  for (const v of viewRows) {
    if (!byJob.has(v.jobId)) byJob.set(v.jobId, new Map());
    byJob.get(v.jobId)!.set(v.day, num(v.views));
  }
  return rows.map((r) => {
    const days = byJob.get(r.id);
    const values = keys.map((k) => days?.get(k) ?? 0);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      deadline: r.deadline,
      applyMode: r.applyMode,
      views: sum(values),
      viewsTotal: num(r.viewsTotal),
      spark: spark(values, d),
      applicants: num(r.applicants),
      fresh: num(r.fresh),
      responseDays: toDays(r.responseSeconds),
      funnel: { views: sum(values), applicants: num(r.applicants), interview: num(r.interview), offer: num(r.offer), hired: num(r.hired) },
    };
  });
}

// Til Stillinger-fanen (alle roller): visninger per dag siste 30 dager og når den første
// søknaden på stillingen slettes etter lagringstiden.
export async function getJobRowStats(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "jobs.draft");
  const startCur = sql`${today} - 29`;
  const [viewRows, expiryRows, dayKeys] = await Promise.all([
    db.execute<{ jobId: string; day: string; views: number }>(sql`
      select v.job_id as "jobId", to_char(v.day, 'YYYY-MM-DD') as day, v.views
      from ${jobViewDay} v join ${job} j on j.id = v.job_id
      where j.company_id = ${companyId} and v.day >= ${startCur}`),
    db.execute<{ jobId: string; nextExpiry: string }>(sql`
      select a.job_id as "jobId", min(a.expires_at) as "nextExpiry"
      from ${jobApplication} a join ${job} j on j.id = a.job_id
      where j.company_id = ${companyId} and a.status <> 'trukket'
      group by a.job_id`),
    db.execute<{ day: string }>(sql`select to_char(g::date, 'YYYY-MM-DD') as day from generate_series(${startCur}, ${today}, interval '1 day') g order by 1`),
  ]);
  const keys = dayKeys.map((r) => r.day);
  const out = new Map<string, { spark: number[]; views30: number; nextExpiry: Date | null }>();
  const entry = (jobId: string) => {
    if (!out.has(jobId)) out.set(jobId, { spark: keys.map(() => 0), views30: 0, nextExpiry: null });
    return out.get(jobId)!;
  };
  for (const v of viewRows) {
    const i = keys.indexOf(v.day);
    if (i < 0) continue;
    const e = entry(v.jobId);
    e.spark[i] = num(v.views);
    e.views30 += num(v.views);
  }
  for (const r of expiryRows) if (r.nextExpiry) entry(r.jobId).nextExpiry = new Date(r.nextExpiry);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Trenger oppmerksomhet                                                     */
/* -------------------------------------------------------------------------- */

export type AttentionKey = "waiting" | "interviews" | "deadlines" | "invites" | "expiring" | "terms" | "twoFactor";
export type AttentionItem = { key: AttentionKey; count: number; href: string | null };

// «Hva trenger meg i dag?»: søkere som har ventet over 7 dager i Ny, intervjuer i dag og i
// morgen, frister innen 7 dager, invitasjoner som går ut innen 48 timer, søknader som slettes
// innen 14 dager, manglende databehandleravtale og medlemmer uten tofaktor (når det kreves).
// Bare det rollen kan gjøre noe med. Tom liste = alt er à jour.
export async function getAttention(viewerId: string, companyId: string, base: string): Promise<AttentionItem[]> {
  const role = await requireCompanyPermission(viewerId, companyId, "company.view");
  const rows = await db.execute<{
    waiting: number;
    interviews: number;
    deadlines: number;
    invites: number;
    expiring: number;
    termsMissing: boolean;
    require2fa: boolean;
    without2fa: number;
  }>(sql`
    select
      (select count(*)::int from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.status = 'ny' and a.status_changed_at < now() - interval '7 days') as waiting,
      (select count(*)::int from ${interviewSlot} s
        where s.company_id = ${companyId} and s.application_id is not null and s.starts_at >= now()
          and s.starts_at < ((${today} + 2)::timestamp at time zone 'Europe/Oslo')) as interviews,
      (select count(*)::int from ${job} j
        where j.company_id = ${companyId} and j.status = 'published' and j.deadline >= ${today} and j.deadline <= ${today} + 7) as deadlines,
      (select count(*)::int from ${companyInvite} i
        where i.company_id = ${companyId} and i.status = 'pending' and i.expires_at > now() and i.expires_at < now() + interval '48 hours') as invites,
      (select count(*)::int from ${jobApplication} a join ${job} j on j.id = a.job_id
        where j.company_id = ${companyId} and a.status <> 'trukket' and a.expires_at < now() + interval '14 days') as expiring,
      (select c.terms_accepted_at is null from ${company} c where c.id = ${companyId}) as "termsMissing",
      (select c.require_2fa from ${company} c where c.id = ${companyId}) as "require2fa",
      (select count(*)::int from ${companyMember} m join ${user} u on u.id = m.user_id
        where m.company_id = ${companyId} and not coalesce(u.two_factor_enabled, false)) as without2fa`);
  const r = rows[0];
  if (!r) return [];
  const items: AttentionItem[] = [];
  const add = (key: AttentionKey, count: number, href: string | null, show = true) => {
    if (show && count > 0) items.push({ key, count, href });
  };
  add("terms", r.termsMissing ? 1 : 0, can(role, "company.privacy") ? `${base}?fane=personvern` : null);
  add("waiting", num(r.waiting), `${base}?fane=sokere&for=venter`);
  add("interviews", num(r.interviews), `${base}?fane=sokere`);
  add("deadlines", num(r.deadlines), `${base}?fane=stillinger`);
  add("invites", num(r.invites), `${base}?fane=medlemmer`, can(role, "members.invite"));
  add("expiring", num(r.expiring), `${base}?fane=sokere`, can(role, "applications.move"));
  add("twoFactor", num(r.without2fa), `${base}?fane=medlemmer`, Boolean(r.require2fa) && can(role, "members.manage"));
  return items;
}

/* -------------------------------------------------------------------------- */
/*  Aktivitet                                                                 */
/* -------------------------------------------------------------------------- */

export type FeedItem = {
  id: string;
  kind: "audit" | "application";
  action: AuditAction | null;
  createdAt: Date;
  person: { name: string; username: string; image: string | null } | null;
  label: string | null;
  applicationId: string | null;
};

// «Aktivitet» på Oversikt: FEED_ACTIONS fra loggen (alle roller) og nye søknader siste 30
// dager, nyeste først. Viser aldri hvem en handling gjaldt, bare hvem som gjorde den.
export async function getFeed(viewerId: string, companyId: string, { limit = 12 }: { limit?: number } = {}): Promise<FeedItem[]> {
  // Nye søknader viser kandidatens navn: samme krav som Søkere (også tofaktor når det kreves).
  await requireCompanyPermission(viewerId, companyId, "applications.view");
  const n = Math.min(Math.max(1, Math.floor(limit) || 12), 50);
  const [rows, applications] = await Promise.all([
    listAudit(viewerId, companyId, { scope: "feed", limit: n }),
    db
      .select({
        id: jobApplication.id,
        createdAt: jobApplication.createdAt,
        jobTitle: job.title,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(jobApplication)
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .innerJoin(user, eq(user.id, jobApplication.userId))
      .where(and(eq(job.companyId, companyId), ne(jobApplication.status, "trukket"), gte(jobApplication.createdAt, sql`now() - interval '30 days'`)))
      .orderBy(desc(jobApplication.createdAt))
      .limit(n),
  ]);
  const items: FeedItem[] = [
    ...rows.map((r) => ({
      id: r.id,
      kind: "audit" as const,
      action: r.action,
      createdAt: r.createdAt,
      person: r.actor ? { name: r.actor.name, username: r.actor.username, image: r.actor.image } : null,
      label: r.label,
      applicationId: null,
    })),
    ...applications.map((a) => ({
      id: a.id,
      kind: "application" as const,
      action: null,
      createdAt: a.createdAt,
      person: { name: a.name, username: a.username, image: a.image },
      label: a.jobTitle,
      applicationId: a.id,
    })),
  ];
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, n);
}

/* -------------------------------------------------------------------------- */
/*  Kom i gang                                                                */
/* -------------------------------------------------------------------------- */

// «Kom i gang med bedriften» (components/OnboardingChecklist.tsx). Bare stegene rollen kan
// gjøre selv; tofaktor gjelder alle. Tekstene oversettes i listen.
export async function getCompanyChecklist(viewerId: string, companyId: string, base: string): Promise<OnboardingStep[]> {
  const role = await requireCompanyPermission(viewerId, companyId, "company.view");
  const rows = await db.execute<{
    logoUrl: string | null;
    about: string | null;
    verified: boolean;
    terms: boolean;
    page: boolean;
    published: number;
    colleagues: number;
    twoFactor: boolean;
  }>(sql`
    select c.logo_url as "logoUrl", c.about,
      c.verified_at is not null as verified,
      c.terms_accepted_at is not null as terms,
      (jsonb_array_length(c.perks) > 0 or jsonb_array_length(c.hiring_process) > 0) as page,
      (select count(*)::int from ${job} j where j.company_id = c.id and j.published_at is not null) as published,
      (select count(*)::int from ${companyMember} m where m.company_id = c.id)
        + (select count(*)::int from ${companyInvite} i where i.company_id = c.id and i.kind = 'member' and i.status = 'pending') as colleagues,
      (select coalesce(u.two_factor_enabled, false) from ${user} u where u.id = ${viewerId}) as "twoFactor"
    from ${company} c where c.id = ${companyId}`);
  const r = rows[0];
  if (!r) return [];
  const steps: (OnboardingStep & { show: boolean })[] = [
    {
      key: "profil",
      label: "Legg til logo og beskrivelse",
      description: "Kandidatene sjekker bedriften før de søker.",
      href: `${base}?fane=profil`,
      done: Boolean(r.logoUrl && r.about?.trim()),
      show: can(role, "company.edit"),
    },
    {
      key: "avtale",
      label: "Godta databehandleravtalen",
      description: "Kreves før dere publiserer stillinger eller søker etter kandidater.",
      href: `${base}?fane=personvern`,
      done: Boolean(r.terms),
      show: can(role, "company.privacy"),
    },
    {
      key: "stilling",
      label: "Legg ut den første stillingen",
      description: "Med «Søk med Vis-profilen» havner alle søkerne på ett sted.",
      href: `${base}/stilling/ny`,
      done: num(r.published) > 0,
      show: can(role, "jobs.publish"),
    },
    {
      key: "kollega",
      label: "Inviter en kollega",
      description: "Ansett sammen: gi tilgang til dem som skal vurdere søkerne.",
      href: `${base}?fane=medlemmer`,
      done: num(r.colleagues) > 1,
      show: can(role, "members.invite"),
    },
    {
      key: "side",
      label: "Fortell hvordan dere ansetter",
      description: "Fordeler og ansettelsesprosessen gjør bedriftssiden levende.",
      href: `${base}?fane=profil`,
      done: Boolean(r.page),
      show: can(role, "company.edit"),
    },
    {
      key: "bekreft",
      label: "Bekreft bedriften",
      description: "Kandidatene stoler mer på bedrifter med hake.",
      href: `${base}?fane=profil`,
      done: Boolean(r.verified),
      show: can(role, "company.edit"),
    },
    {
      key: "tofaktor",
      label: "Slå på tofaktor",
      description: "Beskytter søkernes data hvis passordet ditt kommer på avveie.",
      href: "/profil/rediger/konto#to-trinn",
      done: Boolean(r.twoFactor),
      show: true,
    },
  ];
  return steps.filter((s) => s.show).map((s) => ({ key: s.key, label: s.label, description: s.description, href: s.href, done: s.done }));
}

/* -------------------------------------------------------------------------- */
/*  Abonnement                                                                */
/* -------------------------------------------------------------------------- */

export type Usage = Awaited<ReturnType<typeof getUsage>>;

// Abonnement-fanen: aktive stillinger og plasser (med grense), og Spart med Vis hittil og
// siste 12 måneder sammenlignet med hva Bedrift koster for samme tid.
export async function getUsage(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "company.view");
  const business = await hasBusiness(companyId);
  const yearAgo = new Date(Date.now() - 365 * 86_400_000);
  const [rows, settings, totalInput, yearInput, monthly] = await Promise.all([
    db.execute<{ activeJobs: number; members: number; pending: number; createdAt: string }>(sql`
      select
        (select count(*)::int from ${job} j where j.company_id = c.id and j.status = 'published'
          and (j.deadline is null or j.deadline >= current_date)) as "activeJobs",
        (select count(*)::int from ${companyMember} m where m.company_id = c.id) as members,
        (select count(*)::int from ${companyInvite} i
          where i.company_id = c.id and i.kind = 'member' and i.status = 'pending' and i.expires_at > now()) as pending,
        c.created_at as "createdAt"
      from ${company} c where c.id = ${companyId}`),
    getRoiSettings(companyId),
    getRoiInput(companyId, null),
    getRoiInput(companyId, yearAgo),
    getDisplayPrices().then((p) => p["business:month"].amount),
  ]);
  const r = rows[0];
  const createdAt = r ? new Date(r.createdAt) : new Date();
  // Månedene bedriften har vært på Vis siste år (minst én), til «≈ N× abonnementsprisen».
  const months = Math.min(12, Math.max(1, Math.ceil((Date.now() - Math.max(createdAt.getTime(), yearAgo.getTime())) / (30 * 86_400_000))));
  const total: Roi = computeRoi(totalInput, settings);
  const year: Roi = computeRoi({ ...yearInput, subscriptionCost: monthly * months }, settings);
  return {
    business,
    activeJobs: num(r?.activeJobs),
    jobLimit: business ? null : FREE_ACTIVE_JOBS,
    seats: num(r?.members),
    pendingSeats: num(r?.pending),
    maxSeats: MAX_MEMBERS,
    since: createdAt,
    total: { kroner: total.kroner, hours: total.hours, agency: total.agency },
    year: { kroner: year.kroner, hours: year.hours, multiple: year.multiple, months },
  };
}
