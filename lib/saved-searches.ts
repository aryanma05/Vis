import "server-only";

import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SavedSearchFilters } from "@/db/schema";
import { getPlanState } from "@/lib/billing";
import { makeT, type T } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { requireBusiness, requireCompanyRole } from "@/lib/companies";
import { FIELD_KEYS, FIELDS, OPEN_TO, OPEN_TO_LABELS, type FieldKey, type OpenTo } from "@/lib/constants";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmail } from "@/lib/mailer";
import { isUuid } from "@/lib/projects";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { newCandidatesSince, type CandidateFilters } from "@/lib/talent";

const { company, companyMember, savedSearch, user } = schema;

// Lagrede kandidatsøk (Bedrift): «Designere i Bergen som er åpne for jobb». Bedriften ser
// hvor mange nye som passer siden sist, og får e-post når noen nye dukker opp. En grunn
// til å komme tilbake hver uke, uten at noen må lete på nytt.

export const MAX_SAVED_SEARCHES = 20;

export function cleanFilters(input: Partial<SavedSearchFilters> | undefined): CandidateFilters {
  return {
    q: input?.q?.trim().slice(0, 100) || undefined,
    location: input?.location?.trim().slice(0, 60) || null,
    openTo: OPEN_TO.includes(input?.openTo as OpenTo) ? (input!.openTo as OpenTo) : null,
    field: FIELD_KEYS.includes(input?.field as FieldKey) ? (input!.field as FieldKey) : null,
    student: input?.student ? true : undefined,
  };
}

const isEmpty = (f: CandidateFilters) => !f.q && !f.location && !f.openTo && !f.field && !f.student;

// Et lesbart navn ut fra filtrene, f.eks. «Design · Bergen · åpen for nye muligheter».
// Uten t blir det norsk (e-postene er på norsk).
export function describeFilters(f: CandidateFilters, t: T = makeT("nb")) {
  return (
    [
      f.q && `«${f.q}»`,
      f.field && t(FIELDS[f.field].label),
      f.location,
      f.student && t("studenter"),
      f.openTo && t("åpen for {what}", { what: t(OPEN_TO_LABELS[f.openTo]).toLowerCase() }),
    ]
      .filter(Boolean)
      .join(" · ") || t("Alle synlige kandidater")
  );
}

// Adressen til kandidatsøket med filtrene fylt inn.
export function searchHref(base: string, f: CandidateFilters, id?: string) {
  const params = new URLSearchParams({ fane: "kandidater" });
  if (f.q) params.set("q", f.q);
  if (f.location) params.set("sted", f.location);
  if (f.field) params.set("fag", f.field);
  if (f.openTo) params.set("apen", f.openTo);
  if (f.student) params.set("student", "1");
  if (id) params.set("sok", id);
  return `${base}?${params}`;
}

export async function listSavedSearches(viewerId: string, companyId: string) {
  await requireCompanyRole(viewerId, companyId);
  const rows = await db.select().from(savedSearch).where(eq(savedSearch.companyId, companyId)).orderBy(asc(savedSearch.createdAt));
  // «N nye siden sist» per søk.
  return Promise.all(
    rows.map(async (r) => {
      const filters = cleanFilters(r.filters);
      const fresh = await newCandidatesSince(filters, r.lastSeenAt, 99);
      return { id: r.id, name: r.name, notify: r.notify, filters, description: describeFilters(filters), fresh: fresh.length };
    }),
  );
}

export async function createSavedSearch(viewerId: string, companyId: string, name: string, input: Partial<SavedSearchFilters>) {
  await requireCompanyRole(viewerId, companyId);
  await requireBusiness(companyId);
  const filters = cleanFilters(input);
  if (isEmpty(filters)) throw new UserFacingError("Velg minst ett filter før du lagrer søket.");
  await enforce("savedSearch", companyId);
  const [{ n }] = await db.select({ n: count() }).from(savedSearch).where(eq(savedSearch.companyId, companyId));
  if (n >= MAX_SAVED_SEARCHES) throw new UserFacingError("Dere kan ha opptil {n} lagrede søk.", { n: MAX_SAVED_SEARCHES });
  const [row] = await db
    .insert(savedSearch)
    .values({ companyId, createdById: viewerId, name: name.trim().slice(0, 80) || describeFilters(filters, await getT()).slice(0, 80), filters })
    .returning({ id: savedSearch.id });
  return row.id;
}

