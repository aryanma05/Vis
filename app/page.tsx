import Link from "next/link";
import GradientWaves from "@/components/GradientWaves";
import ProjectFeed from "@/components/ProjectFeed";
import SiteHeader from "@/components/SiteHeader";
import TagLinks from "@/components/TagLinks";
import { ArrowIcon } from "@/components/icons";
import { getLatestProjects, getPopularTags } from "@/lib/projects";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const [{ projects, nextCursor }, tags, user] = await Promise.all([
    getLatestProjects({ limit: 24 }),
    getPopularTags(14),
    getCurrentUser(),
  ]);

  return (
    <main className="bg-ink text-white">
      <section className="relative min-h-screen overflow-hidden bg-[#1b1035]">
        <SiteHeader variant="overlay" />
        <div className="absolute inset-0">
          <GradientWaves
            horizonColor="#071A52"
            waveColor="#086788"
            crestColor="#C7F9FF"
            speed={0.4}
            amplitude={2.5}
            waveScale={0.6}
            waveRatio={0.9}
            swell={35}
            turbulence={20}
            tilt={1.11}
            zoom={1}
            height={5.5}
            fogDepth={15}
            detail="medium"
            brightness={1}
            opacity={1}
            mouseInteraction
            parallaxStrength={0.5}
            grain
            grainIntensity={0.05}
          />
        </div>

        <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
          <div className="rounded-full border border-white/25 bg-black/15 px-4 py-2 text-sm text-white/85 backdrop-blur">
            For utviklere, designere og digitale skapere
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
            Vis ditt verk.
            <br />
            Vis deg selv.
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-white/85">
            Vis samler din CV, dine prosjekter og digitale identitet i en
            visuell profil.
          </p>

          <div className="mt-10 flex w-full max-w-xs flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <Link
              href="/sok"
              className="group inline-flex items-center justify-center gap-3 rounded-xl border border-white bg-white px-10 py-5 text-lg font-semibold text-black shadow-[0_20px_60px_-20px_rgba(199,249,255,0.6)] transition hover:bg-ice md:px-12 md:text-xl"
            >
              Utforsk prosjekter
              <ArrowIcon className="h-5 w-5 transition group-hover:translate-x-1" />
            </Link>

            <Link
              href={user ? "/ny" : "/register"}
              className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-black/15 px-8 py-5 text-lg font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              {user ? "Del prosjekt" : "Kom i gang"}
            </Link>
          </div>
        </section>
      </section>

      <section className="relative border-t border-line">
        <div className="mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">
                Nytt på vis
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
                Nyeste prosjekter
              </h2>
            </div>
            <Link
              href="/sok"
              className="group inline-flex items-center gap-2 text-sm text-mist transition hover:text-white"
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
                <p className="mt-2 text-mist">
                  Bli den første som viser frem noe.
                </p>
                <Link
                  href="/ny"
                  className="mt-6 inline-flex rounded-lg bg-ice px-5 py-3 font-semibold text-ink transition hover:bg-white"
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
