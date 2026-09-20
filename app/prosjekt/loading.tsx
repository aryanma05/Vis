"use client";

import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function ProjectLoading() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  return (
    <main className={`min-h-screen ${styles.page}`}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex-1 px-6 py-10 pb-28 md:pl-28">
          <div className="mx-auto w-full max-w-3xl animate-pulse">
            <div className={`h-4 w-48 rounded ${styles.cardSoft}`} />

            <article className={`mt-6 rounded-2xl border p-7 md:p-10 ${styles.card}`}>
              <div className={`h-4 w-24 rounded ${styles.cardSoft}`} />
              <div className={`mt-5 h-12 w-2/3 rounded ${styles.cardSoft}`} />
              <div className={`mt-6 h-24 max-w-2xl rounded ${styles.cardSoft}`} />

              <div className="mt-8 flex gap-2">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className={`h-8 w-24 rounded-full ${styles.cardSoft}`}
                  />
                ))}
              </div>

              <div className="mt-10 flex gap-3">
                <div className={`h-12 w-32 rounded-lg ${styles.cardSoft}`} />
                <div className={`h-12 w-32 rounded-lg ${styles.cardSoft}`} />
              </div>
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}