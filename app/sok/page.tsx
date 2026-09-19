import type { Metadata } from "next";
import Link from "next/link";
import { ProjectGrid } from "@/components/ProjectCard";
import SiteHeader from "@/components/SiteHeader";
import TagLinks from "@/components/TagLinks";
import { SearchIcon } from "@/components/icons";
import { getLatestProjects, getPopularTags, getTagBySlug, searchProjects } from "@/lib/projects";

type Props = { searchParams: Promise<{ q?: string; tag?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, tag } = await searchParams;
  const subject = q?.trim() || (tag ? (await getTagBySlug(tag))?.name : null);
  return { title: subject ? `${subject} – søk på vis` : "Utforsk prosjekter – vis" };
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tagSlug = params.tag?.trim().slice(0, 60) || null;

  const [tags, activeTag] = await Promise.all([getPopularTags(16), tagSlug ? getTagBySlug(tagSlug) : null]);
  const searching = Boolean(q || tagSlug);
  const projects = searching
    ? await searchProjects(q, { tag: tagSlug })
    : (await getLatestProjects({ limit: 24 })).projects;

  // Sørg for at valgt teknologi vises selv om den ikke er blant de populære.
  const tagList = activeTag && !tags.some((t) => t.slug === activeTag.slug) ? [activeTag, ...tags] : tags;

  return (
    <main className="min-h-screen bg-ink text-white">
      <SiteHeader />

      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-14 md:pt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Utforsk</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Finn prosjekter å bli inspirert av.
          </h1>

          <form action="/sok" className="mt-10 max-w-3xl">
            {tagSlug && <input type="hidden" name="tag" value={tagSlug} />}
            <label htmlFor="q" className="sr-only">
              Søk
            </label>
            <div className="flex items-center gap-3 border-b-2 border-line pb-3 transition focus-within:border-ice">
              <SearchIcon className="h-6 w-6 shrink-0 text-mist" />
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={q}
                autoFocus={!searching}
                placeholder="Søk etter tittel, teknologi eller idé"
                className="w-full bg-transparent text-xl text-white outline-none placeholder:text-mist/50 md:text-2xl"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white">
                Søk
              </button>
            </div>
          </form>

          {tagList.length > 0 && (
            <div className="mt-8">
              <TagLinks tags={tagList} active={tagSlug} />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex items-baseline justify-between gap-4">
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
              "Nyeste prosjekter"
            )}
          </h2>
          {searching && (
            <Link href="/sok" className="text-sm text-mist transition hover:text-white">
              Nullstill
            </Link>
          )}
        </div>

        {projects.length > 0 ? (
          <ProjectGrid projects={projects} />
        ) : (
          <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
            <p className="text-xl font-semibold">Ingen prosjekter passet søket.</p>
            <p className="mt-2 text-mist">Prøv et annet ord, eller velg en teknologi over.</p>
          </div>
        )}
      </section>
    </main>
  );
}
