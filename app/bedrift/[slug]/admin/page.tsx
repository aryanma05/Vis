import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, Inbox, Lock, MousePointerClick, Plus, Trophy, Users } from "lucide-react";
import CheckoutButton from "@/app/priser/CheckoutButton";
import Avatar from "@/components/Avatar";
import { AddMember, AddToList, ContactCandidate, JobActions, NewTalentList, RemoveMember, TalentListTools } from "@/components/company/AdminTools";
import { ApplicantBoard, UsedTech } from "@/components/company/Applicants";
import { ChallengeActions } from "@/components/company/ChallengeTools";
import { CompareProvider, CompareToggle, SavedSearchChip, SaveSearchButton } from "@/components/company/TalentTools";
import { AddEmployee, RemoveEmployee } from "@/components/company/TeamTools";
import CompanyForm from "@/components/company/CompanyForm";
import { Webhooks } from "@/components/developers/DeveloperTools";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { countApplicationsByJob, listApplications } from "@/lib/applications";
import { getCompanyPlan, getDisplayPrices } from "@/lib/billing";
import { listCompanyChallenges } from "@/lib/challenges";
import { getCompanyBySlug, getMembership, listCompanyMembers, listTeam } from "@/lib/companies";
import { FIELD_KEYS, FIELDS, OPEN_TO, OPEN_TO_LABELS, type FieldKey, type OpenTo } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Locale, T } from "@/lib/i18n";
import { getLocale, getT } from "@/lib/i18n/server";
import { listCompanyJobs } from "@/lib/jobs";
import { requireUser } from "@/lib/session";
import { getTalentList, listMembershipsFor, listTalentLists, searchCandidates } from "@/lib/talent";
import { listWebhooks, WEBHOOK_EVENTS } from "@/lib/webhooks";
import { describeFilters, listSavedSearches, markSavedSearchSeen, searchHref } from "@/lib/saved-searches";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Administrer bedrift"), robots: { index: false } };
}

// «1 990 kr» / «NOK 1,990»
const formatPrice = (amount: number, locale: Locale) =>
  locale === "en" ? `NOK ${amount.toLocaleString("en-GB")}` : `${amount.toLocaleString("nb-NO")} kr`;

const TABS = ["stillinger", "sokere", "kandidater", "lister", "utfordringer", "profil", "medlemmer", "utviklere", "abonnement"] as const;
type Tab = (typeof TABS)[number];
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fane?: string; q?: string; sted?: string; apen?: string; fag?: string; liste?: string; avbrutt?: string; stilling?: string; student?: string; sok?: string }>;
};

const ROLE_LABEL = { owner: "Eier", admin: "Administrator", member: "Medlem" } as const;

// Hva Bedrift låser opp, per fane. Oversettes med t().
const UPSELL_TEXT = {
  kandidater: "Søk blant folk som har valgt å være synlige for bedrifter, se prosjektene deres, lagre søk og få varsel om nye kandidater, lag lister med notater og ta kontakt direkte.",
  sokere: "Flytt søkerne gjennom Ny → Intervju → Tilbud → Avslag, skriv notater og sammenlign dem side om side. Kandidaten får beskjed automatisk hver gang dere flytter dem.",
  utfordringer: "Legg ut en liten oppgave, og la studenter og juniorer svare med et prosjekt. Rettferdigere enn kodetester, og dere ser hvordan folk faktisk jobber.",
  generelt: "Ubegrenset med stillinger, søkeroversikt, kandidatsøk med lagrede søk og varsler, lister, utfordringer og webhooks.",
} as const;

