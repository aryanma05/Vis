import "server-only";

import { and, asc, count, desc, eq, gt, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { requireBusiness } from "@/lib/companies";
import { getCompanyGate, requireCompanyPermission } from "@/lib/company-access";
import { can } from "@/lib/company-permissions";
import { notBlockedSql } from "@/lib/company-privacy";
import { FIELDS, OPEN_TO, type FieldKey, type OpenTo } from "@/lib/constants";
import { log } from "@/lib/log";
import { notify } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { check, enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { profilePath, siteUrl } from "@/lib/site";
import { outer } from "@/lib/sql";

const { company, cvSkill, profile, project, projectImage, projectTag, tag, talentList, talentListMember, user } = schema;

// Kandidatsøk for bedrifter med Bedrift-abonnement. Bare folk som selv har slått på
// «Synlig for bedrifter» kommer med, og bare det som allerede står offentlig på profilen.
// Den som har blokkert bedriften, finnes aldri: ikke i søk, lister, varsler eller kontakt.

// `student`: har studieretning eller ferdig-år på profilen, eller er åpen for sommerjobb/internship.
export type CandidateFilters = { q?: string; location?: string | null; openTo?: OpenTo | null; field?: FieldKey | null; student?: boolean };

// Teknologiene personen faktisk har brukt: taggene på de publiserte prosjektene, med antall.
// Sier mer enn en liste med ferdigheter, fordi hvert tall peker på et prosjekt man kan se.
export const usedTechSql = (userId: SQL | typeof user.id) => sql<{ name: string; n: number }[]>`coalesce((
  select json_agg(json_build_object('name', x.name, 'n', x.n) order by x.n desc, x.name) from (
    select ${tag.name} as name, count(*)::int as n from ${projectTag}
    join ${project} on ${project.id} = ${projectTag.projectId}
    join ${tag} on ${tag.id} = ${projectTag.tagId}
    where ${project.ownerId} = ${userId} and ${project.status} = 'published' and ${project.removedAt} is null
    group by ${tag.name} order by n desc, ${tag.name} limit 8
  ) x), '[]'::json)`;

export const candidateColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  headline: profile.headline,
  location: profile.location,
  openTo: profile.openTo,
  studyProgram: profile.studyProgram,
  graduationYear: profile.graduationYear,
  skills: sql<string[]>`coalesce((select array_agg(${cvSkill.name} order by ${cvSkill.position}) from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)}), '{}')`,
  projects: sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${outer(user.id)} and ${project.status} = 'published' and ${project.removedAt} is null)`,
  usedTech: usedTechSql(outer(user.id)),
};

export type ShowcaseProject = { id: string; title: string; role: string | null; cover: string | null };

// Opptil `perUser` prosjekter per person (festede først, så nyeste), med forsidebilde.
// Brukes i kandidatsøket og søkeroversikten: «se hva de har laget» før man leser mer.
export async function loadShowcase(userIds: string[], perUser = 3) {
  const map = new Map<string, ShowcaseProject[]>();
  if (userIds.length === 0) return map;
  const rows = await db.execute<{ id: string; owner_id: string; title: string; role: string | null; cover: string | null }>(sql`
    select id, owner_id, title, role, cover from (
      select p.id, p.owner_id, p.title, p.role,
        (select i.url from ${projectImage} i where i.project_id = p.id order by i.position, i.created_at limit 1) as cover,
        row_number() over (partition by p.owner_id order by p.pinned desc, p.published_at desc nulls last) as rn
      from ${project} p
      where p.owner_id in (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})
        and p.status = 'published' and p.removed_at is null
    ) x where rn <= ${perUser}
    order by owner_id, rn`);
  for (const r of rows) map.set(r.owner_id, [...(map.get(r.owner_id) ?? []), { id: r.id, title: r.title, role: r.role, cover: r.cover }]);
  return map;
}

// Vilkårene for et kandidatsøk. Deles med lagrede søk (lib/saved-searches.ts). Med
// companyId tas de som har blokkert bedriften bort.
export function candidateConditions(filters: CandidateFilters, companyId?: string | null): SQL[] {
  const conditions: SQL[] = [eq(profile.visibleToCompanies, true), sql`coalesce(${user.banned}, false) = false`];
  if (companyId) conditions.push(notBlockedSql(companyId));
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    conditions.push(
      or(
        ilike(user.name, like),
        ilike(profile.headline, like),
        ilike(profile.bio, like),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and ${cvSkill.name} ilike ${like})`,
      )!,
    );
  }
  if (filters.location?.trim()) conditions.push(ilike(profile.location, `%${filters.location.trim().replace(/[%_]/g, "")}%`));
  if (filters.openTo && OPEN_TO.includes(filters.openTo)) conditions.push(sql`${profile.openTo} @> ${JSON.stringify([filters.openTo])}::jsonb`);
  if (filters.field && FIELDS[filters.field]) {
    const words = FIELDS[filters.field].words;
    conditions.push(
      or(
        ...words.map((w) => ilike(profile.headline, `%${w}%`)),
        sql`exists (select 1 from ${cvSkill} where ${cvSkill.userId} = ${outer(user.id)} and (${sql.join(
          words.map((w) => sql`${cvSkill.name} ilike ${`%${w}%`}`),
          sql` or `,
        )}))`,
      )!,
    );
  }
  if (filters.student) {
    conditions.push(
      or(isNotNull(profile.studyProgram), isNotNull(profile.graduationYear), sql`${profile.openTo} @> ${JSON.stringify(["sommerjobb"])}::jsonb`)!,
    );
  }
  return conditions;
}

