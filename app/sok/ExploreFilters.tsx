"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useT } from "@/components/LocaleProvider";
import { Kbd } from "@/components/ui/misc";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
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

  const activeTag = tags.find((t) => t.slug === state.tag);
  const hasFilters = Boolean(
    state.q || state.tag || state.sted || state.apen || state.fag || state.periode || state.utvalgt || (state.type === "prosjekter" && state.sort !== "relevant"),
  );


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
        <div role="tablist" aria-label={t("Hva du søker etter")} className="glass-chip mr-2 inline-flex rounded-full p-1">
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

        <Menu label={t("Teknologi")} align="start" className="max-h-80 w-64 overflow-y-auto" trigger={(m) => <FilterPill label={activeTag?.name ?? t("Teknologi")} active={Boolean(state.tag)} open={m.open} onClick={m.toggle} />}>
          <MenuItem onSelect={() => apply({ tag: null })} hint={!state.tag ? <Check className="size-4 text-sea" /> : undefined}>
            {t("Alle teknologier")}
          </MenuItem>
          <MenuSeparator />
          {tags.map((tag) => (
            <MenuItem key={tag.slug} onSelect={() => apply({ tag: tag.slug })} hint={state.tag === tag.slug ? <Check className="size-4 text-sea" /> : tag.count}>
              {tag.name}
            </MenuItem>
          ))}
        </Menu>

        <Menu label={t("Fagfelt")} align="start" className="w-56" trigger={(m) => <FilterPill label={t(state.fag ? FIELDS[state.fag].label : "Fagfelt")} active={Boolean(state.fag)} open={m.open} onClick={m.toggle} />}>
          <MenuItem onSelect={() => apply({ fag: null })} hint={!state.fag ? <Check className="size-4 text-sea" /> : undefined}>
            {t("Alle fagfelt")}
          </MenuItem>
          <MenuSeparator />
          {FIELD_KEYS.map((key) => (
            <MenuItem key={key} onSelect={() => apply({ fag: key })} hint={state.fag === key ? <Check className="size-4 text-sea" /> : undefined}>
              {t(FIELDS[key].label)}
            </MenuItem>
          ))}
        </Menu>

        {state.type === "prosjekter" && (
          <Menu label={t("Periode")} align="start" className="w-52" trigger={(m) => <FilterPill label={t(state.periode ? PERIODS[state.periode].label : "Når")} active={Boolean(state.periode)} open={m.open} onClick={m.toggle} />}>
            <MenuItem onSelect={() => apply({ periode: null })} hint={!state.periode ? <Check className="size-4 text-sea" /> : undefined}>
              {t("Når som helst")}
            </MenuItem>
            {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
              <MenuItem key={key} onSelect={() => apply({ periode: key })} hint={state.periode === key ? <Check className="size-4 text-sea" /> : undefined}>
                {t(PERIODS[key].label)}
              </MenuItem>
            ))}
          </Menu>
        )}

        {state.type === "prosjekter" && (
          <button
            type="button"
            aria-pressed={state.utvalgt}
            onClick={() => apply({ utvalgt: !state.utvalgt })}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${state.utvalgt ? "bg-primary text-on-primary" : "glass-chip text-fg hover:bg-fill-2"}`}
          >
            {t("Utvalgt")}
          </button>
        )}

        {state.type === "prosjekter" ? (
          <Menu label={t("Sortering")} align="start" className="w-56" trigger={(m) => <FilterPill label={t(SORT_LABELS[state.sort])} active={state.sort !== "relevant"} open={m.open} onClick={m.toggle} />}>
            {(Object.keys(SORT_LABELS) as ExploreSort[]).map((key) => (
              <MenuItem key={key} onSelect={() => apply({ sort: key })} hint={state.sort === key ? <Check className="size-4 text-sea" /> : undefined}>
                {t(SORT_LABELS[key])}
              </MenuItem>
            ))}
          </Menu>
        ) : (
          <>
            <Menu label={t("Sted")} align="start" className="w-60" trigger={(m) => <FilterPill label={state.sted ?? t("Sted")} active={Boolean(state.sted)} open={m.open} onClick={m.toggle} />}>
              <MenuItem onSelect={() => apply({ sted: null })} hint={!state.sted ? <Check className="size-4 text-sea" /> : undefined}>
                {t("Hele Norden")}
              </MenuItem>
              {locations.length > 0 && <MenuSeparator />}
              {locations.map((l) => (
                <MenuItem key={l.location} onSelect={() => apply({ sted: l.location })} hint={state.sted === l.location ? <Check className="size-4 text-sea" /> : l.count}>
                  {l.location}
                </MenuItem>
              ))}
            </Menu>
            <Menu label={t("Åpen for")} align="start" className="w-60" trigger={(m) => <FilterPill label={t(state.apen ? OPEN_TO_LABELS[state.apen] : "Åpen for")} active={Boolean(state.apen)} open={m.open} onClick={m.toggle} />}>
              <MenuLabel>{t("Vis folk som er åpne for")}</MenuLabel>
              <MenuItem onSelect={() => apply({ apen: null })} hint={!state.apen ? <Check className="size-4 text-sea" /> : undefined}>
                {t("Alt")}
              </MenuItem>
              {OPEN_TO.map((o) => (
                <MenuItem key={o} onSelect={() => apply({ apen: o })} hint={state.apen === o ? <Check className="size-4 text-sea" /> : undefined}>
                  {t(OPEN_TO_LABELS[o])}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

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

function FilterPill({ label, active, open, onClick }: { label: React.ReactNode; active: boolean; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={open}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition ${
        active ? "bg-primary text-on-primary" : "glass-chip text-fg hover:bg-fill-2"
      }`}
    >
      {label}
      <ChevronDown className="size-4 opacity-60" />
    </button>
  );
}
