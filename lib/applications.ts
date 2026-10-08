import "server-only";

import { after } from "next/server";
import { and, asc, count, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { hasBusiness } from "@/lib/billing";
import { requireBusiness, requireCompanyRole } from "@/lib/companies";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, type ApplicationStage, type ApplicationStatus, type OpenTo } from "@/lib/constants";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { profilePath, siteUrl } from "@/lib/site";
import { outer } from "@/lib/sql";
import { usedTechSql, type ShowcaseProject } from "@/lib/talent";
import { dispatchWebhook } from "@/lib/webhooks";

const { company, companyMember, cvEducation, cvExperience, cvSkill, job, jobApplication, profile, project, projectImage, user } = schema;

// «Søk med Vis-profilen»: kandidaten søker med profilen, prosjektene og en kort melding i
// stedet for å skrive CV og søknadsbrev på nytt. Alle søkere står da i samme format, og
// bedriften flytter dem gjennom Ny → Intervju → Tilbud → Avslag. Kandidaten får beskjed
// hver gang statusen endres. Søknader slettes et år etter siste endring.

export const MAX_HIGHLIGHTS = 3;
export const MESSAGE_MAX = 3000;
export const RETENTION_MONTHS = 12;

type Applicant = { id: string; name: string; username: string; email: string; emailVerified?: boolean | null };

// Kjører etter at svaret er sendt til brukeren (e-post og webhooks skal aldri gjøre det tregt).
function later(fn: () => Promise<unknown> | void) {
  try {
    after(fn);
  } catch {
    void fn();
  }
}

async function loadJob(jobId: string) {
  if (!isUuid(jobId)) throw new UserFacingError("Fant ikke stillingen.");
  const [row] = await db
    .select({ job, company: { id: company.id, name: company.name, slug: company.slug } })
    .from(job)
    .innerJoin(company, eq(company.id, job.companyId))
    .where(eq(job.id, jobId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke stillingen.");
  const expired = row.job.deadline !== null && row.job.deadline < new Date().toISOString().slice(0, 10);
  return { ...row, isOpen: row.job.status === "published" && !expired };
}

// Prosjektene kandidaten vil fremheve: egne, publiserte, maks tre, i valgt rekkefølge.
async function cleanHighlights(userId: string, ids: string[] | undefined) {
  const wanted = [...new Set((ids ?? []).filter(isUuid))].slice(0, MAX_HIGHLIGHTS);
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.ownerId, userId), eq(project.status, "published"), inArray(project.id, wanted), sql`${project.removedAt} is null`));
  const own = new Set(rows.map((r) => r.id));
  return wanted.filter((id) => own.has(id));
}

/* -------------------------------------------------------------------------- */
/*  Kandidaten                                                                */
/* -------------------------------------------------------------------------- */

export async function applyToJob(applicant: Applicant, jobId: string, input: { message?: string | null; projectIds?: string[] }) {
  const { job: row, company: co, isOpen } = await loadJob(jobId);
  if (!isOpen) throw new UserFacingError("Stillingen er ikke lenger åpen.");
  if (row.applyMode !== "vis") throw new UserFacingError("Denne stillingen tar imot søknader et annet sted.");
  if (applicant.emailVerified === false) throw new UserFacingError("Bekreft e-postadressen din før du søker.");
  const [member] = await db
    .select({ role: companyMember.role })
    .from(companyMember)
    .where(and(eq(companyMember.companyId, co.id), eq(companyMember.userId, applicant.id)))
    .limit(1);
  if (member) throw new UserFacingError("Du kan ikke søke på en stilling i din egen bedrift.");

  const message = input.message?.trim().replace(/\n{3,}/g, "\n\n").slice(0, MESSAGE_MAX) || null;
  const projectIds = await cleanHighlights(applicant.id, input.projectIds);
  await enforce("jobApply", applicant.id);

  const [existing] = await db
    .select({ id: jobApplication.id, status: jobApplication.status })
    .from(jobApplication)
    .where(and(eq(jobApplication.jobId, jobId), eq(jobApplication.userId, applicant.id)))
    .limit(1);
  if (existing && existing.status !== "trukket") throw new UserFacingError("Du har allerede søkt på denne stillingen.");

  let id: string;
  if (existing) {
    // Søker på nytt etter å ha trukket søknaden.
    await db
      .update(jobApplication)
      .set({ status: "ny", message, projectIds, note: null, statusChangedAt: new Date(), createdAt: new Date() })
      .where(eq(jobApplication.id, existing.id));
    id = existing.id;
  } else {
    const inserted = await db.insert(jobApplication).values({ jobId, userId: applicant.id, message, projectIds }).onConflictDoNothing().returning({ id: jobApplication.id });
    if (inserted.length === 0) throw new UserFacingError("Du har allerede søkt på denne stillingen.");
    id = inserted[0].id;
  }
  log.info("application.create", { applicationId: id, jobId, companyId: co.id });

  // Varsel til alle i bedriften, e-post til eier og administratorer.
  const members = await db
    .select({ userId: companyMember.userId, role: companyMember.role, email: user.email, emailVerified: user.emailVerified })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(eq(companyMember.companyId, co.id));
  const data = { event: "new" as const, applicationId: id, jobId, jobTitle: row.title, companyName: co.name, companySlug: co.slug };
  for (const m of members) await notify({ userId: m.userId, actorId: applicant.id, type: "application", data });

  later(async () => {
    if (emailProviderConfigured || process.env.NODE_ENV !== "production") {
      for (const m of members) {
        if (m.role === "member" || !m.emailVerified) continue;
        sendEmailInBackground(
          notificationEmail({
            to: m.email,
            subject: `${applicant.name} søkte på ${row.title}`,
            heading: `Ny søknad: ${row.title}`,
            intro: `${applicant.name} (@${applicant.username}) søkte med Vis-profilen sin${projectIds.length ? ` og fremhevet ${projectIds.length === 1 ? "ett prosjekt" : `${projectIds.length} prosjekter`}` : ""}. Se profilen, prosjektene og meldingen i søkeroversikten.`,
            quote: message,
            path: `/bedrift/${co.slug}/admin/soker/${id}`,
            button: "Se søknaden",
          }),
        );
      }
    }
    await dispatchWebhook(co.id, "job.application", await webhookPayload(id));
  });
  return { id };
}

