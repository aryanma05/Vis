"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownAZ, Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import type { ProjectSort } from "@/lib/projects";

type Tag = { slug: string; name: string; count?: number };

const SORT_LABELS: Record<ProjectSort, string> = {
  newest: "Nyeste",
  az: "Navn A–Å",
  za: "Navn Å–A",
};

// Søk, teknologifilter og sortering. Alt legges i adressen, så treff kan deles.
export default function ExploreFilters({
  tags,
  query,
  tag,
  sort,
}: {
  tags: Tag[];
  query: string;
  tag: string | null;
  sort: ProjectSort;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  // Følg adressen når brukeren trykker fram/tilbake i nettleseren.
  if (lastQuery !== query) {
    setLastQuery(query);
    setValue(query);
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) setIsFilterOpen(false);
      if (sortRef.current && !sortRef.current.contains(target)) setIsSortOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
        setIsSortOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function apply(next: { q?: string; tag?: string | null; sort?: ProjectSort }) {
    const params = new URLSearchParams();
    const q = next.q ?? value;
    const nextTag = next.tag === undefined ? tag : next.tag;
    const nextSort = next.sort ?? sort;
    if (q.trim()) params.set("q", q.trim());
    if (nextTag) params.set("tag", nextTag);
    if (nextSort !== "newest") params.set("sort", nextSort);
    const search = params.toString();
    startTransition(() => router.push(search ? `/sok?${search}` : "/sok"));
  }

  const hasFilters = Boolean(query || tag || sort !== "newest");
  const activeTagName = tags.find((t) => t.slug === tag)?.name;

  const dropdown =
    "absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-black/30";
  const option = "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-ink";

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-3 md:flex-row">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: value });
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Søk etter prosjekt, person eller teknologi…"
            aria-label="Søk etter prosjekt, person eller teknologi"
            className="w-full rounded-lg border border-line bg-ink py-3 pl-11 pr-10 text-sm text-fg outline-none transition placeholder:text-mist/60 focus:border-ice focus:ring-2 focus:ring-ice/20"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                apply({ q: "" });
              }}
              aria-label="Tøm søk"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-mist transition hover:bg-black/10 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex gap-3">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setIsFilterOpen((open) => !open);
                setIsSortOpen(false);
              }}
              aria-expanded={isFilterOpen}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg transition hover:border-ice"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeTagName ?? "Teknologi"}
              <ChevronDown className="h-4 w-4" />
            </button>

            {isFilterOpen && (
              <div className={dropdown}>
                <div className="max-h-72 overflow-y-auto py-1">
                  <button
                    type="button"
                    className={option}
                    onClick={() => {
                      setIsFilterOpen(false);
                      apply({ tag: null });
                    }}
                  >
                    Alle
                    {!tag && <Check className="h-4 w-4 text-ice" />}
                  </button>
                  {tags.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      className={option}
                      onClick={() => {
                        setIsFilterOpen(false);
                        apply({ tag: t.slug });
                      }}
                    >
                      <span className="truncate">
                        {t.name}
                        {t.count !== undefined && <span className="ml-2 text-xs text-mist">{t.count}</span>}
                      </span>
                      {tag === t.slug && <Check className="h-4 w-4 shrink-0 text-ice" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => {
                setIsSortOpen((open) => !open);
                setIsFilterOpen(false);
              }}
              aria-expanded={isSortOpen}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-fg transition hover:border-ice"
            >
              <ArrowDownAZ className="h-4 w-4" />
              {SORT_LABELS[sort]}
              <ChevronDown className="h-4 w-4" />
            </button>

            {isSortOpen && (
              <div className={dropdown}>
                {(Object.keys(SORT_LABELS) as ProjectSort[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={option}
                    onClick={() => {
                      setIsSortOpen(false);
                      apply({ sort: key });
                    }}
                  >
                    {SORT_LABELS[key]}
                    {sort === key && <Check className="h-4 w-4 text-ice" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {(hasFilters || pending) && (
        <div className="mt-3 flex items-center gap-4 text-sm text-mist">
          {pending && <span>Oppdaterer…</span>}
          {hasFilters && !pending && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                startTransition(() => router.push("/sok"));
              }}
              className="underline underline-offset-4 transition hover:text-fg"
            >
              Nullstill filtre
            </button>
          )}
        </div>
      )}
    </section>
  );
}
