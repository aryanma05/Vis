import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit, auditViewOnce } from "@/lib/audit";
import { requireBusiness } from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import type { TemplateKind } from "@/lib/company-labels";
import { can } from "@/lib/company-permissions";
import { later } from "@/lib/later";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, type ApplicationStage, type ApplicationStatus, type OpenTo } from "@/lib/constants";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { pickTemplate, renderMessage, templateEmail } from "@/lib/message-templates";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { profilePath, siteUrl } from "@/lib/site";
import { outer } from "@/lib/sql";
import { usedTechSql, type ShowcaseProject } from "@/lib/talent";
import { templateVars, type TemplateText } from "@/lib/template-render";
import { dispatchWebhook } from "@/lib/webhooks";

const { applicationNote, applicationReview, company, companyMember, cvEducation, cvExperience, cvSkill, interviewSlot, job, jobApplication, profile, project, projectImage, user } =
  schema;

// «Søk med Vis-profilen»: kandidaten søker med profilen, prosjektene og en kort melding i
// stedet for å skrive CV og søknadsbrev på nytt. Alle søkere står da i samme format, og
// bedriften flytter dem gjennom Ny → Intervju → Tilbud → Avslag. Kandidaten får beskjed
// (mal) hver gang statusen endres. Søknaden slettes ved expiresAt (lib/retention.ts).

export const MAX_HIGHLIGHTS = 3;
export const MESSAGE_MAX = 3000;
// Massehandlinger: maks søkere per gang.
export const BULK_MAX = 100;
// Søkere som har stått i Ny lenger enn dette, «venter» (chip, filter og daglig e-post).
export const WAITING_DAYS = 7;

type Applicant = { id: string; name: string; username: string; email: string; emailVerified?: boolean | null };

const canEmail = () => emailProviderConfigured || process.env.NODE_ENV !== "production";
// Lenken kandidaten booker intervju med (P5 eier siden).
export const bookingUrl = (applicationId: string) => `${siteUrl()}/soknader/${applicationId}/book`;

async function loadJob(jobId: string) {
  if (!isUuid(jobId)) throw new UserFacingError("Fant ikke stillingen.");
  const [row] = await db
    .select({ job, company: { id: company.id, name: company.name, slug: company.slug, autoReply: company.autoReply, responseDays: company.responseDays } })
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

// Stillingene som har ledige intervjutider mer enn 2 timer frem. Bare da får kandidaten
// {bookinglenke}; ellers fjernes linjen i malen.
async function jobsWithOpenSlots(jobIds: string[]) {
  const ids = [...new Set(jobIds.filter(isUuid))];
  if (ids.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ jobId: interviewSlot.jobId })
    .from(interviewSlot)
    .where(and(inArray(interviewSlot.jobId, ids), isNull(interviewSlot.applicationId), sql`${interviewSlot.startsAt} > now() + interval '2 hours'`));
  return new Set(rows.map((r) => r.jobId));
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
    // Søker på nytt etter å ha trukket søknaden: en ny søknad med ny lagringstid.
    await db
      .update(jobApplication)
      .set({
        status: "ny",
        message,
        projectIds,
        note: null,
        statusChangedAt: new Date(),
        createdAt: new Date(),
        expiresAt: sql`now() + interval '12 months'`,
        firstResponseAt: null,
        hiredAt: null,
        agencyAvoided: false,
      })
      .where(and(eq(jobApplication.id, existing.id), eq(jobApplication.status, "trukket")));
    id = existing.id;
  } else {
    // Åpen stilling: slettes 12 måneder etter søknaden (standardverdien i databasen).
    const inserted = await db.insert(jobApplication).values({ jobId, userId: applicant.id, message, projectIds }).onConflictDoNothing().returning({ id: jobApplication.id });
    if (inserted.length === 0) throw new UserFacingError("Du har allerede søkt på denne stillingen.");
    id = inserted[0].id;
  }
  log.info("application.create", { applicationId: id, jobId, companyId: co.id });

  // Varsel til alle i bedriften, e-post til eier og administratorer (som før).
  const members = await db
    .select({ userId: companyMember.userId, role: companyMember.role, email: user.email, emailVerified: user.emailVerified })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(eq(companyMember.companyId, co.id));
  const data = { event: "new" as const, applicationId: id, jobId, jobTitle: row.title, companyName: co.name, companySlug: co.slug };
  for (const m of members) await notify({ userId: m.userId, actorId: applicant.id, type: "application", data });

  later(async () => {
    try {
      if (canEmail()) {
        for (const m of members) {
          if ((m.role !== "owner" && m.role !== "admin") || !m.emailVerified) continue;
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
        // «Takk for søknaden» (alle planer, kan slås av): bedriftens egen mal med Bedrift, ellers standardmalen.
        if (co.autoReply) {
          const template = await pickTemplate(co.id, "takk");
          const vars = templateVars({ name: applicant.name, jobTitle: row.title, companyName: co.name, responseDays: co.responseDays });
          sendEmailInBackground(templateEmail(applicant.email, renderMessage(template, vars), { path: "/soknader", button: "Se søknadene dine" }));
        }
      }
      await dispatchWebhook(co.id, "job.application", await webhookPayload(id));
    } catch (error) {
      log.error("application.create.after", { error, applicationId: id });
    }
  });
  return { id };
}

