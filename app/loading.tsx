"use client";

import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useTheme } from "@/components/ThemeProvider";
import { themeStyles } from "@/components/ThemeStyles";

export default function Loading() {
  const { theme } = useTheme();
  const styles = themeStyles[theme];

  return (
    <main className={`min-h-screen ${styles.page}`}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileNav />

        <div className="flex flex-1 items-center justify-center px-6 pb-24 md:pl-28">
          <div className="text-center">
            <div
              className={`mx-auto h-10 w-10 animate-spin rounded-full border-4 border-current border-t-transparent ${styles.accent}`}
              aria-label="Laster"
            />

            <p className={`mt-4 text-sm ${styles.muted}`}>
              Laster vis...
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}