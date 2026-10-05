// Dato-formater på norsk eller engelsk. Brukes både på server og klient.

import { dateLocale, type Locale } from "@/lib/i18n";

const rtf = { nb: new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" }), en: new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" }) };

export function timeAgo(date: Date | string, locale: Locale = "nb") {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const f = rtf[locale];
  if (abs < 45) return locale === "en" ? "just now" : "akkurat nå";
  if (abs < 3600) return f.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return f.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 7) return f.format(Math.round(seconds / 86400), "day");
  return d.toLocaleDateString(dateLocale(locale), { day: "numeric", month: "short", year: "numeric" });
}

// "2024-05" -> "mai 2024" / "May 2024", "2024" -> "2024"
export function formatYearMonth(value: string | null | undefined, locale: Locale = "nb") {
  if (!value) return null;
  const [year, month] = value.split("-");
  if (!month) return year;
  return new Date(Number(year), Number(month) - 1)
    .toLocaleDateString(dateLocale(locale), { month: "short", year: "numeric" })
    .replace(".", "");
}

export function formatPeriod(start: string | null, end: string | null, locale: Locale = "nb") {
  const from = formatYearMonth(start, locale);
  const to = end ? formatYearMonth(end, locale) : locale === "en" ? "present" : "nå";
  if (!from) return end ? to : null;
  return `${from} – ${to}`;
}

// «12. mars 2026» / «12 March 2026»
export function formatDate(date: Date | string, locale: Locale = "nb", month: "long" | "short" = "long") {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(dateLocale(locale), { day: "numeric", month, year: "numeric" });
}