// Trekker søknaden: meldingen, notatet og prosjektvalget tømmes med en gang, notater,
// vurderinger og intervjutid slettes, og søknaden slettes senest om 30 dager. Bedriften ser
// bare navnet og «Trukket».
export async function withdrawApplication(userId: string, applicationId: string) {
  if (!isUuid(applicationId)) throw new UserFacingError("Fant ikke søknaden.");
  const jobId = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(jobApplication)
      .set({
        status: "trukket",
        statusChangedAt: new Date(),
        message: null,
        note: null,
        projectIds: [],
        hiredAt: null,
        agencyAvoided: false,
        expiresAt: sql`least(${jobApplication.expiresAt}, now() + interval '30 days')`,
      })
      .where(and(eq(jobApplication.id, applicationId), eq(jobApplication.userId, userId), ne(jobApplication.status, "trukket")))
      .returning({ jobId: jobApplication.jobId });
    if (!row) throw new UserFacingError("Fant ikke søknaden.");
    await tx.delete(applicationNote).where(eq(applicationNote.applicationId, applicationId));
    await tx.delete(applicationReview).where(eq(applicationReview.applicationId, applicationId));
    await tx.update(interviewSlot).set({ applicationId: null, bookedAt: null, reminderSentAt: null }).where(eq(interviewSlot.applicationId, applicationId));
    return row.jobId;
  });

  // Varsel til dem som flytter søkere (eier, administratorer og rekrutterere).
  const [info] = await db
    .select({ companyId: company.id, companyName: company.name, companySlug: company.slug, jobTitle: job.title })
    .from(job)
    .innerJoin(company, eq(company.id, job.companyId))
    .where(eq(job.id, jobId))
    .limit(1);
  if (info) {
    const members = await db.select({ userId: companyMember.userId, role: companyMember.role }).from(companyMember).where(eq(companyMember.companyId, info.companyId));
    const data = { event: "withdrawn" as const, applicationId, jobId, jobTitle: info.jobTitle, companyName: info.companyName, companySlug: info.companySlug };
    for (const m of members) if (can(m.role, "applications.move")) await notify({ userId: m.userId, actorId: userId, type: "application", data });
    later(async () => {
      try {
        await dispatchWebhook(info.companyId, "job.application_status", await webhookPayload(applicationId));
      } catch (error) {
        log.error("application.withdraw.after", { error, applicationId });
      }
    });
  }
  return jobId;
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
  projectIds: jobApplication.projectIds,
  createdAt: jobApplication.createdAt,
  statusChangedAt: jobApplication.statusChangedAt,
  hiredAt: jobApplication.hiredAt,
  agencyAvoided: jobApplication.agencyAvoided,
  firstResponseAt: jobApplication.firstResponseAt,
  expiresAt: jobApplication.expiresAt,
  job: { id: job.id, title: job.title },
  companyId: job.companyId,
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
  noteCount: sql<number>`(select count(*)::int from ${applicationNote} where ${applicationNote.applicationId} = ${outer(jobApplication.id)})`,
  reviewCount: sql<number>`(select count(*)::int from ${applicationReview} where ${applicationReview.applicationId} = ${outer(jobApplication.id)})`,
  interviewAt: sql<Date | null>`(select ${interviewSlot.startsAt} from ${interviewSlot} where ${interviewSlot.applicationId} = ${outer(jobApplication.id)} limit 1)`.mapWith(interviewSlot.startsAt),
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