function Upsell({ companyId, price, canBuy, t, feature = "kandidater" }: { companyId: string; price: string; canBuy: boolean; t: T; feature?: keyof typeof UPSELL_TEXT }) {
  return (
    <div className="rounded-[22px] glass-card p-6">
      <p className="flex items-center gap-2 font-semibold">
        <Lock className="size-4 text-mist" /> {t("Krever Bedrift")}
      </p>
      <p className="mt-2 max-w-xl text-sm text-mist">
        {t(UPSELL_TEXT[feature])} {t("{price} i måneden, ingen bindingstid.", { price })}{" "}
        {t("Til sammenligning tar et rekrutteringsbyrå ofte 15–25 % av årslønna for én ansettelse.")}
      </p>
      {canBuy && (
        <div className="mt-4">
          <CheckoutButton plan="business" companyId={companyId}>
            {t("Start Bedrift")}
          </CheckoutButton>
        </div>
      )}
    </div>
  );
}

export default async function CompanyAdminPage({ params, searchParams }: Props) {
  const user = await requireUser();
  const [{ slug }, query, t, locale] = await Promise.all([params, searchParams, getT(), getLocale()]);
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const role = await getMembership(user.id, company.id);
  if (!role) notFound();

  const tab: Tab = (TABS as readonly string[]).includes(query.fane ?? "") ? (query.fane as Tab) : "stillinger";
  const canManage = role === "owner" || role === "admin";
  const [plan, prices] = await Promise.all([getCompanyPlan(company.id), getDisplayPrices()]);
  const business = plan.plan === "business";
  const base = `/bedrift/${company.slug}/admin`;
  const monthly = formatPrice(prices["business:month"].amount, locale);

  const filters = {
    q: query.q?.slice(0, 100) ?? "",
    location: query.sted?.slice(0, 60) ?? null,
    openTo: OPEN_TO.includes(query.apen as OpenTo) ? (query.apen as OpenTo) : null,
    field: FIELD_KEYS.includes(query.fag as FieldKey) ? (query.fag as FieldKey) : null,
    student: query.student === "1" ? true : undefined,
  };
  const hasFilters = Boolean(filters.q || filters.location || filters.openTo || filters.field || filters.student);
  // Åpnes et lagret søk, er de nye kandidatene sett (før tellingen under).
  if (tab === "kandidater" && business && query.sok) await markSavedSearchSeen(user.id, company.id, query.sok);

  const [jobs, lists, candidates, list, members, hooks, applicants, applicationCounts] = await Promise.all([
    tab === "stillinger" || tab === "sokere" ? listCompanyJobs(company.id, { includeAll: true }) : [],
    tab === "kandidater" || tab === "lister" ? listTalentLists(user.id, company.id) : [],
    tab === "kandidater" && business ? searchCandidates(user.id, company.id, filters) : [],
    tab === "lister" && query.liste ? getTalentList(user.id, query.liste).catch(() => null) : null,
    tab === "medlemmer" ? listCompanyMembers(company.id) : [],
    tab === "utviklere" ? listWebhooks(user.id, company.id) : [],
    tab === "sokere" ? listApplications(user.id, company.id, { jobId: query.stilling }) : [],
    countApplicationsByJob(company.id),
  ]);
  const savedSearches = tab === "kandidater" && business ? await listSavedSearches(user.id, company.id) : [];
  const [challenges, team] = await Promise.all([
    tab === "utfordringer" ? listCompanyChallenges(company.id, { includeAll: true }) : [],
    tab === "medlemmer" ? listTeam(company.id) : [],
  ]);
  const freshApplicants = [...applicationCounts.values()].reduce((sum, c) => sum + c.fresh, 0);
  const memberships = tab === "kandidater" ? await listMembershipsFor(company.id, candidates.map((c) => c.id)) : new Map<string, string[]>();

  return (
    <main className="px-5 pb-28 pt-10 md:pb-20 md:pl-28 md:pr-10 md:pt-14">
      <div className="mx-auto max-w-6xl">
        <Link href={`/bedrift/${company.slug}`} className="inline-flex items-center gap-2 text-sm text-mist hover:text-fg">
          <ArrowLeft className="size-4" /> {company.name}
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight">{t("Administrer")}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${business ? "bg-success/15 text-success" : "bg-fill text-mist"}`}>
            {business ? t("Bedrift") : t("Gratis")}
          </span>
        </div>

        <div className="mt-8">
          <Tabs
            label={t("Bedrift")}
            active={tab}
            items={[
              { key: "stillinger", label: t("Stillinger"), href: base },
              { key: "sokere", label: freshApplicants > 0 ? t("Søkere ({n} nye)", { n: freshApplicants }) : t("Søkere"), href: `${base}?fane=sokere` },
              { key: "kandidater", label: t("Kandidatsøk"), href: `${base}?fane=kandidater` },
              { key: "lister", label: t("Lister"), href: `${base}?fane=lister` },
              { key: "utfordringer", label: t("Utfordringer"), href: `${base}?fane=utfordringer` },
              { key: "profil", label: t("Bedriftsprofil"), href: `${base}?fane=profil` },
              { key: "medlemmer", label: t("Team"), href: `${base}?fane=medlemmer` },
              { key: "utviklere", label: "Webhooks", href: `${base}?fane=utviklere` },
              { key: "abonnement", label: t("Abonnement"), href: `${base}?fane=abonnement` },
            ]}
          />
        </div>

        <div className="mt-8">
          {tab === "stillinger" && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-mist">{business ? t("Ubegrenset med stillinger.") : t("Gratis: én aktiv stilling om gangen.")}</p>
                <ButtonLink href={`${base}/stilling/ny`} size="sm">
                  <Plus className="size-4" /> {t("Ny stilling")}
                </ButtonLink>
              </div>
              {jobs.length === 0 ? (
                <EmptyState className="mt-6" title={t("Ingen stillinger ennå")}>
                  {t("Legg ut den første. Den vises på bedriftssiden og under Stillinger.")}
                </EmptyState>
              ) : (
                <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                  {jobs.map((j) => (
                    <li key={j.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <Link href={`${base}/stilling/${j.id}`} className="font-semibold hover:text-ice">
                          {j.title}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-mist">
                          <span className={j.status === "published" ? "text-success" : j.status === "draft" ? "text-warn" : ""}>
                            {j.status === "published" ? t("Publisert") : j.status === "draft" ? t("Utkast") : t("Lukket")}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye className="size-3.5" /> {t("{n} visninger", { n: j.views })}
                          </span>
                          {j.applyMode === "vis" ? (
                            <Link href={`${base}?fane=sokere&stilling=${j.id}`} className="inline-flex items-center gap-1 hover:text-ice">
                              <Users className="size-3.5" /> {t("{n} søkere", { n: applicationCounts.get(j.id)?.total ?? 0 })}
                              {(applicationCounts.get(j.id)?.fresh ?? 0) > 0 && <span className="text-success">({t("{n} nye", { n: applicationCounts.get(j.id)?.fresh ?? 0 })})</span>}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <MousePointerClick className="size-3.5" /> {t("{n} søknadsklikk", { n: j.applyClicks })}
                            </span>
                          )}
                        </p>
                      </div>
                      <JobActions jobId={j.id} status={j.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === "sokere" && (
            <section>
              {jobs.length > 1 && (
                <nav aria-label={t("Velg stilling")} className="mb-5 flex flex-wrap gap-2">
                  {[{ id: "", title: t("Alle stillinger") }, ...jobs.filter((j) => j.applyMode === "vis")].map((j) => {
                    const active = (query.stilling ?? "") === j.id;
                    return (
                      <Link
                        key={j.id || "alle"}
                        href={j.id ? `${base}?fane=sokere&stilling=${j.id}` : `${base}?fane=sokere`}
                        aria-current={active ? "page" : undefined}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${active ? "bg-primary text-on-primary" : "glass-chip hover:bg-fill-2"}`}
                      >
                        {j.title}
                        {j.id && (applicationCounts.get(j.id)?.total ?? 0) > 0 && <span className="opacity-70"> · {applicationCounts.get(j.id)?.total}</span>}
                      </Link>
                    );
                  })}
                </nav>
              )}
              {applicants.length === 0 ? (
                <EmptyState icon={<Inbox className="size-5" />} title={t("Ingen søkere ennå")}>
                  {t("Velg «Med Vis-profilen» under «Hvordan skal folk søke?» på en stilling. Da søker folk med profilen og prosjektene sine, og alle søkerne havner her i samme format.")}
                </EmptyState>
              ) : (
                <>
                  {!business && (
                    <div className="mb-5">
                      <Upsell companyId={company.id} price={monthly} canBuy={canManage} t={t} feature="sokere" />
                    </div>
                  )}
                  <ApplicantBoard
                    base={base}
                    canManage={business}
                    showJob={!query.stilling}
                    applicants={applicants.map((a) => ({
                      id: a.id,
                      status: a.status,
                      createdAt: a.createdAt,
                      job: a.job,
                      candidate: a.candidate,
                      usedTech: a.usedTech,
                      highlights: a.highlights.map((h) => ({ id: h.id, title: h.title, cover: h.cover })),
                    }))}
                  />
                </>
              )}
            </section>
          )}

          {tab === "kandidater" &&
            (!business ? (
              <Upsell companyId={company.id} price={monthly} canBuy={canManage} t={t} />
            ) : (
              <section>
                <form action={base} className="flex flex-wrap gap-2">
                  <input type="hidden" name="fane" value="kandidater" />
                  <input name="q" defaultValue={filters.q} placeholder={t("Ferdighet, rolle eller navn")} aria-label={t("Søk")} className="h-10 min-w-56 flex-1 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
                  <input name="sted" defaultValue={filters.location ?? ""} placeholder={t("Sted")} aria-label={t("Sted")} className="h-10 w-36 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50" />
                  <select name="fag" defaultValue={filters.field ?? ""} aria-label={t("Fagfelt")} className="h-10 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line">
                    <option value="">{t("Alle fagfelt")}</option>
                    {FIELD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {t(FIELDS[k].label)}
                      </option>
                    ))}
                  </select>
                  <select name="apen" defaultValue={filters.openTo ?? ""} aria-label={t("Åpen for")} className="h-10 rounded-full bg-fill px-4 outline-none inset-ring inset-ring-line">
                    <option value="">{t("Åpen for alt")}</option>
                    {OPEN_TO.map((o) => (
                      <option key={o} value={o}>
                        {t(OPEN_TO_LABELS[o])}
                      </option>
                    ))}
                  </select>
                  <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-fill px-4 text-sm inset-ring inset-ring-line">
                    <input type="checkbox" name="student" value="1" defaultChecked={filters.student} className="accent-[var(--sea)]" /> {t("Studenter")}
                  </label>
                  <button type="submit" className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary">
                    {t("Søk")}
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {savedSearches.length > 0 && (
                    <ul className="flex flex-wrap gap-2" aria-label={t("Lagrede søk")}>
                      {savedSearches.map((s) => (
                        <SavedSearchChip key={s.id} id={s.id} name={s.name} href={searchHref(base, s.filters, s.id)} fresh={s.fresh} notify={s.notify} active={query.sok === s.id} />
                      ))}
                    </ul>
                  )}
                  {hasFilters && !savedSearches.some((s) => s.id === query.sok) && (
                    <SaveSearchButton
                      companyId={company.id}
                      suggestion={describeFilters(filters, t).slice(0, 80)}
                      filters={{ q: filters.q || undefined, location: filters.location, openTo: filters.openTo, field: filters.field, student: filters.student }}
                    />
                  )}
                  {!hasFilters && savedSearches.length === 0 && (
                    <p className="text-sm text-mist">{t("Tips: søk etter f.eks. «React» i Bergen og lagre søket. Da får dere e-post når nye kandidater passer.")}</p>
                  )}
                </div>
                {lists.length === 0 && !hasFilters && (
                  <p className="mt-4 text-sm text-mist">
                    {t("Tips: lag en liste under")}{" "}
                    <Link href={`${base}?fane=lister`} className="text-ice hover:underline">
                      {t("Lister")}
                    </Link>{" "}
                    {t("for å samle kandidater.")}
                  </p>
                )}
                {candidates.length === 0 ? (
                  <EmptyState className="mt-8" title={t("Ingen treff")}>
                    {t("Bare folk som selv har slått på «Synlig for bedrifter» vises her.")}
                  </EmptyState>
                ) : (
                  <CompareProvider base={base}>
                    <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                      {candidates.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
                          <Avatar name={c.name} image={c.image} size={44} />
                          <div className="min-w-0 flex-1">
                            <Link href={`/@${c.username}`} className="font-semibold hover:text-ice">
                              {c.name}
                            </Link>
                            <p className="text-sm text-mist">
                              {[
                                c.headline,
                                c.location,
                                c.studyProgram && (c.graduationYear ? t("{program}, ferdig {year}", { program: c.studyProgram, year: c.graduationYear }) : c.studyProgram),
                                t("{n} prosjekter", { n: c.projects }),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <UsedTech tech={c.usedTech} max={6} className="mt-2" />
                            {c.skills.length > 0 && (
                              <p className="mt-1.5 truncate text-xs text-mist">
                                {t("CV")}: {c.skills.slice(0, 8).join(" · ")}
                              </p>
                            )}
                            {(c.openTo as OpenTo[]).length > 0 && (
                              <p className="mt-1 text-xs text-success">
                                {t("Åpen for")} {(c.openTo as OpenTo[]).map((o) => t(OPEN_TO_LABELS[o]).toLowerCase()).join(", ")}
                              </p>
                            )}
                          </div>
                          {c.showcase.length > 0 && (
                            <div className="hidden w-60 shrink-0 grid-cols-3 gap-1.5 sm:grid" aria-label={t("Prosjektene til {name}", { name: c.name })}>
                              {c.showcase.map((p) => (
                                <Link key={p.id} href={`/prosjekt/${p.id}`} title={p.title} className="block aspect-[4/3] overflow-hidden rounded-lg bg-fill-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {p.cover && <img src={p.cover} alt={p.title} className="size-full object-cover" />}
                                </Link>
                              ))}
                            </div>
                          )}
                          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-col sm:items-end">
                            <div className="flex gap-2">
                              <AddToList userId={c.id} lists={lists} memberOf={memberships.get(c.id) ?? []} />
                              <ContactCandidate companyId={company.id} userId={c.id} name={c.name} />
                            </div>
                            <CompareToggle userId={c.id} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CompareProvider>
                )}
              </section>
            ))}

          {tab === "lister" &&
            (!business && lists.length === 0 ? (
              <Upsell companyId={company.id} price={monthly} canBuy={canManage} t={t} />
            ) : list ? (
              <section>
                <Link href={`${base}?fane=lister`} className="text-sm text-mist hover:text-fg">
                  ← {t("Alle lister")}
                </Link>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">{list.name}</h2>
                  <div className="flex gap-2">
                    {business && (
                      <a href={`/api/bedrift/liste/${list.id}/csv`} className="inline-flex items-center gap-1.5 rounded-full glass-chip px-3 py-1.5 text-sm font-medium">
                        <Download className="size-4" /> {t("Last ned (Excel/CSV)")}
                      </a>
                    )}
                    {canManage && <TalentListTools listId={list.id} />}
                  </div>
                </div>
                {list.members.length === 0 ? (
                  <p className="mt-6 text-mist">{t("Listen er tom. Legg til folk fra Kandidater.")}</p>
                ) : (
                  <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {list.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                        <Avatar name={m.name} image={m.image} size={36} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                            {m.name}
                          </Link>
                          <p className="truncate text-sm text-mist">{[m.headline, m.location].filter(Boolean).join(" · ")}</p>
                        </div>
                        {business && <ContactCandidate companyId={company.id} userId={m.id} name={m.name} />}
                        <TalentListTools listId={list.id} userId={m.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section className="space-y-6">
                {business && <NewTalentList companyId={company.id} />}
                {lists.length === 0 ? (
                  <p className="text-mist">{t("Ingen lister ennå.")}</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {lists.map((l) => (
                      <li key={l.id}>
                        <Link href={`${base}?fane=lister&liste=${l.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-fill">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-sm text-mist">{t("{n} personer", { n: l.members })}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {tab === "utfordringer" &&
            (!business && challenges.length === 0 ? (
              <Upsell companyId={company.id} price={monthly} canBuy={canManage} t={t} feature="utfordringer" />
            ) : (
              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-2xl text-sm text-mist">
                    {t("Legg ut en liten oppgave, og la folk svare med et prosjekt. Fungerer som et lite hackathon, og passer perfekt for sommerjobb og internship.")}
                  </p>
                  {canManage && business && (
                    <ButtonLink href={`${base}/utfordring/ny`} size="sm">
                      <Plus className="size-4" /> {t("Ny utfordring")}
                    </ButtonLink>
                  )}
                </div>
                {challenges.length === 0 ? (
                  <EmptyState className="mt-6" icon={<Trophy className="size-5" />} title={t("Ingen utfordringer ennå")}>
                    {t("F.eks. «Lag en landingsside for en sykkelbutikk» eller «Visualiser bysykkel-data for Oslo». Den vises under Utfordringer og på bedriftssiden.")}
                  </EmptyState>
                ) : (
                  <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                    {challenges.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <Link href={`/utfordringer/${c.id}`} className="font-semibold hover:text-ice">
                            {c.title}
                          </Link>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-mist">
                            <span className={c.status === "published" ? "text-success" : c.status === "draft" ? "text-warn" : ""}>
                              {c.status === "published" ? t("Publisert") : c.status === "draft" ? t("Utkast") : t("Lukket")}
                            </span>
                            <span>{t(c.entries === 1 ? "1 svar" : "{n} svar", { n: c.entries })}</span>
                            {c.deadline && <span>{t("Frist {date}", { date: formatDate(`${c.deadline}T12:00:00`, locale) })}</span>}
                            {canManage && (
                              <Link href={`${base}/utfordring/${c.id}`} className="text-ice hover:underline">
                                {t("Rediger")}
                              </Link>
                            )}
                          </p>
                        </div>
                        {canManage && <ChallengeActions id={c.id} status={c.status} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {tab === "profil" &&
            (canManage ? (
              <CompanyForm
                companyId={company.id}
                logoUrl={company.logoUrl}
                canDelete={role === "owner"}
                initial={{ name: company.name, website: company.website ?? "", location: company.location ?? "", size: company.size ?? "", about: company.about ?? "" }}
              />
            ) : (
              <p className="text-mist">{t("Bare eier og administratorer kan endre bedriftsprofilen.")}</p>
            ))}

          {tab === "medlemmer" && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">{t("Team på bedriftssiden")}</h2>
                <p className="mt-1 max-w-2xl text-sm text-mist">
                  {t("Folk som jobber hos dere, med prosjektene sine på bedriftssiden. Utviklere stoler mer på kollegaer enn på reklame. Å stå i teamet gir ingen tilgang til å administrere bedriften.")}
                </p>
              </div>
              {canManage && <AddEmployee companyId={company.id} />}
              {team.filter((m) => !m.admin).length > 0 ? (
                <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                  {team
                    .filter((m) => !m.admin)
                    .map((m) => (
                      <li key={m.userId} className="flex items-center gap-4 px-5 py-3">
                        <Avatar name={m.name} image={m.image} size={36} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                            {m.name}
                          </Link>
                          <p className="text-sm text-mist">{m.title ?? m.headline ?? `@${m.username}`}</p>
                        </div>
                        {canManage && <RemoveEmployee companyId={company.id} userId={m.userId} />}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-mist">{t("Ingen i teamet ennå. Medlemmene under vises også på bedriftssiden.")}</p>
              )}

              <div className="pt-4">
                <h2 className="text-lg font-semibold">{t("Medlemmer")}</h2>
                <p className="mt-1 max-w-2xl text-sm text-mist">
                  {t("Kan legge ut stillinger, se søkere og bruke kandidatsøket. Eier og administratorer kan også endre bedriftsprofilen og abonnementet.")}
                </p>
              </div>
              {canManage && <AddMember companyId={company.id} />}
              <ul className="divide-y divide-line overflow-hidden rounded-[22px] glass-card">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-4 px-5 py-3">
                    <Avatar name={m.name} image={m.image} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/@${m.username}`} className="font-medium hover:text-ice">
                        {m.name}
                      </Link>
                      <p className="text-sm text-mist">{t(ROLE_LABEL[m.role])}</p>
                    </div>
                    {canManage && m.role !== "owner" && <RemoveMember companyId={company.id} userId={m.userId} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "utviklere" &&
            (!business && hooks.length === 0 ? (
              <Upsell companyId={company.id} price={monthly} canBuy={canManage} t={t} />
            ) : (
              <section className="space-y-4">
                <p className="max-w-2xl text-sm text-mist">
                  {t("Vi sender en POST med JSON til adressen når noe skjer med stillingene deres, signert med")}{" "}
                  <code className="font-mono">Vis-Signature</code>. {t("Se")}{" "}
                  <Link href="/utviklere#webhooks" className="text-ice hover:underline">
                    {t("dokumentasjonen")}
                  </Link>
                  .
                </p>
                <Webhooks companyId={company.id} hooks={hooks} events={WEBHOOK_EVENTS} canManage={canManage && business} />
              </section>
            ))}

          {tab === "abonnement" && (
            <section className="max-w-xl rounded-[22px] glass-card p-6">
              {query.avbrutt && <p className="mb-4 text-sm text-mist">{t("Betalingen ble avbrutt. Ingenting er trukket.")}</p>}
              <p className="text-lg font-semibold">{business ? t("Bedrift") : t("Gratis")}</p>
              {plan.source === "stripe" && plan.renewsAt && (
                <p className="mt-1 text-sm text-mist">
                  {plan.cancelAtPeriodEnd
                    ? t("Avsluttes {date}.", { date: formatDate(plan.renewsAt, locale) })
                    : t("Fornyes {date}", { date: formatDate(plan.renewsAt, locale) })}
                </p>
              )}
              {plan.source === "grant" && (
                <p className="mt-1 text-sm text-mist">
                  {plan.grantUntil ? t("Gitt av Vis til {date}.", { date: formatDate(plan.grantUntil, locale) }) : t("Gitt av Vis.")}
                </p>
              )}
              {!business && (
                <p className="mt-2 text-sm text-mist">
                  {t("{price} i måneden: ubegrenset med stillinger, kandidatsøk, lister med eksport og direkte kontakt.", { price: monthly })}
                </p>
              )}
              {canManage ? (
                <div className="mt-5">
                  {plan.source === "stripe" ? (
                    <CheckoutButton portal companyId={company.id} variant="secondary">
                      {t("Administrer betaling og fakturaer")}
                    </CheckoutButton>
                  ) : !business ? (
                    <CheckoutButton plan="business" companyId={company.id}>
                      {t("Start Bedrift")}
                    </CheckoutButton>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-mist">{t("Bare eier og administratorer kan endre abonnementet.")}</p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