export async function searchCandidates(viewerId: string, companyId: string, filters: CandidateFilters, limit = 50) {
  await requireCompanyPermission(viewerId, companyId, "candidates.search");
  await requireBusiness(companyId);
  await enforce("candidateSearch", companyId);

  const rows = await db
    .select(candidateColumns)
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(and(...candidateConditions(filters, companyId)))
    .orderBy(desc(candidateColumns.projects), asc(user.name))
    .limit(Math.min(limit, 100));
  const showcase = await loadShowcase(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, showcase: showcase.get(r.id) ?? [] }));
}

// Kandidater som passer et søk og ble synlige etter `since` (nye siden sist), uten dem som
// har blokkert bedriften.
export async function newCandidatesSince(companyId: string, filters: CandidateFilters, since: Date, limit = 20) {
  return db
    .select({ id: user.id, name: user.name, username: user.username, headline: profile.headline, location: profile.location })
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(and(...candidateConditions(filters, companyId), gt(profile.visibleSince, since)))
    .orderBy(desc(profile.visibleSince))
    .limit(limit);
}

/* -------------------------------------------------------------------------- */
/*  Lister                                                                    */
/* -------------------------------------------------------------------------- */

// De som vises i en liste: fortsatt synlige, ikke utløpt og har ikke blokkert bedriften.
// Kolonnene skrives med tabellnavn (outer), så det også virker i underspørringer.
const shownMember = (companyId: string) =>
  sql`${outer(talentListMember.expiresAt)} > now()
    and exists (select 1 from profile p where p.user_id = ${outer(talentListMember.userId)} and p.visible_to_companies)
    and ${notBlockedSql(companyId, outer(talentListMember.userId))}`;

export async function listTalentLists(viewerId: string, companyId: string) {
  await requireCompanyPermission(viewerId, companyId, "lists.edit");
  const lists = await db
    .select({
      id: talentList.id,
      name: talentList.name,
      createdAt: talentList.createdAt,
      members: sql<number>`(select count(*)::int from ${talentListMember} where ${outer(talentListMember.listId)} = ${outer(talentList.id)} and ${shownMember(companyId)})`,
    })
    .from(talentList)
    .where(eq(talentList.companyId, companyId))
    .orderBy(desc(talentList.createdAt));
  // De fire sist lagt til i hver liste, til avatarene i oversikten.
  const ids = lists.map((l) => l.id);
  const previews = ids.length
    ? await db.execute<{ list_id: string; name: string; image: string | null }>(sql`
        select list_id, name, image from (
          select m.list_id, u.name, u.image, row_number() over (partition by m.list_id order by m.added_at desc) as rn
          from ${talentListMember} m join "user" u on u.id = m.user_id
          where m.list_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) and m.expires_at > now()
            and exists (select 1 from profile p where p.user_id = m.user_id and p.visible_to_companies)
            and not exists (select 1 from company_block b where b.user_id = m.user_id and b.company_id = ${companyId})
        ) x where rn <= 4`)
    : [];
  return lists.map((l) => ({ ...l, preview: previews.filter((p) => p.list_id === l.id).map((p) => ({ name: p.name, image: p.image })) }));
}