async function searchCompany(searchId: string) {
  if (!isUuid(searchId)) throw new UserFacingError("Fant ikke søket.");
  const [row] = await db.select({ companyId: savedSearch.companyId }).from(savedSearch).where(eq(savedSearch.id, searchId)).limit(1);
  if (!row) throw new UserFacingError("Fant ikke søket.");
  return row.companyId;
}

export async function deleteSavedSearch(viewerId: string, searchId: string) {
  const companyId = await searchCompany(searchId);
  await requireCompanyRole(viewerId, companyId);
  await db.delete(savedSearch).where(eq(savedSearch.id, searchId));
  return companyId;
}

export async function setSavedSearchNotify(viewerId: string, searchId: string, notify: boolean) {
  const companyId = await searchCompany(searchId);
  await requireCompanyRole(viewerId, companyId);
  await db.update(savedSearch).set({ notify, lastNotifiedAt: new Date() }).where(eq(savedSearch.id, searchId));
  return companyId;
}

// Når et lagret søk åpnes, er de nye «sett».
export async function markSavedSearchSeen(viewerId: string, companyId: string, searchId: string) {
  if (!isUuid(searchId)) return;
  await requireCompanyRole(viewerId, companyId);
  await db
    .update(savedSearch)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(savedSearch.id, searchId), eq(savedSearch.companyId, companyId)));
}

/* -------------------------------------------------------------------------- */
/*  Varsler (planlagt jobb, f.eks. hver morgen)                               */
/* -------------------------------------------------------------------------- */

// Går gjennom lagrede søk med varsel hos bedrifter som har Bedrift, og sender én e-post
// per søk med nye kandidater til eier og administratorer. Returnerer hvor mange e-poster.
export async function sendSavedSearchAlerts({ limit = 200 } = {}) {
  const searches = await db
    .select({ id: savedSearch.id, name: savedSearch.name, filters: savedSearch.filters, lastNotifiedAt: savedSearch.lastNotifiedAt, companyId: savedSearch.companyId, slug: company.slug, companyName: company.name })
    .from(savedSearch)
    .innerJoin(company, eq(company.id, savedSearch.companyId))
    .where(eq(savedSearch.notify, true))
    .orderBy(asc(savedSearch.lastNotifiedAt))
    .limit(limit);

  let sent = 0;
  for (const s of searches) {
    if ((await getPlanState("company", s.companyId)).plan !== "business") continue;
    const filters = cleanFilters(s.filters);
    const fresh = await newCandidatesSince(filters, s.lastNotifiedAt, 20);
    await db.update(savedSearch).set({ lastNotifiedAt: new Date() }).where(eq(savedSearch.id, s.id));
    if (fresh.length === 0) continue;

    const recipients = await db
      .select({ email: user.email, verified: user.emailVerified })
      .from(companyMember)
      .innerJoin(user, eq(user.id, companyMember.userId))
      .where(and(eq(companyMember.companyId, s.companyId), inArray(companyMember.role, ["owner", "admin"])));
    const names = fresh
      .slice(0, 5)
      .map((c) => `${c.name}${c.headline ? ` – ${c.headline}` : ""}${c.location ? ` (${c.location})` : ""}`)
      .join("\n");
    const subject = fresh.length === 1 ? `1 ny kandidat for «${s.name}»` : `${fresh.length} nye kandidater for «${s.name}»`;
    for (const r of recipients) {
      if (!r.verified || (!emailProviderConfigured && process.env.NODE_ENV === "production")) continue;
      try {
        await sendEmail(
          notificationEmail({
            to: r.email,
            subject,
            heading: subject,
            intro: `${fresh.length === 1 ? "Én ny person" : `${fresh.length} nye personer`} som passer det lagrede søket «${s.name}» hos ${s.companyName} har blitt synlige for bedrifter på Vis.`,
            quote: names + (fresh.length > 5 ? `\n… og ${fresh.length - 5} til` : ""),
            path: searchHref(`/bedrift/${s.slug}/admin`, filters, s.id),
            button: "Se kandidatene",
          }),
        );
        sent++;
      } catch (error) {
        log.error("saved-search.email", { error, searchId: s.id });
      }
    }
  }
  return { searches: searches.length, sent };
}
