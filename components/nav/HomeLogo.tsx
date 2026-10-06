"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import { LogoBadge } from "@/components/Logo";
import { prefersReducedMotion } from "@/lib/display-prefs";

// Logoen (bare merket, uten ordet) øverst til venstre på desktop, midt over sidemenyen.
// Den følger siden når man blar (står ikke fast), og tar deg til forsiden, eller til
// toppen hvis du allerede er der.
export default function HomeLogo() {
  const pathname = usePathname();
  const t = useT();

  return (
    <Link
      href="/"
      aria-label={t(pathname === "/" ? "Vis – til toppen" : "Vis – til forsiden")}
      onClick={(event) => {
        if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const reduce = prefersReducedMotion();
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className="absolute left-[22px] top-6 z-40 hidden rounded-full transition hover:scale-105 active:scale-95 focus-visible:outline-offset-4 md:block print:!hidden"
    >
      <LogoBadge className="size-14 rounded-full shadow-[0_10px_28px_-10px_rgb(0_0_0/0.5)]" />
    </Link>
  );
}
