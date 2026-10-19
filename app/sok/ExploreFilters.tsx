"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import FilterButton, { FilterChip, FilterGroup } from "@/components/FilterButton";
import { useT } from "@/components/LocaleProvider";
import { Kbd } from "@/components/ui/misc";
import { FIELD_KEYS, FIELDS, OPEN_TO, OPEN_TO_LABELS, PERIODS, type FieldKey, type OpenTo, type PeriodKey } from "@/lib/constants";

type Tag = { slug: string; name: string; count?: number };
export type ExploreType = "prosjekter" | "personer";
export type ExploreSort = "relevant" | "newest" | "trending" | "popular" | "discussed" | "az";

const SORT_LABELS: Record<ExploreSort, string> = {
  relevant: "Mest relevant",
  newest: "Nyeste",
  trending: "Trender",
  popular: "Mest likt",
  discussed: "Mest diskutert",
  az: "Navn A–Å",
};

type State = {
  q: string;
  type: ExploreType;
  tag: string | null;
  sort: ExploreSort;
  sted: string | null;
  apen: OpenTo | null;
  fag: FieldKey | null;
  periode: PeriodKey | null;
  utvalgt: boolean;
};

// Søk og filtre. Alt ligger i adressen, så treff kan deles og tilbake-knappen virker.
export default function ExploreFilters({ state, tags, locations }: { state: State; tags: Tag[]; locations: { location: string; count: number }[] }) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(state.q);
  const [lastQuery, setLastQuery] = useState(state.q);
  const inputRef = useRef<HTMLInputElement>(null);

  // Følg adressen når brukeren trykker fram/tilbake i nettleseren.
  if (lastQuery !== state.q) {
    setLastQuery(state.q);
    setValue(state.q);
  }

  function apply(next: Partial<State>) {
    const merged = { ...state, q: value, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim()) params.set("q", merged.q.trim());
    if (merged.type !== "prosjekter") params.set("type", merged.type);
    if (merged.tag) params.set("tag", merged.tag);
    if (merged.type === "prosjekter" && merged.sort !== "relevant") params.set("sort", merged.sort);
    if (merged.type === "personer" && merged.sted) params.set("sted", merged.sted);
    if (merged.type === "personer" && merged.apen) params.set("apen", merged.apen);
    if (merged.fag) params.set("fag", merged.fag);
    if (merged.type === "prosjekter" && merged.periode) params.set("periode", merged.periode);
    if (merged.type === "prosjekter" && merged.utvalgt) params.set("utvalgt", "1");
    const search = params.toString();
    startTransition(() => router.replace(search ? `/sok?${search}` : "/sok", { scroll: false }));
  }

  // Søk mens man skriver (litt forsinket).
  useEffect(() => {
    if (value === state.q) return;
    const timer = setTimeout(() => apply({ q: value }), 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const activeCount = [state.tag, state.sted, state.apen, state.fag, state.periode, state.utvalgt, state.type === "prosjekter" && state.sort !== "relevant"].filter(Boolean).length;
  const hasFilters = Boolean(state.q) || activeCount > 0;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: value });
        }}
        className="relative"
      >
        <Search className={`pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-mist ${pending ? "animate-pulse" : ""}`} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t(state.type === "personer" ? "Søk etter navn, rolle, sted eller ferdighet …" : "Søk etter prosjekt, teknologi eller person …")}
          aria-label={t("Søk")}
          className="h-12 w-full rounded-full bg-fill pl-12 pr-24 text-[17px] text-fg outline-none inset-ring inset-ring-line inset-shadow-[0_1px_2px_rgb(0_0_0/0.1)] transition placeholder:text-mist focus:bg-fill-2 focus:ring-2 focus:ring-sea/50"
        />
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                apply({ q: "" });
                inputRef.current?.focus();
              }}
              aria-label={t("Tøm søket")}
              className="rounded-full p-1.5 text-mist transition hover:bg-fill-2 hover:text-fg"
            >
              <X className="size-4" />
            </button>
          ) : (
            <span className="hidden sm:block">
              <Kbd>⌘K</Kbd>
            </span>
          )}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("Hva du søker etter")} className="glass-chip inline-flex rounded-full p-1">
          {(["prosjekter", "personer"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={state.type === kind}
              onClick={() => apply({ type: kind, sort: "relevant" })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${state.type === kind ? "glass-thumb text-fg" : "text-mist hover:text-fg"}`}
            >
              {t(kind === "prosjekter" ? "Prosjekter" : "Personer")}
            </button>
          ))}
        </div>

        <FilterButton active={activeCount}>
          {state.type === "prosjekter" && (
            <FilterGroup title={t("Sortering")}>
              {(Object.keys(SORT_LABELS) as ExploreSort[]).map((key) => (
                <FilterChip key={key} active={state.sort === key} onClick={() => apply({ sort: key })}>
                  {t(SORT_LABELS[key])}
                </FilterChip>
              ))}
            </FilterGroup>
          )}
          <FilterGroup title={t("Teknologi")}>
            <FilterChip active={!state.tag} onClick={() => apply({ tag: null })}>
              {t("Alle")}
            </FilterChip>
            {tags.map((tag) => (
              <FilterChip key={tag.slug} active={state.tag === tag.slug} onClick={() => apply({ tag: tag.slug })}>
                {tag.name}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title={t("Fagfelt")}>
            <FilterChip active={!state.fag} onClick={() => apply({ fag: null })}>
              {t("Alle")}
            </FilterChip>
            {FIELD_KEYS.map((key) => (
              <FilterChip key={key} active={state.fag === key} onClick={() => apply({ fag: key })}>
                {t(FIELDS[key].label)}
              </FilterChip>
            ))}
          </FilterGroup>
          {state.type === "prosjekter" && (
            <FilterGroup title={t("Utvalgt")}>
              <FilterChip active={!state.utvalgt} onClick={() => apply({ utvalgt: false })}>
                {t("Alle")}
              </FilterChip>
              <FilterChip active={state.utvalgt} onClick={() => apply({ utvalgt: true })}>
                {t("Bare utvalgte")}
              </FilterChip>
            </FilterGroup>
          )}
          {state.type === "prosjekter" ? (
            <FilterGroup title={t("Periode")}>
              <FilterChip active={!state.periode} onClick={() => apply({ periode: null })}>
                {t("Når som helst")}
              </FilterChip>
              {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
                <FilterChip key={key} active={state.periode === key} onClick={() => apply({ periode: key })}>
                  {t(PERIODS[key].label)}
                </FilterChip>
              ))}
            </FilterGroup>
          ) : (
            <>
              <FilterGroup title={t("Sted")}>
                <FilterChip active={!state.sted} onClick={() => apply({ sted: null })}>
                  {t("Hele Norden")}
                </FilterChip>
                {locations.map((l) => (
                  <FilterChip key={l.location} active={state.sted === l.location} onClick={() => apply({ sted: l.location })}>
                    {l.location}
                  </FilterChip>
                ))}
              </FilterGroup>
              <FilterGroup title={t("Åpen for")}>
                <FilterChip active={!state.apen} onClick={() => apply({ apen: null })}>
                  {t("Alt")}
                </FilterChip>
                {OPEN_TO.map((o) => (
                  <FilterChip key={o} active={state.apen === o} onClick={() => apply({ apen: o })}>
                    {t(OPEN_TO_LABELS[o])}
                  </FilterChip>
                ))}
              </FilterGroup>
            </>
          )}
        </FilterButton>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              startTransition(() => router.replace(state.type === "personer" ? "/sok?type=personer" : "/sok", { scroll: false }));
            }}
            className="ml-1 text-sm text-mist underline-offset-4 transition hover:text-fg hover:underline"
          >
            {t("Nullstill")}
          </button>
        )}
        {pending && <span className="text-sm text-mist">{t("Oppdaterer …")}</span>}
      </div>
    </div>
  );
}
