"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function NotFound() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  return (
    <main className={`min-h-screen transition-colors duration-300 ${styles.page}`}>
      <div className="flex min-h-screen md:pl-28">


        <div className="flex flex-1 items-center justify-center px-6 pb-24 md:pl-28">
          <section className={`w-full max-w-md rounded-2xl border p-8 text-center ${styles.card}`}>
            <p className={`text-sm font-medium uppercase tracking-[0.2em] ${styles.accent}`}>
              404
            </p>

            <h1 className="mt-4 text-3xl font-bold">
              Siden ble ikke funnet
            </h1>

            <p className={`mt-3 text-sm leading-7 ${styles.muted}`}>
              Denne siden finnes ikke, eller lenken du brukte er ugyldig.
            </p>

            <Link
              href="/"
              className={`mt-6 inline-flex rounded-lg px-5 py-3 font-semibold transition ${styles.button}`}
            >
              Tilbake til hjem
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}