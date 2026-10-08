import "server-only";

import { after } from "next/server";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { NotificationData } from "@/db/schema";
import { audit } from "@/lib/audit";
import { hasBusiness } from "@/lib/billing";
import { requireCompanyPermission } from "@/lib/company-access";
import { can } from "@/lib/company-permissions";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";
import { later } from "@/lib/later";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { siteUrl } from "@/lib/site";
import { dispatchWebhook, type WebhookEvent } from "@/lib/webhooks";

const { company, companyMember, job, jobApplication, jobViewDay, notification, user } = schema;

export const JOB_TYPES = JOB_TYPE_LABELS;
export type JobType = keyof typeof JOB_TYPES;
export const REMOTE = REMOTE_LABELS;
export type Remote = keyof typeof REMOTE;

// Uten Bedrift-abonnement kan en bedrift ha én publisert stilling om gangen.
export const FREE_ACTIVE_JOBS = 1;

export type JobInput = {
  title: string;
  description?: string;
  location?: string | null;
  remote?: string;
  type?: string;
  applyUrl?: string | null;
  applyEmail?: string | null;
  deadline?: string | null;
  tags?: string[];
  applyMode?: string;
  // Erstatter en betalt annonse (f.eks. FINN): teller med i «Spart med Vis».
  replacedPaidAd?: boolean;
};

function clean(input: JobInput) {
  const title = input.title?.trim().slice(0, 120) ?? "";
  if (title.length < 3) throw new UserFacingError("Stillingen må ha en tittel.");
  let applyUrl = input.applyUrl?.trim() || null;
  if (applyUrl) {
    if (!/^https?:\/\//i.test(applyUrl)) applyUrl = `https://${applyUrl}`;
    if (!URL.canParse(applyUrl)) throw new UserFacingError("Søknadslenken ser ikke riktig ut.");
  }
  const applyEmail = input.applyEmail?.trim() || null;
  if (applyEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(applyEmail)) throw new UserFacingError("E-postadressen for søknader ser ikke riktig ut.");
  const deadline = input.deadline && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline) ? input.deadline : null;
  return {
    title,
    description: input.description?.trim().slice(0, 20_000) ?? "",
    location: input.location?.trim().slice(0, 100) || null,
    remote: input.remote && input.remote in REMOTE ? input.remote : "nei",
    type: input.type && input.type in JOB_TYPES ? input.type : "fulltid",
    applyUrl,
    applyEmail,
    deadline,
    tags: [...new Set((input.tags ?? []).map((t) => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 10),
    applyMode: input.applyMode === "vis" ? "vis" : "ekstern",
    replacedPaidAd: input.replacedPaidAd === true,
  };
}

// Søk med Vis-profilen trenger ingen lenke; ellers må det være en lenke eller e-post.
function assertApplyTarget(fields: ReturnType<typeof clean>) {
  if (fields.applyMode !== "vis" && !fields.applyUrl && !fields.applyEmail) {
    throw new UserFacingError("Legg inn en søknadslenke eller e-post, eller la folk søke med Vis-profilen.");
  }
}

// Sendes til bedriftens webhooks etter at svaret er sendt til brukeren.
function notifyHooks(companyId: string, event: WebhookEvent, row: { id: string; title: string; status: string }) {
  const data = { job: { id: row.id, title: row.title, status: row.status, url: `${siteUrl()}/stillinger/${row.id}` } };
  try {
    after(() => dispatchWebhook(companyId, event, data));
  } catch {
    // Utenfor en forespørsel (f.eks. i tester): send med en gang.
    void dispatchWebhook(companyId, event, data);
  }
}

const open = () => and(eq(job.status, "published"), or(isNull(job.deadline), gte(job.deadline, sql`current_date`)))!;

async function assertCanPublish(companyId: string, exceptJobId?: string) {
  if (await hasBusiness(companyId)) return;
  const conditions: SQL[] = [eq(job.companyId, companyId), open()];
  if (exceptJobId) conditions.push(ne(job.id, exceptJobId));
  const [{ n }] = await db.select({ n: count() }).from(job).where(and(...conditions));
  if (n >= FREE_ACTIVE_JOBS) {
    throw new UserFacingError("Uten Bedrift-abonnement kan dere ha én aktiv stilling om gangen. Lukk den andre eller oppgrader.");
  }
}

// Utkast kan alle i bedriften lage. Å endre, lukke eller trekke tilbake en stilling som er
// (eller har vært) ute krever en rolle som kan publisere, men ikke databehandleravtalen: den
// kreves bare for å publisere (requireCompanyPermission med jobs.publish).
async function requireJobAccess(userId: string, companyId: string, live: boolean) {
  const role = await requireCompanyPermission(userId, companyId, "jobs.draft");
  if (live && !can(role, "jobs.publish")) throw new UserFacingError("Rollen din gir ikke tilgang til dette.");
  return role;
}

export async function createJob(userId: string, companyId: string, input: JobInput, publish: boolean) {
  await requireCompanyPermission(userId, companyId, publish ? "jobs.publish" : "jobs.draft");
  const fields = clean(input);
  assertApplyTarget(fields);
  await enforce("jobPost", companyId);
  if (publish) await assertCanPublish(companyId);
  const [row] = await db
    .insert(job)
    .values({ ...fields, companyId, status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null })
    .returning({ id: job.id });
  log.info("job.create", { userId, companyId, jobId: row.id, publish });
  if (publish) {
    notifyHooks(companyId, "job.published", { id: row.id, title: fields.title, status: "published" });
    await audit({ companyId, actorId: userId, action: "job.published", targetType: "job", targetId: row.id, label: fields.title, meta: { replacedPaidAd: fields.replacedPaidAd } });
  }
  return row.id;
}

export async function updateJob(userId: string, jobId: string, input: JobInput) {
  const row = await getJobRow(jobId);
  await requireJobAccess(userId, row.companyId, row.status !== "draft");
  const fields = clean(input);
  assertApplyTarget(fields);
  await db.update(job).set(fields).where(eq(job.id, jobId));
  return row.companyId;
}

export async function setJobStatus(userId: string, jobId: string, status: "draft" | "published" | "closed") {
  const row = await getJobRow(jobId);
  if (status === "published") await requireCompanyPermission(userId, row.companyId, "jobs.publish");
  else await requireJobAccess(userId, row.companyId, row.status !== "draft" || status === "closed");
  if (status === "published") await assertCanPublish(row.companyId, jobId);
  const changed = status !== row.status;
  await db
    .update(job)
    .set({
      status,
      ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}),
      // Lagringstiden regnes fra når stillingen ble lukket; publiseres den igjen, er den åpen.
      ...(status === "closed" && changed ? { closedAt: new Date() } : {}),
      ...(status === "published" ? { closedAt: null } : {}),
    })
    .where(eq(job.id, jobId));
  if (changed && (status === "published" || status === "closed")) {
    notifyHooks(row.companyId, status === "published" ? "job.published" : "job.closed", { id: row.id, title: row.title, status });
    await audit({
      companyId: row.companyId,
      actorId: userId,
      action: status === "published" ? "job.published" : "job.closed",
      targetType: "job",
      targetId: row.id,
      label: row.title,
    });
  }
  return row.companyId;
}