export async function withdrawApplication(userId: string, applicationId: string) {
  if (!isUuid(applicationId)) throw new UserFacingError("Fant ikke søknaden.");
  const updated = await db
    .update(jobApplication)
    .set({ status: "trukket", statusChangedAt: new Date() })
    .where(and(eq(jobApplication.id, applicationId), eq(jobApplication.userId, userId), ne(jobApplication.status, "trukket")))
    .returning({ jobId: jobApplication.jobId });
  if (updated.length === 0) throw new UserFacingError("Fant ikke søknaden.");
  return updated[0].jobId;
}

export async function getMyApplication(userId: string | null | undefined, jobId: string) {
  if (!userId || !isUuid(jobId)) return null;
  const [row] = await db
    .select({ id: jobApplication.id, status: jobApplication.status, createdAt: jobApplication.createdAt, statusChangedAt: jobApplication.statusChangedAt })
    .from(jobApplication)
    .where(and(eq(jobApplication.jobId, jobId), eq(jobApplication.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listMyApplications(userId: string) {
  return db
    .select({
      id: jobApplication.id,
      status: jobApplication.status,
      createdAt: jobApplication.createdAt,
      statusChangedAt: jobApplication.statusChangedAt,
      job: { id: job.id, title: job.title, status: job.status, deadline: job.deadline },
      company: { name: company.name, slug: company.slug, logoUrl: company.logoUrl },
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(company, eq(company.id, job.companyId))
    .where(eq(jobApplication.userId, userId))
    .orderBy(desc(jobApplication.createdAt));
}

// Egne publiserte prosjekter å velge blant når man søker.
export async function listOwnProjectsForPicker(userId: string) {
  return db
    .select({
      id: project.id,
      title: project.title,
      role: project.role,
      cover: sql<string | null>`(select ${projectImage.url} from ${projectImage} where ${projectImage.projectId} = ${outer(project.id)} order by ${projectImage.position}, ${projectImage.createdAt} limit 1)`,
    })
    .from(project)
    .where(and(eq(project.ownerId, userId), eq(project.status, "published"), sql`${project.removedAt} is null`))
    .orderBy(desc(project.pinned), desc(project.publishedAt))
    .limit(60);
}

/* -------------------------------------------------------------------------- */
/*  Bedriften                                                                 */
/* -------------------------------------------------------------------------- */

const applicantColumns = {
  id: jobApplication.id,
  status: jobApplication.status,
  message: jobApplication.message,
  note: jobApplication.note,
  projectIds: jobApplication.projectIds,
  createdAt: jobApplication.createdAt,
  statusChangedAt: jobApplication.statusChangedAt,
  job: { id: job.id, title: job.title },
  candidate: {
    id: user.id,
    name: user.name,
    username: user.username,
    image: user.image,
    email: user.email,
    headline: profile.headline,
    location: profile.location,
    openTo: profile.openTo,
    studyProgram: profile.studyProgram,
    graduationYear: profile.graduationYear,
  },
  skills: sql<string[]>`coalesce((select array_agg(${cvSkill.name} order by ${cvSkill.position}) from ${cvSkill} where ${cvSkill.userId} = ${user.id}), '{}')`,
  usedTech: usedTechSql(user.id),
};

// Prosjektene kandidaten fremhevet, i valgt rekkefølge (bare de som fortsatt er offentlige).
async function loadHighlights(ids: string[]) {
  const map = new Map<string, ShowcaseProject & { summary: string | null }>();
  const valid = [...new Set(ids.filter(isUuid))];
  if (valid.length === 0) return map;
  const rows = await db
    .select({
      id: project.id,
      title: project.title,
      role: project.role,
      summary: project.summary,
      cover: sql<string | null>`(select ${projectImage.url} from ${projectImage} where ${projectImage.projectId} = ${outer(project.id)} order by ${projectImage.position}, ${projectImage.createdAt} limit 1)`,
    })
    .from(project)
    .where(and(inArray(project.id, valid), eq(project.status, "published"), sql`${project.removedAt} is null`));
  for (const r of rows) map.set(r.id, r);
  return map;
}

type ApplicantRow = Awaited<ReturnType<typeof selectApplicants>>[number];

function selectApplicants(where: ReturnType<typeof and>) {
  return db
    .select(applicantColumns)
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(user, eq(user.id, jobApplication.userId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(where)
    .orderBy(desc(jobApplication.createdAt));
}

async function withHighlights(rows: ApplicantRow[]) {
  const highlights = await loadHighlights(rows.flatMap((r) => r.projectIds));
  return rows.map((r) => ({
    ...r,
    candidate: { ...r.candidate, openTo: (r.candidate.openTo ?? []) as OpenTo[] },
    highlights: r.projectIds.map((id) => highlights.get(id)).filter((p) => p !== undefined),
  }));
}

export type ApplicantCard = Awaited<ReturnType<typeof listApplications>>[number];

// Søkerne til bedriften (alle stillinger, eller én). Trukne søknader er med, men vises for seg.
export async function listApplications(viewerId: string, companyId: string, { jobId }: { jobId?: string | null } = {}) {
  await requireCompanyRole(viewerId, companyId);
  const rows = await selectApplicants(and(eq(job.companyId, companyId), jobId && isUuid(jobId) ? eq(job.id, jobId) : undefined));
  return withHighlights(rows);
}

export async function getApplicationForCompany(viewerId: string, applicationId: string) {
  if (!isUuid(applicationId)) return null;
  const [row] = await selectApplicants(eq(jobApplication.id, applicationId));
  if (!row) return null;
  const [{ companyId }] = await db.select({ companyId: job.companyId }).from(job).where(eq(job.id, row.job.id));
  await requireCompanyRole(viewerId, companyId);
  const [withProjects] = await withHighlights([row]);
  const [experience, education] = await Promise.all([
    db
      .select({ title: cvExperience.title, organization: cvExperience.organization, startDate: cvExperience.startDate, endDate: cvExperience.endDate })
      .from(cvExperience)
      .where(eq(cvExperience.userId, row.candidate.id))
      .orderBy(asc(cvExperience.position))
      .limit(4),
    db
      .select({ institution: cvEducation.institution, degree: cvEducation.degree, fieldOfStudy: cvEducation.fieldOfStudy, endDate: cvEducation.endDate })
      .from(cvEducation)
      .where(eq(cvEducation.userId, row.candidate.id))
      .orderBy(asc(cvEducation.position))
      .limit(3),
  ]);
  return { ...withProjects, companyId, experience, education };
}

// Antall søkere per stilling (til Stillinger-fanen): totalt og nye.
export async function countApplicationsByJob(companyId: string) {
  const rows = await db
    .select({ jobId: jobApplication.jobId, total: count(), fresh: sql<number>`count(*) filter (where ${jobApplication.status} = 'ny')::int` })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .where(and(eq(job.companyId, companyId), ne(jobApplication.status, "trukket")))
    .groupBy(jobApplication.jobId);
  return new Map(rows.map((r) => [r.jobId, { total: Number(r.total), fresh: r.fresh }]));
}

async function companyOfApplication(applicationId: string) {
  if (!isUuid(applicationId)) throw new UserFacingError("Fant ikke søknaden.");
  const [row] = await db
    .select({
      companyId: job.companyId,
      companyName: company.name,
      companySlug: company.slug,
      jobId: job.id,
      jobTitle: job.title,
      userId: jobApplication.userId,
      status: jobApplication.status,
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(company, eq(company.id, job.companyId))
    .where(eq(jobApplication.id, applicationId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke søknaden.");
  return row;
}

// Det kandidaten får vite når statusen endres. «Ny» (flyttet tilbake) sier vi ingenting om.
const STATUS_MESSAGES: Partial<Record<ApplicationStage, (c: string, j: string) => { subject: string; intro: string }>> = {
  intervju: (c, j) => ({
    subject: `${c} vil gjerne snakke med deg`,
    intro: `Søknaden din på «${j}» er flyttet til intervju. ${c} tar kontakt for å avtale tid. Lykke til!`,
  }),
  tilbud: (c, j) => ({
    subject: `Gode nyheter fra ${c}`,
    intro: `${c} vil gi deg et tilbud på «${j}». De tar kontakt med detaljene.`,
  }),
  avslag: (c, j) => ({
    subject: `Svar på søknaden din hos ${c}`,
    intro: `${c} har gått videre med andre kandidater til «${j}» denne gangen. Takk for at du søkte! Prosjektene dine ligger fortsatt på Vis, klare for neste mulighet.`,
  }),
};

// Flytter en søker i søkeroversikten (krever Bedrift). Kandidaten får varsel og e-post.
export async function setApplicationStatus(viewerId: string, applicationId: string, status: ApplicationStage) {
  if (!(APPLICATION_STAGES as readonly string[]).includes(status)) throw new UserFacingError("Ukjent status.");
  const row = await companyOfApplication(applicationId);
  await requireCompanyRole(viewerId, row.companyId);
  await requireBusiness(row.companyId);
  if (row.status === "trukket") throw new UserFacingError("Kandidaten har trukket søknaden.");
  if (row.status === status) return row.companyId;

  await db.update(jobApplication).set({ status, statusChangedAt: new Date() }).where(eq(jobApplication.id, applicationId));
  log.info("application.status", { applicationId, status, companyId: row.companyId });

  const copy = STATUS_MESSAGES[status]?.(row.companyName, row.jobTitle);
  if (copy) {
    await notify({
      userId: row.userId,
      actorId: viewerId,
      type: "application",
      data: { event: "status", status, applicationId, jobId: row.jobId, jobTitle: row.jobTitle, companyName: row.companyName, companySlug: row.companySlug },
    });
    later(async () => {
      const [candidate] = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user).where(eq(user.id, row.userId)).limit(1);
      if (candidate?.emailVerified && (emailProviderConfigured || process.env.NODE_ENV !== "production")) {
        sendEmailInBackground(notificationEmail({ to: candidate.email, subject: copy.subject, heading: copy.subject, intro: copy.intro, path: "/soknader", button: "Se søknadene dine" }));
      }
    });
  }
  later(async () => dispatchWebhook(row.companyId, "job.application_status", await webhookPayload(applicationId)));
  return row.companyId;
}

export async function setApplicationNote(viewerId: string, applicationId: string, note: string | null) {
  const row = await companyOfApplication(applicationId);
  await requireCompanyRole(viewerId, row.companyId);
  await requireBusiness(row.companyId);
  await db
    .update(jobApplication)
    .set({ note: note?.trim().slice(0, 2000) || null })
    .where(eq(jobApplication.id, applicationId));
  return row.companyId;
}

// Det webhooks får: søknaden, stillingen og kandidaten. Kandidaten delte e-posten da de søkte.
async function webhookPayload(applicationId: string) {
  const [row] = await db
    .select({
      id: jobApplication.id,
      status: jobApplication.status,
      message: jobApplication.message,
      createdAt: jobApplication.createdAt,
      jobId: job.id,
      jobTitle: job.title,
      name: user.name,
      username: user.username,
      email: user.email,
      headline: profile.headline,
      location: profile.location,
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(user, eq(user.id, jobApplication.userId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(jobApplication.id, applicationId))
    .limit(1);
  if (!row) return { application: { id: applicationId } };
  const base = siteUrl();
  return {
    application: { id: row.id, status: row.status, status_label: APPLICATION_STATUS_LABELS[row.status as ApplicationStatus], message: row.message, created: row.createdAt.toISOString() },
    job: { id: row.jobId, title: row.jobTitle, url: `${base}/stillinger/${row.jobId}` },
    candidate: { name: row.name, username: row.username, email: row.email, headline: row.headline, location: row.location, profile_url: `${base}${profilePath(row.username)}` },
  };
}

// Kan bedriften flytte søkere og skrive notater? (Bedrift-planen.)
export const canManageApplicants = (companyId: string) => hasBusiness(companyId);

// Personvern: søknader som ikke er endret på et år, slettes (planlagt jobb).
export async function deleteOldApplications() {
  const deleted = await db
    .delete(jobApplication)
    .where(lt(jobApplication.updatedAt, sql`now() - make_interval(months => ${RETENTION_MONTHS})`))
    .returning({ id: jobApplication.id });
  return deleted.length;
}
