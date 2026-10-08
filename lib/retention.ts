import "server-only";

import { and, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "@/lib/audit";
import { getPlanState } from "@/lib/billing";
import { RETENTION_OPTIONS } from "@/lib/company-labels";

const { company, contactRequest, cvImport, job, jobApplication, talentListMember } = schema;

// Personvern: sletter det som har passert lagringstiden (planlagt jobb, én gang i døgnet).
//
// Søknader har en fast sluttdato (expiresAt). Åpen stilling: 12 måneder etter søknaden.
// Lukket stilling, eller fristen er passert: senest lukkedato + bedriftens lagringstid (3, 6
// eller 12 måneder; Gratis alltid 6). Datoen regnes ut på nytt hver natt, men kortes bare
// ned, så en gjenåpnet stilling eller en endret innstilling forlenger aldri lagringen.

export type RetentionResult = { applications: number; lists: number; contacts: number; cvDrafts: number };

// Gratis har alltid 6 måneder.
export const FREE_RETENTION_MONTHS = 6;
// Kontaktforespørsler slettes etter 24 måneder.
const CONTACT_MONTHS = 24;

// Bedrifter som har valgt noe annet enn 6 måneder, men ikke lenger har Bedrift.
async function lapsedCompanies() {
  const rows = await db.select({ id: company.id }).from(company).where(ne(company.retentionMonths, FREE_RETENTION_MONTHS));
  const lapsed: string[] = [];
  for (const r of rows) if ((await getPlanState("company", r.id)).plan !== "business") lapsed.push(r.id);
  return lapsed;
}

// Den nye sluttdatoen for søknader på lukkede eller utløpte stillinger. Kortes bare ned.
export async function recomputeExpiry() {
  const lapsed = await lapsedCompanies();
  const months = lapsed.length
    ? sql`case when ${company.id} in (${sql.join(lapsed.map((id) => sql`${id}`), sql`, `)}) then ${FREE_RETENTION_MONTHS} else ${company.retentionMonths} end`
    : sql`${company.retentionMonths}`;
  // Bare tillatte verdier, i tilfelle noen har skrevet noe annet rett i databasen.
  const safe = sql`least(greatest(${months}, ${Math.min(...RETENTION_OPTIONS)}), ${Math.max(...RETENTION_OPTIONS)})`;
  const closedAt = sql`case
    when ${job.status} = 'closed' then coalesce(${job.closedAt}, ${job.updatedAt})
    when ${job.deadline} < (now() at time zone 'Europe/Oslo')::date then ${job.deadline}::timestamptz
    else null end`;
  const next = sql`least(${jobApplication.createdAt} + interval '12 months', ${closedAt} + make_interval(months => ${safe}))`;
  const rows = await db.execute<{ id: string }>(sql`
    update ${jobApplication} set expires_at = ${next}
    from ${job} join ${company} on ${company.id} = ${job.companyId}
    where ${job.id} = ${jobApplication.jobId} and ${next} < ${jobApplication.expiresAt}
    returning ${jobApplication.id}`);
  return rows.length;
}

const BATCH = 2000;

// Sletter søknader som har passert sluttdatoen (med notater, vurderinger og bookinger), og
// logger «slettet utløpte søknader» med antall hos hver bedrift. I bolker, så én natt med
// mye å slette ikke holder databasen lenge.
export async function purgeExpiredApplications() {
  let total = 0;
  for (let round = 0; round < 25; round++) {
    const n = await purgeBatch();
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

function purgeBatch() {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: jobApplication.id, companyId: job.companyId })
      .from(jobApplication)
      .innerJoin(job, eq(job.id, jobApplication.jobId))
      .where(lte(jobApplication.expiresAt, sql`now()`))
      .limit(BATCH);
    if (expired.length === 0) return 0;
    await tx.delete(jobApplication).where(inArray(jobApplication.id, expired.map((e) => e.id)));
    const perCompany = new Map<string, number>();
    for (const e of expired) perCompany.set(e.companyId, (perCompany.get(e.companyId) ?? 0) + 1);
    for (const [companyId, n] of perCompany) {
      await audit({ companyId, actorId: null, action: "retention.purged", targetType: "company", targetId: companyId, meta: { n } }, tx);
    }
    return expired.length;
  });
}

// Kandidatlister: utløpt (12 måneder), personen er ikke lenger synlig for bedrifter, eller
// personen har blokkert bedriften.
export async function purgeTalentLists() {
  const rows = await db.execute<{ list_id: string }>(sql`
    delete from ${talentListMember} m
    where m.expires_at <= now()
      or not exists (select 1 from profile p where p.user_id = m.user_id and p.visible_to_companies)
      or exists (select 1 from company_block b join talent_list l on l.company_id = b.company_id where l.id = m.list_id and b.user_id = m.user_id)
    returning m.list_id`);
  return rows.length;
}

export async function purgeOldContacts() {
  const rows = await db
    .delete(contactRequest)
    .where(lte(contactRequest.createdAt, sql`now() - make_interval(months => ${CONTACT_MONTHS})`))
    .returning({ id: contactRequest.id });
  return rows.length;
}

// Utkast fra CV-import (hele den tolkede CV-en) trengs bare mens brukeren ser over dem.
// Raden beholdes (den teller mot grensen per døgn), men innholdet fjernes etter et døgn.
export async function purgeCvImportDrafts() {
  const rows = await db
    .update(cvImport)
    .set({ result: null })
    .where(and(isNotNull(cvImport.result), lte(cvImport.createdAt, sql`now() - interval '1 day'`)))
    .returning({ id: cvImport.id });
  return rows.length;
}

export async function runRetention(): Promise<RetentionResult> {
  await recomputeExpiry();
  const applications = await purgeExpiredApplications();
  const lists = await purgeTalentLists();
  const contacts = await purgeOldContacts();
  const cvDrafts = await purgeCvImportDrafts();
  return { applications, lists, contacts, cvDrafts };
}
