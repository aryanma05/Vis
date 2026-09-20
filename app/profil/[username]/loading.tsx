"use client";

import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function ProfileLoading() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  return (
    <main className={`min-h-screen ${styles.page}`}>
      <div className="flex min-h-screen md:pl-28">


        <div className="flex-1 px-6 py-10 pb-28 md:pl-28">
          <div className="mx-auto w-full max-w-5xl animate-pulse">
            <div className={`h-4 w-32 rounded ${styles.cardSoft}`} />

            <section className={`mt-6 rounded-2xl border p-7 ${styles.card}`}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className={`h-24 w-24 rounded-2xl ${styles.cardSoft}`} />

                <div className="flex-1">
                  <div className={`h-8 w-48 rounded ${styles.cardSoft}`} />
                  <div className={`mt-3 h-4 w-24 rounded ${styles.cardSoft}`} />
                  <div className={`mt-4 h-4 w-32 rounded ${styles.cardSoft}`} />
                  <div className={`mt-5 h-16 max-w-xl rounded ${styles.cardSoft}`} />
                </div>
              </div>
            </section>

            <section className={`mt-6 rounded-2xl border p-7 ${styles.card}`}>
              <div className={`h-7 w-40 rounded ${styles.cardSoft}`} />

              <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className={`h-48 rounded-2xl border ${styles.cardSoft}`}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}