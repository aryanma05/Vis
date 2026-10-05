"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

// «Norsk · English» i bunnteksten. Lenkene virker uten JavaScript.
export default function LanguageSwitch() {
  const locale = useLocale();
  const path = usePathname();
  const query = useSearchParams().toString();
  const back = encodeURIComponent(`${path}${query ? `?${query}` : ""}`);
  const link = (to: "nb" | "en", label: string) =>
    locale === to ? (
      <span aria-current="true" className="font-medium text-fg">
        {label}
      </span>
    ) : (
      <a href={`/sprak?til=${to}&tilbake=${back}`} hrefLang={to} className="transition hover:text-fg">
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
