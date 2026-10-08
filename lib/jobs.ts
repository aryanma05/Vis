import "server-only";

import { after } from "next/server";
import { and, asc, count, desc, eq, gte, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { hasBusiness } from "@/lib/billing";
import { requireCompanyRole } from "@/lib/companies";
import { JOB_TYPE_LABELS, REMOTE_LABELS } from "@/lib/constants";
import { log } from "@/lib/log";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { siteUrl } from "@/lib/site";
import { dispatchWebhook, type WebhookEvent } from "@/lib/webhooks";

const { company, job } = schema;

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

export async function createJob(userId: string, companyId: string, input: JobInput, publish: boolean) {
  await requireCompanyRole(userId, companyId);
  const fields = clean(input);
  assertApplyTarget(fields);
  await enforce("jobPost", companyId);
  if (publish) await assertCanPublish(companyId);
  const [row] = await db
    .insert(job)
    .values({ ...fields, companyId, status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null })
    .returning({ id: job.id });
  log.info("job.create", { userId, companyId, jobId: row.id, publish });
  if (publish) notifyHooks(companyId, "job.published", { id: row.id, title: fields.title, status: "published" });
  return row.id;
}

export async function updateJob(userId: string, jobId: string, input: JobInput) {
  const row = await getJobRow(jobId);
  await requireCompanyRole(userId, row.companyId);
  const fields = clean(input);
  assertApplyTarget(fields);
  await db.update(job).set(fields).where(eq(job.id, jobId));
  return row.companyId;
}

export async function setJobStatus(userId: string, jobId: string, status: "draft" | "published" | "closed") {
  const row = await getJobRow(jobId);
  await requireCompanyRole(userId, row.companyId);
  if (status === "published") await assertCanPublish(row.companyId, jobId);
  await db
    .update(job)
    .set({ status, ...(status === "published" && !row.publishedAt ? { publishedAt: new Date() } : {}) })
    .where(eq(job.id, jobId));
  if (status !== row.status && (status === "published" || status === "closed")) {
    notifyHooks(row.companyId, status === "published" ? "job.published" : "job.closed", { id: row.id, title: row.title, status });
  }
  return row.companyId;
}

export async function deleteJob(userId: string, jobId: string) {
  const row = await getJobRow(jobId);
  await requireCompanyRole(userId, row.companyId, ["owner", "admin"]);
  await db.delete(job).where(eq(job.id, jobId));
  return row.companyId;
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
    .select({ ...listColumns, status: job.status, views: job.views, applyClicks: job.applyClicks, createdAt: job.createdAt })
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

export async function countJobView(jobId: string) {
  if (!isUuid(jobId)) return;
  await db.update(job).set({ views: sql`${job.views} + 1` }).where(and(eq(job.id, jobId), eq(job.status, "published")));
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
