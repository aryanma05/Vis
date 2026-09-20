"use client";

import { useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`min-h-screen ${styles.page}`}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex flex-1 items-center justify-center px-6 pb-24 md:pl-28">
          <section className={`w-full max-w-md rounded-2xl border p-8 text-center ${styles.card}`}>
            <p className={`text-sm font-medium uppercase tracking-[0.2em] ${styles.accent}`}>
              Noe gikk galt
            </p>

            <h1 className="mt-4 text-2xl font-bold">
              Siden kunne ikke lastes
            </h1>

            <p className={`mt-3 text-sm leading-7 ${styles.muted}`}>
              Prøv å laste siden på nytt. Hvis problemet fortsetter, kan du
              gå tilbake til startsiden.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className={`rounded-lg px-5 py-3 font-semibold transition ${styles.button}`}
              >
                Prøv igjen
              </button>

              <Link
                href="/"
                className={`rounded-lg border px-5 py-3 font-semibold transition ${styles.secondaryButton}`}
              >
                Tilbake til hjem
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}