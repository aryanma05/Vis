"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { TechTag } from "@/components/TechTag";
import { themeStyles } from "@/components/ThemeStyles";

type ProjectData = {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  repoUrl: string;
  demoUrl: string;
  owner: {
    username: string;
    fullName: string;
  };
};

export default function ProjectView({
  project,
}: {
  project: ProjectData | null;
}) {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  if (!project) {
    return (
      <main className={`min-h-screen transition-colors duration-300 ${styles.page}`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNav />

          <div className="flex flex-1 items-center justify-center px-6 pb-24 md:pl-28">
            <div className="text-center">
              <p className={`text-sm uppercase tracking-widest ${styles.accent}`}>
                vis
              </p>

              <h1 className="mt-3 text-2xl font-bold">
                Project not found
              </h1>

              <p className={`mt-2 text-sm ${styles.muted}`}>
                Prosjektet du ser etter finnes ikke.
              </p>

              <Link
                href="/explore"
                className={`mt-6 inline-flex rounded-lg px-4 py-2 text-sm font-semibold transition ${styles.button}`}
              >
                Tilbake til Utforsk
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen transition-colors duration-300 ${styles.page}`}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 px-6 py-10 pb-28 md:pl-28">
          <div className="mx-auto w-full max-w-3xl">
            <Link
              href={`/profil/${project.owner.username}`}
              className={`text-sm underline underline-offset-4 transition ${styles.accent}`}
            >
              ← Tilbake til {project.owner.fullName}
            </Link>

            <article className={`mt-6 rounded-2xl border p-7 md:p-10 ${styles.card}`}>
              <p
                className={`text-sm font-medium uppercase tracking-[0.2em] ${styles.accent}`}
              >
                Prosjekt
              </p>

              <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                {project.title}
              </h1>

              <p className={`mt-5 max-w-2xl text-lg leading-8 ${styles.muted}`}>
                {project.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {project.technologies.map((technology) => (
                  <TechTag key={technology} label={technology} />
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-lg px-5 py-3 font-semibold transition ${styles.button}`}
                  >
                    View GitHub
                  </a>
                )}

                {project.demoUrl && project.demoUrl !== "#" && (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`rounded-lg border px-5 py-3 font-semibold transition ${styles.secondaryButton}`}
                  >
                    View demo
                  </a>
                )}
              </div>

              <div className={`mt-14 rounded-2xl border p-6 ${styles.cardSoft}`}>
                <p className={`text-sm font-medium ${styles.accent}`}>
                  Laget av
                </p>

                <Link
                  href={`/profil/${project.owner.username}`}
                  className={`mt-2 inline-block text-xl font-semibold transition ${styles.accent}`}
                >
                  {project.owner.fullName}
                </Link>

                <p className={`mt-1 text-sm ${styles.muted}`}>
                  @{project.owner.username}
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}