function selectApplicants(where: SQL | undefined) {
  return db
    .select(applicantColumns)
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(user, eq(user.id, jobApplication.userId))
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(where)
    .orderBy(desc(jobApplication.createdAt));
}

// Det bedriften får se. E-posten bare for roller med applications.contactDetails (ikke
// vurderere). Trukne søknader tømmes for alt utenom navn, brukernavn, bilde og stilling, så
// de har samme form, men ingen personopplysninger utover navnet.
async function present(rows: ApplicantRow[], contact: boolean) {
  const active = rows.filter((r) => r.status !== "trukket");
  const highlights = await loadHighlights(active.flatMap((r) => r.projectIds));
  return rows.map((r) => {
    const withdrawn = r.status === "trukket";
    const { companyId: _companyId, projectIds: _projectIds, ...rest } = r;
    void _companyId;
    void _projectIds;
    if (withdrawn) {
      return {
        ...rest,
        withdrawn,
        message: null,
        hiredAt: null,
        agencyAvoided: false,
        firstResponseAt: null,
        noteCount: 0,
        reviewCount: 0,
        interviewAt: null,
        skills: [] as string[],
        usedTech: [] as { name: string; n: number }[],
        candidate: { id: r.candidate.id, name: r.candidate.name, username: r.candidate.username, image: r.candidate.image, email: null, headline: null, location: null, openTo: [] as OpenTo[], studyProgram: null, graduationYear: null },
        highlights: [] as (ShowcaseProject & { summary: string | null })[],
      };
    }
    return {
      ...rest,
      withdrawn,
      noteCount: Number(r.noteCount),
      reviewCount: Number(r.reviewCount),
      candidate: { ...r.candidate, email: contact ? r.candidate.email : null, openTo: (r.candidate.openTo ?? []) as OpenTo[] },
      highlights: r.projectIds.map((id) => highlights.get(id)).filter((p) => p !== undefined),
    };
  });
}

export type ApplicantCard = Awaited<ReturnType<typeof listApplications>>[number];
// Filtrene over søkeroversikten (?for=…).
export type ApplicantFilter = "venter" | "nevninger";

// Søkerne til bedriften (alle stillinger, eller én). Trukne søknader er med, men tømt.
// filter: «venter» = over 7 dager i Ny, «nevninger» = notater som nevner deg.
export async function listApplications(viewerId: string, companyId: string, { jobId, filter }: { jobId?: string | null; filter?: string | null } = {}) {
  const role = await requireCompanyPermission(viewerId, companyId, "applications.view");
  const rows = await selectApplicants(
    and(
      eq(job.companyId, companyId),
      jobId && isUuid(jobId) ? eq(job.id, jobId) : undefined,
      filter === "venter" ? and(eq(jobApplication.status, "ny"), sql`${jobApplication.statusChangedAt} < now() - make_interval(days => ${WAITING_DAYS})`) : undefined,
      filter === "nevninger"
        ? sql`exists (select 1 from ${applicationNote} where ${applicationNote.applicationId} = ${jobApplication.id} and ${applicationNote.mentionIds} @> ${JSON.stringify([viewerId])}::jsonb)`
        : undefined,
    ),
  );
  return present(rows, can(role, "applications.contactDetails"));
}

