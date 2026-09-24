import type { Metadata } from "next";
import { ProjectGrid } from "@/components/ProjectCard";
import TagLinks from "@/components/TagLinks";
import { getPopularTags, getTagBySlug, searchProjects, type ProjectSort } from "@/lib/projects";
import ExploreFilters from "./ExploreFilters";

type Props = { searchParams: Promise<{ q?: string; tag?: string; sort?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, tag } = await searchParams;
  const subject = q?.trim() || (tag ? (await getTagBySlug(tag))?.name : null);
  return { title: subject ? `${subject} – søk` : "Utforsk prosjekter" };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tagSlug = params.tag?.trim().slice(0, 60) || null;
  const sort: ProjectSort = params.sort === "az" || params.sort === "za" ? params.sort : "newest";

  const [tags, activeTag, projects] = await Promise.all([
    getPopularTags(24),
    tagSlug ? getTagBySlug(tagSlug) : null,
    searchProjects(q, { tag: tagSlug, sort }),
  ]);

  const searching = Boolean(q || tagSlug);
  // Valgt teknologi skal vises selv om den ikke er blant de mest brukte.
  const tagList = activeTag && !tags.some((t) => t.slug === activeTag.slug) ? [activeTag, ...tags] : tags;

  return (
    <main className="min-h-screen px-6 pb-28 pt-12 md:pb-16 md:pl-28 md:pr-10">
      <div className="mx-auto w-full max-w-7xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Utforsk</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-6xl">
          Finn prosjekter å bli inspirert av.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-mist">
          Søk etter prosjekter, personer eller teknologier, og se hva andre bygger.
        </p>

        <div className="mt-8">
          <ExploreFilters tags={tagList} query={q} tag={tagSlug} sort={sort} />
        </div>

        {tagList.length > 0 && (
          <div className="mt-6">
            <TagLinks tags={tagList.slice(0, 16)} active={tagSlug} />
          </div>
        )}

        <div className="mt-12">
          <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-line pb-4">
            <h2 className="text-lg font-medium">
              {searching ? (
                <>
                  {projects.length} treff
                  {q && (
                    <>
                      {" "}
                      for <span className="text-ice">«{q}»</span>
                    </>
                  )}
                  {activeTag && (
                    <>
                      {" "}
                      i <span className="text-ice">{activeTag.name}</span>
                    </>
                  )}
                </>
              ) : (
                "Alle prosjekter"
              )}
            </h2>
          </div>

          {projects.length > 0 ? (
            <ProjectGrid projects={projects} />
          ) : (
            <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
              <p className="text-xl font-semibold">Ingen prosjekter passet søket.</p>
              <p className="mt-2 text-mist">Prøv et annet ord, eller velg en annen teknologi.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
