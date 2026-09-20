"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  Check,
  ChevronDown,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { ProjectCard } from "@/components/ProjectCard";
import { themeStyles } from "@/components/ThemeStyles";
import { mockProjects } from "@/lib/mockData";

type SortOption = "newest" | "az" | "za";

export default function ExplorePage() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState("Alle");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }

      if (sortRef.current && !sortRef.current.contains(target)) {
        setIsSortOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
        setIsSortOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const technologies = [
    "Alle",
    ...Array.from(
      new Set(mockProjects.flatMap((project) => project.technologies))
    ),
  ];

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const results = mockProjects.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        project.title.toLowerCase().includes(normalizedQuery) ||
        project.description.toLowerCase().includes(normalizedQuery) ||
        project.owner.fullName.toLowerCase().includes(normalizedQuery) ||
        project.technologies.some((item) =>
          item.toLowerCase().includes(normalizedQuery)
        );

      const matchesTechnology =
        technology === "Alle" || project.technologies.includes(technology);

      return matchesQuery && matchesTechnology;
    });

    return [...results].sort((a, b) => {
      if (sortOption === "az") {
        return a.title.localeCompare(b.title);
      }

      if (sortOption === "za") {
        return b.title.localeCompare(a.title);
      }

      return Number(b.id) - Number(a.id);
    });
  }, [query, technology, sortOption]);

  const hasFilters =
    query.trim() !== "" ||
    technology !== "Alle" ||
    sortOption !== "newest";

  const sortLabel =
    sortOption === "az"
      ? "Navn A–Å"
      : sortOption === "za"
      ? "Navn Å–A"
      : "Nyeste";

  function clearFilters() {
    setQuery("");
    setTechnology("Alle");
    setSortOption("newest");
    setIsFilterOpen(false);
    setIsSortOpen(false);
  }

  const filterButtonClasses =
    theme === "light"
      ? "border-[#D0D7E2] bg-white text-[#071A52] hover:border-[#086788]"
      : theme === "dark"
      ? "border-[#1F2937] bg-[#0B1220] text-[#E5F0FF] hover:border-[#7DD3FC]"
      : "border-[#174B76] bg-[#0A245E] text-white hover:border-[#C7F9FF]";

  const dropdownClasses =
    theme === "light"
      ? "border-[#D0D7E2] bg-white"
      : theme === "dark"
      ? "border-[#1F2937] bg-[#0B1220]"
      : "border-[#174B76] bg-[#0A245E]";

  const selectedOptionClasses =
    theme === "light"
      ? "bg-[#E3E8F3] text-[#071A52]"
      : "bg-[#086788] text-white";

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${styles.page}`}
    >
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 px-6 py-10 pb-28 md:pl-28">
          <div className="mx-auto w-full max-w-5xl">
            <div>
              <p
                className={`text-xs font-medium uppercase tracking-[0.2em] ${styles.accent}`}
              >
                vis
              </p>

              <h1 className="mt-4 text-3xl font-bold tracking-tight">
                Utforsk
              </h1>

              <p className={`mt-2 max-w-2xl text-sm leading-7 ${styles.muted}`}>
                Finn prosjekter og se hva andre digitale skapere bygger.
              </p>
            </div>

            <section className={`mt-8 rounded-2xl border p-4 ${styles.card}`}>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Søk etter prosjekt, person eller teknologi..."
                    aria-label="Søk etter prosjekt, person eller teknologi"
                    className={`w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-[#086788] focus:ring-2 focus:ring-[#086788]/20 ${styles.input}`}
                  />

                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Tøm søk"
                      className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-black/10 ${styles.muted}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div ref={filterRef} className="relative w-full md:w-56">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isFilterOpen}
                    onClick={() => {
                      setIsFilterOpen((current) => !current);
                      setIsSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${filterButtonClasses}`}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      <span>
                        {technology === "Alle"
                          ? "Alle teknologier"
                          : technology}
                      </span>
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isFilterOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isFilterOpen && (
                    <div
                      role="listbox"
                      className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border p-1 shadow-xl shadow-black/20 ${dropdownClasses}`}
                    >
                      {technologies.map((item) => {
                        const selected = technology === item;

                        return (
                          <button
                            key={item}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              setTechnology(item);
                              setIsFilterOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                              selected
                                ? selectedOptionClasses
                                : `${styles.muted} hover:bg-[#086788]/20 hover:text-current`
                            }`}
                          >
                            <span>
                              {item === "Alle" ? "Alle teknologier" : item}
                            </span>

                            {selected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div ref={sortRef} className="relative w-full md:w-44">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                    onClick={() => {
                      setIsSortOpen((current) => !current);
                      setIsFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition ${filterButtonClasses}`}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowDownAZ className="h-4 w-4" />
                      <span>{sortLabel}</span>
                    </span>

                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isSortOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isSortOpen && (
                    <div
                      role="listbox"
                      className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border p-1 shadow-xl shadow-black/20 ${dropdownClasses}`}
                    >
                      {[
                        { value: "newest", label: "Nyeste" },
                        { value: "az", label: "Navn A–Å" },
                        { value: "za", label: "Navn Å–A" },
                      ].map((option) => {const selected = sortOption === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => {
                              setSortOption(option.value as SortOption);
                              setIsSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                              selected
                                ? selectedOptionClasses
                                : `${styles.muted} hover:bg-[#086788]/20 hover:text-current`
                            }`}
                          >
                            <span>{option.label}</span>
                            {selected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className={`text-sm ${styles.muted}`}>
                {filteredProjects.length}{" "}
                {filteredProjects.length === 1 ? "prosjekt" : "prosjekter"}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`text-sm underline underline-offset-4 ${styles.accent}`}
                >
                  Nullstill filter
                </button>
              )}
            </div>

            {filteredProjects.length > 0 ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <ProjectCard key={project.id} {...project} />
                ))}
              </div>
            ) : (
              <section
                className={`mt-7 rounded-2xl border p-10 text-center ${styles.card}`}
              >
                <h2 className="text-xl font-semibold">
                  Ingen prosjekter funnet
                </h2>

                <p className={`mt-2 text-sm ${styles.muted}`}>
                  Prøv et annet søkeord eller fjern filteret.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className={`mt-5 rounded-lg px-4 py-2 text-sm font-semibold transition ${styles.button}`}
                >
                  Nullstill søk
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}