// Tallene på filterchipsene og hvilke stillinger som har ledige intervjutider.
export async function getPipelineExtras(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "applications.view");
  const [counts] = await db
    .select({
      waiting: sql<number>`count(*) filter (where ${jobApplication.status} = 'ny' and ${jobApplication.statusChangedAt} < now() - make_interval(days => ${WAITING_DAYS}))::int`,
      mentions: sql<number>`count(*) filter (where ${jobApplication.status} <> 'trukket' and exists (select 1 from ${applicationNote} where ${applicationNote.applicationId} = ${jobApplication.id} and ${applicationNote.mentionIds} @> ${JSON.stringify([viewerId])}::jsonb))::int`,
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .where(eq(job.companyId, companyId));
  const jobs = await db.select({ id: job.id }).from(job).where(eq(job.companyId, companyId));
  const open = await jobsWithOpenSlots(jobs.map((j) => j.id));
  return { waiting: Number(counts?.waiting ?? 0), mentions: Number(counts?.mentions ?? 0), openSlotJobs: [...open] };
}

// Én søker på søkersiden. Åpningen logges (maks én gang per person, søknad og dag).
export async function getApplicationForCompany(viewerId: string, applicationId: string) {
  if (!isUuid(applicationId)) return null;
  const [row] = await selectApplicants(eq(jobApplication.id, applicationId));
  if (!row) return null;
  const role = await requireCompanyPermission(viewerId, row.companyId, "applications.view");
  const contactDetails = can(role, "applications.contactDetails");
  await auditViewOnce(row.companyId, viewerId, applicationId, row.candidate.id);
  const [presented] = await present([row], contactDetails);
  const base = { companyId: row.companyId, role, contactDetails };
  if (presented.withdrawn) return { ...presented, ...base, withdrawn: true as const, experience: [], education: [], interview: null };

  const [experience, education, [interview]] = await Promise.all([
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
    db
      .select({
        id: interviewSlot.id,
        startsAt: interviewSlot.startsAt,
        durationMin: interviewSlot.durationMin,
        location: interviewSlot.location,
        meetingUrl: interviewSlot.meetingUrl,
        hostName: user.name,
      })
      .from(interviewSlot)
      .leftJoin(user, eq(user.id, interviewSlot.hostId))
      .where(and(eq(interviewSlot.applicationId, applicationId), eq(interviewSlot.companyId, row.companyId)))
      .limit(1),
  ]);
  const open = await jobsWithOpenSlots([row.job.id]);
  return { ...presented, ...base, withdrawn: false as const, experience, education, interview: interview ?? null, canBook: open.has(row.job.id) };
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
      jobId: job.id,
      jobTitle: job.title,
      userId: jobApplication.userId,
      status: jobApplication.status,
      hiredAt: jobApplication.hiredAt,
    })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .where(eq(jobApplication.id, applicationId))
    .limit(1);
  if (!row) throw new UserFacingError("Fant ikke søknaden.");
  return row;
}