// Sletter stillingen. Kandidater med åpne søknader (Ny, Intervju, Tilbud) får varsel og e-post
// før søknadene slettes sammen med stillingen.
export async function deleteJob(userId: string, jobId: string) {
  const row = await getJobRow(jobId);
  await requireCompanyPermission(userId, row.companyId, "jobs.delete");
  const notified = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ userId: jobApplication.userId, email: user.email, emailVerified: user.emailVerified, companyName: company.name, companySlug: company.slug })
      .from(jobApplication)
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .innerJoin(company, eq(company.id, job.companyId))
      .innerJoin(user, eq(user.id, jobApplication.userId))
      .where(and(eq(jobApplication.jobId, jobId), inArray(jobApplication.status, ["ny", "intervju", "tilbud"]), ne(jobApplication.userId, userId)));
    if (candidates.length > 0) {
      await tx.insert(notification).values(
        candidates.map((c) => ({
          userId: c.userId,
          actorId: userId,
          type: "application" as const,
          data: { event: "job_closed", jobId, jobTitle: row.title, companyName: c.companyName, companySlug: c.companySlug } satisfies NotificationData,
        })),
      );
    }
    await tx.delete(job).where(eq(job.id, jobId));
    await audit({ companyId: row.companyId, actorId: userId, action: "job.deleted", targetType: "job", targetId: jobId, label: row.title, meta: { notified: candidates.length } }, tx);
    return candidates;
  });
  emailDeletedJob(row.title, notified);
  log.info("job.delete", { userId, companyId: row.companyId, jobId, candidatesNotified: notified.length });
  return row.companyId;
}

function emailDeletedJob(jobTitle: string, rows: { email: string; emailVerified: boolean; companyName: string }[]) {
  if (rows.length === 0 || (!emailProviderConfigured && process.env.NODE_ENV === "production")) return;
  later(() => {
    for (const r of rows) {
      if (!r.emailVerified) continue;
      sendEmailInBackground(
        notificationEmail({
          to: r.email,
          subject: `Søknaden din hos ${r.companyName} er avsluttet`,
          heading: `«${jobTitle}» er avsluttet`,
          intro: `${r.companyName} har fjernet stillingen «${jobTitle}» fra Vis, så søknaden din er avsluttet. Søknaden og det bedriften skrev om den er slettet.`,
          path: "/soknader",
          button: "Se søknadene dine",
        }),
      );
    }
  });
}

