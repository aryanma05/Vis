"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoBadge } from "@/components/Logo";

// Logoen øverst i sidemenyen. Tar deg til forsiden, eller til toppen hvis du allerede er der.
export default function HomeLogo({ label, className = "" }: { label: string; className?: string }) {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      aria-label={label}
      onClick={(event) => {
        if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
      className={`home-logo relative block rounded-full focus-visible:outline-offset-4 ${className}`}
    >
      {/* Myk glød i logofargene som vokser når du peker på den. */}
      <span aria-hidden="true" className="home-logo-glow absolute -inset-1 rounded-full" />
      <LogoBadge className="home-logo-badge relative size-full rounded-full ring-1 ring-line" />
    </Link>
  );
}