export async function createTalentList(viewerId: string, companyId: string, name: string) {
  await requireCompanyPermission(viewerId, companyId, "lists.edit");
  await requireBusiness(companyId);
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new UserFacingError("Listen må ha et navn.");
  const [{ n }] = await db.select({ n: count() }).from(talentList).where(eq(talentList.companyId, companyId));
  if (n >= 100) throw new UserFacingError("Dere kan ha opptil 100 lister.");
  const [row] = await db.insert(talentList).values({ companyId, name: clean }).returning({ id: talentList.id });
  return row.id;
}

async function listCompany(listId: string) {
  if (!isUuid(listId)) throw new UserFacingError("Fant ikke listen.");
  const [row] = await db.select({ companyId: talentList.companyId, name: talentList.name }).from(talentList).where(eq(talentList.id, listId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke listen.");
  return row;
}

export async function deleteTalentList(viewerId: string, listId: string) {
  const { companyId, name } = await listCompany(listId);
  await requireCompanyPermission(viewerId, companyId, "lists.delete");
  const [{ n }] = await db.select({ n: count() }).from(talentListMember).where(eq(talentListMember.listId, listId));
  await db.delete(talentList).where(eq(talentList.id, listId));
  await audit({ companyId, actorId: viewerId, action: "list.deleted", targetType: "list", targetId: listId, label: name, meta: { n } });
  return companyId;
}

// Kandidaten får «{bedrift} lagret profilen din» maks én gang per bedrift per 30 dager
// (informasjonsplikten i GDPR art. 14). Kaster aldri.
async function sendTalentNotice(actorId: string, companyId: string, userId: string) {
  try {
    if (!(await check("talentNotice", `${companyId}:${userId}`)).ok) return;
    const [co] = await db.select({ name: company.name, slug: company.slug }).from(company).where(eq(company.id, companyId)).limit(1);
    if (!co) return;
    await notify({ userId, actorId, type: "talent", data: { event: "saved", companyName: co.name, companySlug: co.slug } });
  } catch (error) {
    log.error("talent.notice", { error, companyId });
  }
}

const cleanNote = (note: string | null | undefined) => note?.trim().slice(0, 500) || null;

// Legg til eller fjern en kandidat. Bare synlige kandidater som ikke har blokkert bedriften
// kan legges til; de står i listen i 12 måneder.
export async function setTalentListMember(viewerId: string, listId: string, userId: string, on: boolean, note?: string | null) {
  const { companyId, name } = await listCompany(listId);
  await requireCompanyPermission(viewerId, companyId, "lists.edit");
  await requireBusiness(companyId);
  if (!on) {
    const removed = await db
      .delete(talentListMember)
      .where(and(eq(talentListMember.listId, listId), eq(talentListMember.userId, userId)))
      .returning({ userId: talentListMember.userId });
    if (removed.length) await audit({ companyId, actorId: viewerId, action: "list.removed", targetType: "list", targetId: listId, subjectUserId: userId, label: name });
    return companyId;
  }
  const [visible] = await db
    .select({ id: profile.userId })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(and(eq(profile.userId, userId), eq(profile.visibleToCompanies, true), sql`coalesce(${user.banned}, false) = false`, notBlockedSql(companyId, outer(profile.userId))))
    .limit(1);
  // Samme svar om personen er skjult eller har blokkert bedriften.
  if (!visible) throw new UserFacingError("Denne personen er ikke synlig for bedrifter.");
  const added = await db
    .insert(talentListMember)
    .values({ listId, userId, note: cleanNote(note), addedById: viewerId })
    .onConflictDoNothing()
    .returning({ userId: talentListMember.userId });
  if (added.length === 0) {
    if (note !== undefined) await setTalentListNote(viewerId, listId, userId, note);
    return companyId;
  }
  await audit({ companyId, actorId: viewerId, action: "list.added", targetType: "list", targetId: listId, subjectUserId: userId, label: name });
  await sendTalentNotice(viewerId, companyId, userId);
  return companyId;
}

// Notat om en kandidat i en liste. Kandidaten kan be om innsyn, så skriv det som om de leser det.
export async function setTalentListNote(viewerId: string, listId: string, userId: string, note: string | null) {
  const { companyId, name } = await listCompany(listId);
  await requireCompanyPermission(viewerId, companyId, "lists.edit");
  await requireBusiness(companyId);
  const clean = cleanNote(note);
  const updated = await db
    .update(talentListMember)
    .set({ note: clean })
    .where(and(eq(talentListMember.listId, listId), eq(talentListMember.userId, userId)))
    .returning({ userId: talentListMember.userId });
  if (updated.length === 0) throw new UserFacingError("Kandidaten står ikke i listen.");
  await audit({ companyId, actorId: viewerId, action: "list.note", targetType: "list", targetId: listId, subjectUserId: userId, label: name, meta: { cleared: clean === null } });
  return companyId;
}

export async function getTalentList(viewerId: string, listId: string) {
  const list = await listCompany(listId);
  await requireCompanyPermission(viewerId, list.companyId, "lists.edit");
  const addedBy = alias(user, "added_by");
  const members = await db
    .select({
      ...candidateColumns,
      note: talentListMember.note,
      addedAt: talentListMember.addedAt,
      expiresAt: talentListMember.expiresAt,
      addedByName: addedBy.name,
    })
    .from(talentListMember)
    .innerJoin(user, eq(user.id, talentListMember.userId))
    .innerJoin(profile, eq(profile.userId, user.id))
    .leftJoin(addedBy, eq(addedBy.id, talentListMember.addedById))
    // Har noen slått av «Synlig for bedrifter» eller blokkert bedriften, vises de ikke.
    .where(and(eq(talentListMember.listId, listId), shownMember(list.companyId)))
    .orderBy(desc(talentListMember.addedAt));
  return { id: listId, name: list.name, companyId: list.companyId, members };
}

// Hvilke lister kandidatene allerede står i (til «Legg i liste»-knappen). Kalles etter at
// tilgangen er sjekket.
export async function listMembershipsFor(companyId: string, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({ userId: talentListMember.userId, listId: talentListMember.listId })
    .from(talentListMember)
    .innerJoin(talentList, eq(talentList.id, talentListMember.listId))
    .where(and(eq(talentList.companyId, companyId), inArray(talentListMember.userId, userIds), gt(talentListMember.expiresAt, sql`now()`)));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.listId]);
  return map;
}