async function getJobRow(jobId: string) {
  if (!isUuid(jobId)) throw new UserFacingError("Fant ikke stillingen.");
  const [row] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke stillingen.");
  return row;
}

/* -------------------------------------------------------------------------- */
/*  Lesing                                                                    */
/* -------------------------------------------------------------------------- */

const listColumns = {
  id: job.id,
  title: job.title,
  location: job.location,
  remote: job.remote,
  type: job.type,
  deadline: job.deadline,
  tags: job.tags,
  applyMode: job.applyMode,
  publishedAt: job.publishedAt,
  company: { id: company.id, slug: company.slug, name: company.name, logoUrl: company.logoUrl, verifiedAt: company.verifiedAt },
};

export async function listOpenJobs({ q = "", type, remote, limit = 60 }: { q?: string; type?: string | null; remote?: string | null; limit?: number } = {}) {
  const conditions: SQL[] = [open()];
  const text = q.trim();
  if (text) {
    const like = `%${text.replace(/[%_]/g, "")}%`;
    conditions.push(or(ilike(job.title, like), ilike(job.location, like), ilike(company.name, like), sql`${job.tags}::text ilike ${like}`)!);
  }
  if (type && type in JOB_TYPES) conditions.push(eq(job.type, type));
  if (remote && remote in REMOTE) conditions.push(eq(job.remote, remote));
  return db
    .select(listColumns)
    .from(job)
    .innerJoin(company, eq(company.id, job.companyId))
    .where(and(...conditions))
    .orderBy(desc(job.publishedAt))
    .limit(limit);
}

export async function listCompanyJobs(companyId: string, { includeAll = false } = {}) {
  return db
    .select({
      ...listColumns,
      status: job.status,
      views: job.views,
      applyClicks: job.applyClicks,
      replacedPaidAd: job.replacedPaidAd,
      closedAt: job.closedAt,
      createdAt: job.createdAt,
    })
    .from(job)
    .innerJoin(company, eq(company.id, job.companyId))
    .where(and(eq(job.companyId, companyId), includeAll ? undefined : open()))
    .orderBy(asc(sql`case ${job.status} when 'published' then 0 when 'draft' then 1 else 2 end`), desc(job.createdAt));
}

// En stilling med bedriften. Utkast og lukkede vises bare for bedriftens medlemmer.
export async function getJob(jobId: string, { asMember = false } = {}) {
  if (!isUuid(jobId)) return null;
  const [row] = await db
    .select({ job, company })
    .from(job)
    .innerJoin(company, eq(company.id, job.companyId))
    .where(eq(job.id, jobId))
    .limit(1);
  if (!row) return null;
  const expired = row.job.deadline !== null && row.job.deadline < new Date().toISOString().slice(0, 10);
  if ((row.job.status !== "published" || expired) && !asMember) {
    // Lukkede stillinger kan fortsatt vises (med beskjed), men ikke utkast.
    if (row.job.status === "draft") return null;
  }
  return { ...row.job, company: row.company, isOpen: row.job.status === "published" && !expired };
}

// Teller én visning: totalen på stillingen og dagen (Oslo-tid) i job_view_day, i én spørring.
// Bare publiserte stillinger, og ikke når noen i bedriften selv ser på (viewerId).
export async function countJobView(jobId: string, viewerId?: string | null) {
  if (!isUuid(jobId)) return;
  const own = viewerId ? sql`and not exists (select 1 from ${companyMember} m where m.company_id = ${job}.company_id and m.user_id = ${viewerId})` : sql``;
  await db.execute(sql`
    with hit as (
      update ${job} set views = views + 1
      where id = ${jobId} and status = 'published' ${own}
      returning id
    )
    insert into ${jobViewDay} (job_id, day, views)
    select id, (now() at time zone 'Europe/Oslo')::date, 1 from hit
    on conflict (job_id, day) do update set views = ${jobViewDay}.views + 1`);
}

// Teller et klikk på «Søk» og gir adressen brukeren skal videre til. Stillinger med
// «Søk med Vis-profilen» har søknadsskjemaet på selve stillingssiden.
export async function applyTarget(jobId: string) {
  const row = await getJob(jobId);
  if (!row || !row.isOpen || row.applyMode === "vis") return null;
  await db.update(job).set({ applyClicks: sql`${job.applyClicks} + 1` }).where(eq(job.id, jobId));
  notifyHooks(row.companyId, "job.application_click", { id: row.id, title: row.title, status: row.status });
  if (row.applyUrl) return row.applyUrl;
  if (row.applyEmail) return `mailto:${row.applyEmail}?subject=${encodeURIComponent(`Søknad: ${row.title}`)}`;
  return null;
}
