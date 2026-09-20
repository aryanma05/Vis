"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { ProjectCard } from "@/components/ProjectCard";
import { themeStyles } from "@/components/ThemeStyles";
import type { MockProfile } from "@/lib/mockData";

export default function ProfileView({
  user,
}: {
  user: MockProfile | null;
}) {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  if (!user) {
    return (
      <main className={`min-h-screen ${styles.page}`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNav />

          <div className="flex flex-1 items-center justify-center px-6 pb-24 md:pl-28">
            <section className={`w-full max-w-md rounded-2xl border p-8 text-center ${styles.card}`}>
              <p className={`text-sm uppercase tracking-[0.2em] ${styles.accent}`}>
                Profil
              </p>

              <h1 className="mt-4 text-2xl font-bold">
                Profilen ble ikke funnet
              </h1>

              <p className={`mt-3 text-sm leading-7 ${styles.muted}`}>
                Det finnes ingen profil med dette brukernavnet.
              </p>

              <Link
                href="/explore"
                className={`mt-6 inline-flex rounded-lg px-5 py-3 font-semibold ${styles.button}`}
              >
                Gå til Utforsk
              </Link>
            </section>
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
          <div className="mx-auto w-full max-w-5xl">
            <Link
              href="/explore"
              className={`text-sm underline underline-offset-4 ${styles.accent}`}
            >
              ← Tilbake til Utforsk
            </Link>

            <section className={`mt-6 rounded-2xl border p-7 ${styles.card}`}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#C7F9FF] text-3xl font-bold text-[#071A52]">
                  {user.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div>
                  <p className={`text-sm font-medium uppercase tracking-[0.2em] ${styles.accent}`}>
                    Profil
                  </p>

                  <h1 className="mt-2 text-3xl font-bold">
                    {user.fullName}
                  </h1>

                  <p className={`mt-1 ${styles.accent}`}>
                    @{user.username}
                  </p>

                  <p className={`mt-2 text-sm ${styles.muted}`}>
                    {user.location}
                  </p>

                  <p className={`mt-4 max-w-2xl leading-7 ${styles.muted}`}>
                    {user.bio}
                  </p>
                </div>
              </div>
            </section>

            <section className={`mt-6 rounded-2xl border p-7 ${styles.card}`}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className={`text-sm font-medium uppercase tracking-widest ${styles.accent}`}>
                    Portfolio
                  </p>

                  <h2 className="mt-2 text-2xl font-bold">
                    Prosjekter
                  </h2>
                </div>

                <p className={`text-sm ${styles.muted}`}>
                  {user.projects.length} prosjekter
                </p>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {user.projects.map((project) => (
                  <ProjectCard key={project.id} {...project} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}