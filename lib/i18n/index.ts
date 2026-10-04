import { EN } from "./en";

// Språk. Norsk er grunnspråket: teksten i koden er norsk, og den engelske ordboka
// (lib/i18n/en.ts) slår opp på den norske teksten. Mangler en oversettelse, vises norsk.

export const LOCALES = ["nb", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "vis-sprak";

export const isLocale = (value: unknown): value is Locale => value === "nb" || value === "en";

export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

export function translate(locale: Locale, text: string, vars?: Vars) {
  const base = locale === "en" ? (EN[text] ?? text) : text;
  return vars ? base.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? "")) : base;
}

export const makeT = (locale: Locale): T => (text, vars) => translate(locale, text, vars);
export const dateLocale = (locale: Locale) => (locale === "en" ? "en-GB" : "nb-NO");

// Fra Accept-Language: engelsk bare når nettleseren foretrekker engelsk foran norsk.
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return "nb";
  const langs = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of langs) {
    if (/^(nb|nn|no|da|sv)\b/.test(tag)) return "nb";
    if (tag.startsWith("en")) return "en";
  }
  return "nb";
}
