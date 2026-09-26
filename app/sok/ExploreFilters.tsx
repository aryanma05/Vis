"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Kbd } from "@/components/ui/misc";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { OPEN_TO, OPEN_TO_LABELS, type OpenTo } from "@/lib/constants";

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

type State = { q: string; type: ExploreType; tag: string | null; sort: ExploreSort; sted: string | null; apen: OpenTo | null };

// Søk og filtre. Alt ligger i adressen, så treff kan deles og tilbake-knappen virker.
export default function ExploreFilters({ state, tags, locations }: { state: State; tags: Tag[]; locations: { location: string; count: number }[] }) {
  const router = useRouter();
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
  const hasFilters = Boolean(state.q || state.tag || state.sted || state.apen || (state.type === "prosjekter" && state.sort !== "relevant"));


  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: value });
        }}
        className="relative"
      >
        <Search className={`pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 ${pending ? "animate-pulse text-ice" : "text-mist"}`} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={state.type === "personer" ? "Søk etter navn, rolle, sted eller ferdighet …" : "Søk etter prosjekt, teknologi eller person …"}
          aria-label="Søk"
          className="h-16 w-full rounded-2xl border border-line bg-surface/60 pl-14 pr-24 text-lg text-fg outline-none transition placeholder:text-mist/50 focus:border-ice/60 focus:ring-4 focus:ring-ice/10"
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
              aria-label="Tøm søket"
              className="rounded-full p-1.5 text-mist transition hover:bg-surface-2 hover:text-fg"
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
        <div role="tablist" aria-label="Hva du søker etter" className="mr-2 inline-flex rounded-xl border border-line bg-ink-2/50 p-1">
          {(["prosjekter", "personer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={state.type === t}
              onClick={() => apply({ type: t, sort: "relevant" })}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium capitalize transition ${state.type === t ? "bg-primary text-on-primary" : "text-mist hover:text-fg"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <Menu label="Teknologi" align="start" className="max-h-80 w-64 overflow-y-auto" trigger={(t) => <FilterPill label={activeTag?.name ?? "Teknologi"} active={Boolean(state.tag)} open={t.open} onClick={t.toggle} />}>
          <MenuItem onSelect={() => apply({ tag: null })} hint={!state.tag ? <Check className="size-4 text-ice" /> : undefined}>
            Alle teknologier
          </MenuItem>
          <MenuSeparator />
          {tags.map((t) => (
            <MenuItem key={t.slug} onSelect={() => apply({ tag: t.slug })} hint={state.tag === t.slug ? <Check className="size-4 text-ice" /> : t.count}>
              {t.name}
            </MenuItem>
          ))}
        </Menu>

        {state.type === "prosjekter" ? (
          <Menu label="Sortering" align="start" className="w-56" trigger={(t) => <FilterPill label={SORT_LABELS[state.sort]} active={state.sort !== "relevant"} open={t.open} onClick={t.toggle} />}>
            {(Object.keys(SORT_LABELS) as ExploreSort[]).map((key) => (
              <MenuItem key={key} onSelect={() => apply({ sort: key })} hint={state.sort === key ? <Check className="size-4 text-ice" /> : undefined}>
                {SORT_LABELS[key]}
              </MenuItem>
            ))}
          </Menu>
        ) : (
          <>
            <Menu label="Sted" align="start" className="w-60" trigger={(t) => <FilterPill label={state.sted ?? "Sted"} active={Boolean(state.sted)} open={t.open} onClick={t.toggle} />}>
              <MenuItem onSelect={() => apply({ sted: null })} hint={!state.sted ? <Check className="size-4 text-ice" /> : undefined}>
                Hele Norden
              </MenuItem>
              {locations.length > 0 && <MenuSeparator />}
              {locations.map((l) => (
                <MenuItem key={l.location} onSelect={() => apply({ sted: l.location })} hint={state.sted === l.location ? <Check className="size-4 text-ice" /> : l.count}>
                  {l.location}
                </MenuItem>
              ))}
            </Menu>
            <Menu label="Åpen for" align="start" className="w-60" trigger={(t) => <FilterPill label={state.apen ? OPEN_TO_LABELS[state.apen] : "Åpen for"} active={Boolean(state.apen)} open={t.open} onClick={t.toggle} />}>
              <MenuLabel>Vis folk som er åpne for</MenuLabel>
              <MenuItem onSelect={() => apply({ apen: null })} hint={!state.apen ? <Check className="size-4 text-ice" /> : undefined}>
                Alt
              </MenuItem>
              {OPEN_TO.map((o) => (
                <MenuItem key={o} onSelect={() => apply({ apen: o })} hint={state.apen === o ? <Check className="size-4 text-ice" /> : undefined}>
                  {OPEN_TO_LABELS[o]}
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
            Nullstill
          </button>
        )}
        {pending && <span className="text-sm text-mist">Oppdaterer …</span>}
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
      className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${
        active ? "border-ice/60 bg-ice/10 text-fg" : "border-line text-fg/90 hover:border-mist/50"
      }`}
    >
      {label}
      <ChevronDown className="size-4 text-mist" />
    </button>
  );
}
