"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useChangeLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";

// «Norsk · English» i bunnteksten. Bytter mykt som i innstillingene, og lenkene virker
// også før JavaScript er lastet (via /sprak).
export default function LanguageSwitch() {
  const { chosen, setLocale } = useChangeLocale();
  const path = usePathname();
  const query = useSearchParams().toString();
  const back = encodeURIComponent(`${path}${query ? `?${query}` : ""}`);
  const link = (to: Locale, label: string) =>
    chosen === to ? (
      <span aria-current="true" lang={to} className="font-medium text-fg">
        {label}
      </span>
    ) : (
      <a
        href={`/sprak?til=${to}&tilbake=${back}`}
        hrefLang={to}
        lang={to}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          setLocale(to);
        }}
        className="transition hover:text-fg"
      >
        {label}
      </a>
    );
  return (
    <span className="inline-flex items-center gap-2">
      {link("nb", "Norsk")}
      <span aria-hidden="true">·</span>
      {link("en", "English")}
    </span>
  );
}
