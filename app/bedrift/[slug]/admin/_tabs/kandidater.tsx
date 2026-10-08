import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Avatar from "@/components/Avatar";
import { UsedTech } from "@/components/company/Applicants";
import { ContactCandidate } from "@/components/company/ContactCandidate";
import { AddToList } from "@/components/company/ListTools";
import { TermsRequired } from "@/components/company/PrivacyPanel";
import { CompareProvider, CompareToggle, SavedSearchChip, SaveSearchButton } from "@/components/company/TalentTools";
import Upsell from "@/components/company/Upsell";
import { EmptyState } from "@/components/ui/misc";
import { getCompanyGate } from "@/lib/company-access";
import { can } from "@/lib/company-permissions";
import { FIELD_KEYS, FIELDS, OPEN_TO, OPEN_TO_LABELS, type FieldKey, type OpenTo } from "@/lib/constants";
import { describeFilters, listSavedSearches, markSavedSearchSeen, searchHref } from "@/lib/saved-searches";
import { listMembershipsFor, listTalentLists, searchCandidates } from "@/lib/talent";
import type { AdminCtx } from "./context";

// Kandidatsøket (Bedrift). Bare folk som selv har sagt ja, og aldri dem som har blokkert
// bedriften (lib/talent.ts). Krever godtatt databehandleravtale.
export default async function KandidaterTab({ ctx }: { ctx: AdminCtx }) {
  const { user, company, role, business, base, monthly, canBuy, t, query } = ctx;
  if (!business) return <Upsell companyId={company.id} price={monthly} canBuy={canBuy} t={t} />;
  const gate = await getCompanyGate(user.id, company.id);
  if (!gate?.termsAccepted) return <TermsRequired base={base} canAccept={can(role, "company.privacy")} />;

  const filters = {
    q: query.q?.slice(0, 100) ?? "",
    location: query.sted?.slice(0, 60) ?? null,
    openTo: OPEN_TO.includes(query.apen as OpenTo) ? (query.apen as OpenTo) : null,
    field: FIELD_KEYS.includes(query.fag as FieldKey) ? (query.fag as FieldKey) : null,
    student: query.student === "1" ? true : undefined,
  };
  const hasFilters = Boolean(filters.q || filters.location || filters.openTo || filters.field || filters.student);
  // Åpnes et lagret søk, er de nye kandidatene sett (før tellingen under).
  if (query.sok) await markSavedSearchSeen(user.id, company.id, query.sok);

  const [lists, candidates, savedSearches] = await Promise.all([
    listTalentLists(user.id, company.id),
    searchCandidates(user.id, company.id, filters),
    listSavedSearches(user.id, company.id),
  ]);
  const memberships = await listMembershipsFor(company.id, candidates.map((c) => c.id));

  return (
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
      {candidates.length > 0 && (
        <p className="mt-6 text-sm text-mist">
          <span className="font-semibold tabular-nums text-fg">{candidates.length}</span> {candidates.length === 1 ? t("kandidat") : t("kandidater")}
          {hasFilters ? ` · ${describeFilters(filters, t)}` : ""}
        </p>
      )}
      {candidates.length === 0 ? (
        <EmptyState className="mt-8" title={t("Ingen treff")}>
          {t("Bare folk som selv har slått på «Synlig for bedrifter» vises her.")}
        </EmptyState>
      ) : (
        <CompareProvider base={base}>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[22px] glass-card">
            {candidates.map((c, i) => (
              <li key={c.id} className="fade-up flex flex-wrap items-start gap-4 px-5 py-4 transition-colors hover:bg-fill/50" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
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
      <p className="mt-6 flex items-center gap-2 text-xs text-mist">
        <ShieldCheck className="size-3.5 shrink-0 text-success" /> {t("Bare kandidater som har sagt ja vises. Alle eksporter logges.")}
      </p>
    </section>
  );
}