const csvCell = (value: unknown) => {
  const text = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  // Hindrer at regneark tolker celler som formler («=HYPERLINK(...)»).
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const CSV_FOOTER = "Personopplysninger – slett filen når dere er ferdige (vilkår § 6)";

// Eksport av en liste til CSV (Excel/Numbers/Google Sheets). Bare eier og administratorer,
// maks 20 i døgnet per bedrift, og hver eksport logges med antall rader. Ingen e-postadresser;
// notater bare når de ber om det.
export async function talentListCsv(viewerId: string, listId: string, { notes = false }: { notes?: boolean } = {}) {
  const meta = await listCompany(listId);
  await requireCompanyPermission(viewerId, meta.companyId, "lists.export");
  await requireBusiness(meta.companyId);
  await enforce("csvExport", meta.companyId);
  const list = await getTalentList(viewerId, listId);
  const header = ["Navn", "Brukernavn", "Profil", "Tittel", "Sted", "Ferdigheter", "Prosjekter", ...(notes ? ["Notat"] : []), "Lagt til"];
  const rows = list.members.map((m) => [
    m.name,
    m.username,
    `${siteUrl()}${profilePath(m.username)}`,
    m.headline,
    m.location,
    m.skills.slice(0, 15),
    m.projects,
    ...(notes ? [m.note] : []),
    new Date(m.addedAt).toISOString().slice(0, 10),
  ]);
  await audit({ companyId: list.companyId, actorId: viewerId, action: "list.exported", targetType: "list", targetId: listId, label: list.name, meta: { rows: rows.length, notes } });
  // BOM så Excel leser æ, ø og å riktig.
  return { name: list.name, rows: rows.length, csv: `\uFEFF${[header, ...rows, [], [CSV_FOOTER]].map((r) => r.map(csvCell).join(";")).join("\r\n")}\r\n` };
}

/* -------------------------------------------------------------------------- */
/*  Sammenligning                                                             */
/* -------------------------------------------------------------------------- */

export const MAX_COMPARE = 4;

// «Sammenlignet kandidater» logges maks én gang per person, kandidat og dag (Oslo-tid), så
// loggen svarer på «hvem så på Kari» uten å fylles opp når siden lastes på nytt.
async function auditCompareOnce(companyId: string, actorId: string, subjectIds: string[]) {
  for (const subjectId of subjectIds) {
    try {
      await db.execute(sql`
        insert into company_audit (company_id, actor_id, action, target_type, target_id, subject_user_id, meta)
        select ${companyId}::uuid, ${actorId}, 'application.compared', 'user', ${subjectId}, ${subjectId}, ${JSON.stringify({ n: subjectIds.length })}::jsonb
        where not exists (
          select 1 from company_audit
          where company_id = ${companyId} and actor_id = ${actorId} and action = 'application.compared' and subject_user_id = ${subjectId}
            and (created_at at time zone 'Europe/Oslo')::date = (now() at time zone 'Europe/Oslo')::date)`);
    } catch (error) {
      log.error("audit.compare", { error, companyId });
    }
  }
}

// Opptil fire kandidater side om side. Alle i bedriften kan sammenligne dem som har søkt hos
// dem (søknaden deler profilen); de som kan bruke kandidatsøket, også dem som er synlige for
// bedrifter. E-posten er bare med når kandidaten har søkt og rollen kan se kontaktinfo.
export async function compareCandidates(viewerId: string, companyId: string, userIds: string[]) {
  const role = await requireCompanyPermission(viewerId, companyId, "applications.view");
  await requireBusiness(companyId);
  const ids = [...new Set(userIds)].filter((id) => /^[\w-]{1,64}$/.test(id)).slice(0, MAX_COMPARE);
  if (ids.length === 0) return [];
  const gate = await getCompanyGate(viewerId, companyId);
  const searchable = can(role, "candidates.search") && Boolean(gate?.termsAccepted);
  const contactDetails = can(role, "applications.contactDetails");

  const { cvEducation, cvExperience, job, jobApplication } = schema;
  const applied = sql<boolean>`exists (select 1 from ${jobApplication} join ${job} on ${job.id} = ${jobApplication.jobId}
    where ${jobApplication.userId} = ${user.id} and ${job.companyId} = ${companyId} and ${jobApplication.status} <> 'trukket')`;
  const rows = await db
    .select({ ...candidateColumns, email: user.email, applied })
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(
      and(
        inArray(user.id, ids),
        sql`coalesce(${user.banned}, false) = false`,
        searchable ? or(and(eq(profile.visibleToCompanies, true), notBlockedSql(companyId)), applied) : applied,
      ),
    );

  const found = rows.map((r) => r.id);
  const [showcase, experience, education, applications] = await Promise.all([
    loadShowcase(found),
    found.length
      ? db
          .select({ userId: cvExperience.userId, title: cvExperience.title, organization: cvExperience.organization, startDate: cvExperience.startDate, endDate: cvExperience.endDate })
          .from(cvExperience)
          .where(inArray(cvExperience.userId, found))
          .orderBy(asc(cvExperience.position))
      : [],
    found.length
      ? db
          .select({ userId: cvEducation.userId, institution: cvEducation.institution, degree: cvEducation.degree, fieldOfStudy: cvEducation.fieldOfStudy, endDate: cvEducation.endDate })
          .from(cvEducation)
          .where(inArray(cvEducation.userId, found))
          .orderBy(asc(cvEducation.position))
      : [],
    found.length
      ? db
          .select({ userId: jobApplication.userId, id: jobApplication.id, status: jobApplication.status, message: jobApplication.message, jobTitle: job.title })
          .from(jobApplication)
          .innerJoin(job, eq(job.id, jobApplication.jobId))
          .where(and(inArray(jobApplication.userId, found), eq(job.companyId, companyId), sql`${jobApplication.status} <> 'trukket'`))
          .orderBy(desc(jobApplication.createdAt))
      : [],
  ]);

  await auditCompareOnce(companyId, viewerId, found);

  // Samme rekkefølge som de ble valgt i.
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r) => r !== undefined)
    .map(({ email, applied: hasApplied, ...r }) => ({
      ...r,
      email: contactDetails && hasApplied ? email : null,
      openTo: (r.openTo ?? []) as OpenTo[],
      showcase: showcase.get(r.id) ?? [],
      experience: experience.filter((e) => e.userId === r.id).slice(0, 3),
      education: education.filter((e) => e.userId === r.id).slice(0, 2),
      application: applications.find((a) => a.userId === r.id) ?? null,
    }));
}