async function loadCompany(companyId: string) {
  const [row] = await db.select({ id: company.id, name: company.name, slug: company.slug, responseDays: company.responseDays }).from(company).where(eq(company.id, companyId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke bedriften.");
  return row;
}

/* -------------------------------------------------------------------------- */
/*  Status, maler og massehandlinger                                          */
/* -------------------------------------------------------------------------- */

// Malen som sendes når søkeren flyttes hit. «Ny» (flyttet tilbake) sier vi ingenting om.
const STAGE_TEMPLATE: Partial<Record<ApplicationStage, TemplateKind>> = { intervju: "intervju", tilbud: "tilbud", avslag: "avslag" };

const isStage = (value: unknown): value is ApplicationStage => (APPLICATION_STAGES as readonly unknown[]).includes(value);

type CompanyInfo = Awaited<ReturnType<typeof loadCompany>>;
type Moved = { id: string; userId: string; jobId: string; jobTitle: string; name: string };

// Flytter søkerne som fortsatt kan flyttes (tilhører bedriften, ikke trukket, ikke allerede
// der) og gir dem som ble flyttet. Første flytt ut av Ny setter firstResponseAt; ut av Tilbud
// nullstilles «ansatt». Kandidatene får varsel og malen på e-post, og webhooks får beskjed.
async function moveApplicants(viewerId: string, co: CompanyInfo, ids: string[], status: ApplicationStage, template: TemplateText | null): Promise<Moved[]> {
  if (ids.length === 0) return [];
  const candidates = await db
    .select({ id: jobApplication.id, userId: jobApplication.userId, jobId: job.id, jobTitle: job.title, name: user.name })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(user, eq(user.id, jobApplication.userId))
    .where(and(inArray(jobApplication.id, ids), eq(job.companyId, co.id), notInArray(jobApplication.status, ["trukket", status])));
  if (candidates.length === 0) return [];

  const updated = await db
    .update(jobApplication)
    .set({
      status,
      statusChangedAt: new Date(),
      ...(status !== "ny" ? { firstResponseAt: sql`coalesce(${jobApplication.firstResponseAt}, now())` } : {}),
      ...(status !== "tilbud" ? { hiredAt: null, agencyAvoided: false } : {}),
    })
    .where(
      and(
        inArray(
          jobApplication.id,
          candidates.map((c) => c.id),
        ),
        notInArray(jobApplication.status, ["trukket", status]),
      ),
    )
    .returning({ id: jobApplication.id });
  const done = new Set(updated.map((u) => u.id));
  const moved = candidates.filter((c) => done.has(c.id));
  log.info("application.status", { companyId: co.id, status, n: moved.length });

  if (template) {
    for (const m of moved) {
      await notify({
        userId: m.userId,
        actorId: viewerId,
        type: "application",
        data: { event: "status", status, applicationId: m.id, jobId: m.jobId, jobTitle: m.jobTitle, companyName: co.name, companySlug: co.slug },
      });
    }
  }

  later(async () => {
    try {
      if (template && canEmail()) {
        const recipients = await db
          .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
          .from(user)
          .where(
            inArray(
              user.id,
              moved.map((m) => m.userId),
            ),
          );
        const byId = new Map(recipients.map((r) => [r.id, r]));
        const booking = status === "intervju" ? await jobsWithOpenSlots(moved.map((m) => m.jobId)) : new Set<string>();
        for (const m of moved) {
          const to = byId.get(m.userId);
          if (!to?.emailVerified) continue;
          const vars = templateVars({ name: m.name, jobTitle: m.jobTitle, companyName: co.name, responseDays: co.responseDays, bookingUrl: booking.has(m.jobId) ? bookingUrl(m.id) : null });
          sendEmailInBackground(templateEmail(to.email, renderMessage(template, vars), { path: "/soknader", button: "Se søknadene dine" }));
        }
      }
      for (const m of moved) await dispatchWebhook(co.id, "job.application_status", await webhookPayload(m.id));
    } catch (error) {
      log.error("application.status.after", { error, companyId: co.id });
    }
  });
  return moved;
}

// Flytter én søker (krever Bedrift). templateId: valgt mal; ellers bedriftens nyeste egne mal
// av typen, ellers standardmalen. Kandidaten får alltid varsel i appen.
export async function setApplicationStatus(viewerId: string, applicationId: string, status: ApplicationStage, { templateId }: { templateId?: string | null } = {}) {
  if (!isStage(status)) throw new UserFacingError("Ukjent status.");
  const row = await companyOfApplication(applicationId);
  await requireCompanyPermission(viewerId, row.companyId, "applications.move");
  await requireBusiness(row.companyId);
  if (row.status === "trukket") throw new UserFacingError("Kandidaten har trukket søknaden.");
  if (row.status === status) return row.companyId;

  const kind = STAGE_TEMPLATE[status];
  const template = kind ? await pickTemplate(row.companyId, kind, templateId) : null;
  const co = await loadCompany(row.companyId);
  const moved = await moveApplicants(viewerId, co, [applicationId], status, template);
  if (moved.length > 0) {
    await audit({
      companyId: row.companyId,
      actorId: viewerId,
      action: "application.status",
      targetType: "application",
      targetId: applicationId,
      subjectUserId: row.userId,
      label: row.jobTitle,
      meta: { from: row.status, status, sent: Boolean(template) },
    });
  }
  return row.companyId;
}

// «Velg» på søkeroversikten: flytt eller avslå opptil 100 søkere med samme mal. Trukne søknader
// og søkere som allerede står der, hoppes over. Én rad i aktivitetsloggen med antallet.
export async function bulkSetApplicationStatus(viewerId: string, companyId: string, ids: string[], status: ApplicationStage, templateId?: string | null) {
  if (!isUuid(companyId)) throw new UserFacingError("Fant ikke bedriften.");
  if (!isStage(status)) throw new UserFacingError("Ukjent status.");
  await requireCompanyPermission(viewerId, companyId, "applications.bulk");
  await requireBusiness(companyId);
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (wanted.length > BULK_MAX) throw new UserFacingError("Velg maks {n} søkere om gangen.", { n: BULK_MAX });
  const valid = wanted.filter(isUuid);
  if (valid.length === 0) throw new UserFacingError("Velg minst én søker.");
  await enforce("bulkAction", companyId);

  const kind = STAGE_TEMPLATE[status];
  const template = kind ? await pickTemplate(companyId, kind, templateId) : null;
  const co = await loadCompany(companyId);
  const moved = await moveApplicants(viewerId, co, valid, status, template);
  const result = { changed: moved.length, skipped: wanted.length - moved.length };
  if (moved.length > 0) {
    await audit({
      companyId,
      actorId: viewerId,
      action: "application.bulk_status",
      targetType: "company",
      targetId: companyId,
      meta: { status, n: result.changed, skipped: result.skipped, sent: Boolean(template) },
    });
  }
  return result;
}

// Lukkedialogen: «Send avslag til {n} som står i Ny». Alle i Ny på stillingen får avslag med
// bedriftens avslagsmal (eller standardmalen), i bolker på 100. Én rad i loggen.
export async function rejectWaitingApplicants(viewerId: string, jobId: string) {
  if (!isUuid(jobId)) throw new UserFacingError("Fant ikke stillingen.");
  const [row] = await db.select({ companyId: job.companyId, title: job.title }).from(job).where(eq(job.id, jobId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke stillingen.");
  await requireCompanyPermission(viewerId, row.companyId, "applications.bulk");
  await requireBusiness(row.companyId);
  const waiting = await db
    .select({ id: jobApplication.id })
    .from(jobApplication)
    .where(and(eq(jobApplication.jobId, jobId), eq(jobApplication.status, "ny")));
  if (waiting.length === 0) return { changed: 0, companyId: row.companyId };
  await enforce("bulkAction", row.companyId);

  const template = await pickTemplate(row.companyId, "avslag");
  const co = await loadCompany(row.companyId);
  let changed = 0;
  for (let i = 0; i < waiting.length; i += BULK_MAX) {
    const moved = await moveApplicants(
      viewerId,
      co,
      waiting.slice(i, i + BULK_MAX).map((w) => w.id),
      "avslag",
      template,
    );
    changed += moved.length;
  }
  if (changed > 0) {
    await audit({ companyId: row.companyId, actorId: viewerId, action: "application.bulk_status", targetType: "job", targetId: jobId, label: row.title, meta: { status: "avslag", n: changed, skipped: 0, sent: true } });
  }
  return { changed, companyId: row.companyId };
}

/* -------------------------------------------------------------------------- */
/*  Ansatt (Spart med Vis)                                                    */
/* -------------------------------------------------------------------------- */

// «Marker som ansatt» på søkere i Tilbud. agencyAvoided: «Ville dere ellers brukt
// rekrutteringsbyrå?» (teller i Spart med Vis). Kandidaten får ingen beskjed.
export async function markHired(viewerId: string, applicationId: string, { agencyAvoided }: { agencyAvoided: boolean }) {
  const row = await companyOfApplication(applicationId);
  await requireCompanyPermission(viewerId, row.companyId, "applications.hire");
  await requireBusiness(row.companyId);
  if (row.status !== "tilbud") throw new UserFacingError("Bare søkere i Tilbud kan markeres som ansatt.");
  const updated = await db
    .update(jobApplication)
    .set({ hiredAt: sql`coalesce(${jobApplication.hiredAt}, now())`, agencyAvoided: Boolean(agencyAvoided) })
    .where(and(eq(jobApplication.id, applicationId), eq(jobApplication.status, "tilbud")))
    .returning({ id: jobApplication.id });
  if (updated.length === 0) throw new UserFacingError("Bare søkere i Tilbud kan markeres som ansatt.");
  await audit({
    companyId: row.companyId,
    actorId: viewerId,
    action: "application.hired",
    targetType: "application",
    targetId: applicationId,
    subjectUserId: row.userId,
    label: row.jobTitle,
    meta: { agencyAvoided: Boolean(agencyAvoided) },
  });
  return row.companyId;
}

export async function unmarkHired(viewerId: string, applicationId: string) {
  const row = await companyOfApplication(applicationId);
  await requireCompanyPermission(viewerId, row.companyId, "applications.hire");
  await requireBusiness(row.companyId);
  await db.update(jobApplication).set({ hiredAt: null, agencyAvoided: false }).where(eq(jobApplication.id, applicationId));
  log.info("application.unhired", { applicationId, companyId: row.companyId });
  return row.companyId;
}

/* -------------------------------------------------------------------------- */
/*  Webhooks                                                                  */
/* -------------------------------------------------------------------------- */

// Det webhooks får: søknaden, stillingen og kandidaten. Kandidaten delte e-posten da de søkte.
// lib/webhooks.ts fjerner kandidaten og meldingen når kroken ikke har personopplysninger på.
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
