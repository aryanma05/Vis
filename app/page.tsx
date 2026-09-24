import Link from "next/link";
import ProjectFeed from "@/components/ProjectFeed";
import TagLinks from "@/components/TagLinks";
import { ArrowIcon } from "@/components/icons";
import { getLatestProjects, getPopularTags } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";
import HomeHero from "./HomeHero";

export default async function Home() {
  const [{ projects, nextCursor }, tags, user] = await Promise.all([
    getLatestProjects({ limit: 24 }),
    getPopularTags(14),
    getCurrentUser(),
  ]);

  return (
    <main className="min-h-screen">
      <HomeHero isLoggedIn={Boolean(user)} />

      <section className="border-t border-line px-6 pb-28 md:pb-20 md:pl-28 md:pr-10">
        <div className="mx-auto w-full max-w-7xl py-20 md:py-28">
          <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">Nytt på vis</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-6xl">
                Nyeste prosjekter
              </h2>
            </div>
            <Link
              href="/sok"
              className="group inline-flex items-center gap-2 text-sm text-mist transition hover:text-fg"
            >
              Utforsk alle
              <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          {tags.length > 0 && (
            <div className="mt-8">
              <TagLinks tags={tags} />
            </div>
          )}

          <div className="mt-12">
            {projects.length > 0 ? (
              <ProjectFeed initial={projects} cursor={nextCursor} />
            ) : (
              <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
                <p className="text-2xl font-semibold">Ingen prosjekter ennå.</p>
                <p className="mt-2 text-mist">Bli den første som viser frem noe.</p>
                <Link
                  href="/ny"
                  className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary transition hover:opacity-90"
                >
                  Del et prosjekt
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
