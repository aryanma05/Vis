import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CONTACT_REASON_LABELS,
  CV_TEMPLATE_LABELS,
  FIELDS,
  JOB_TYPE_LABELS,
  OPEN_TO_LABELS,
  PERIODS,
  REACTION_LABELS,
  REMOTE_LABELS,
} from "@/lib/constants";
import { localeFromAcceptLanguage, translate } from "@/lib/i18n";
import { EN } from "@/lib/i18n/en";

const ROOT = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const all = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1]);

// Tekstene som sendes rett til t(): t("…") og t(betingelse ? "…" : "…").
function keysInCode() {
  const keys = new Set<string>();
  for (const file of ["app", "components", "lib"].flatMap((d) => sourceFiles(join(ROOT, d)))) {
    const text = readFileSync(file, "utf8");
    for (const key of all(text, /\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(key);
    for (const m of text.matchAll(/\bt\(\s*[^()"]*?\?\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,)]/g)) {
      keys.add(m[1]);
      keys.add(m[2]);
    }
  }
  return keys;
}

// Tekster som går gjennom t() via en variabel: lister, etiketter og feilmeldinger.
function keysInLists() {
  const between = (path: string, start: string, end: string) => {
    const text = read(path);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${start} finnes ikke i ${path}`);
    return text.slice(from, text.indexOf(end, from));
  };
  return [
    ...Object.values(OPEN_TO_LABELS),
    ...Object.values(REACTION_LABELS),
    ...Object.values(CONTACT_REASON_LABELS),
    ...Object.values(JOB_TYPE_LABELS),
    ...Object.values(REMOTE_LABELS),
    ...Object.values(FIELDS).map((f) => f.label),
    ...Object.values(PERIODS).map((p) => p.label),
    ...Object.values(CV_TEMPLATE_LABELS).flatMap((c) => [c.name, c.description]),
    ...all(between("app/priser/page.tsx", "const FREE = [", "];"), /"([^"]+)"/g),
    ...all(between("app/priser/page.tsx", "const PRO = [", "];"), /"([^"]+)"/g),
    ...all(between("app/priser/page.tsx", "const BUSINESS = [", "];"), /"([^"]+)"/g),
    ...all(read("components/SiteFooter.tsx"), /label: "([^"]+)"/g),
    ...all(read("components/nav/ThemeSwitch.tsx"), /label: "([^"]+)"/g),
    ...all(read("components/MobileNav.tsx"), /tab\("[^"]+", "([^"]+)"/g),
    ...all(between("app/sok/ExploreFilters.tsx", "const SORT_LABELS", "};"), /: "([^"]+)"/g),
    ...all(between("app/register/RegisterForm.tsx", "const STRENGTH = [", "];"), /"([^"]+)"/g),
    ...all(between("lib/webhooks.ts", "export const WEBHOOK_EVENTS", "} as const;"), /": "([^"]+)"/g),
    ...all(between("app/page.tsx", "function greeting()", "\n}"), /return "([^"]+)"/g),
    ...all(read("lib/profiles.ts"), /(?:label|description): "([^"]+)",/g).filter((s) => !s.startsWith("http")),
    ...all(read("lib/auth-errors.ts"), /message: "([^"]+)"/g),
    ...all(read("lib/site.ts"), /SITE_DESCRIPTION =\s+"([^"]+)"/g),
    ...all(read("lib/username.ts"), /return "([^"]+)"/g),
    ...all(read("lib/email.ts"), /(?:return|\?|:) "([^"]+)"/g),
  ];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("engelsk oversettelse", () => {
  test("alle tekster som sendes til t() har en engelsk oversettelse", () => {
    const missing = [...keysInCode()].filter((key) => !(key in EN));
    assert.deepEqual(missing, [], `Mangler i lib/i18n/en.ts:\n${missing.join("\n")}`);
  });

  test("etiketter, lister og feilmeldinger er oversatt", () => {
    const missing = [...new Set(keysInLists())].filter((key) => !(key in EN));
    assert.deepEqual(missing, [], `Mangler i lib/i18n/en.ts:\n${missing.join("\n")}`);
  });

  test("oversettelsene har de samme variablene som den norske teksten", () => {
    const wrong = Object.entries(EN).filter(([nb, en]) => placeholders(nb).join() !== placeholders(en).join());
    assert.deepEqual(wrong, []);
  });
});

describe("språkvalg", () => {
  test("variabler settes inn, og norsk vises når oversettelsen mangler", () => {
    assert.equal(translate("en", "{n} prosjekter", { n: 3 }), "3 projects");
    assert.equal(translate("nb", "{n} prosjekter", { n: 3 }), "3 prosjekter");
    assert.equal(translate("en", "Finnes ikke i ordboka"), "Finnes ikke i ordboka");
  });

  test("engelsk bare når nettleseren foretrekker engelsk foran skandinavisk", () => {
    assert.equal(localeFromAcceptLanguage(null), "nb");
    assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9"), "en");
    assert.equal(localeFromAcceptLanguage("nb-NO,nb;q=0.9,en;q=0.8"), "nb");
    assert.equal(localeFromAcceptLanguage("en;q=0.5,sv;q=0.9"), "nb");
    assert.equal(localeFromAcceptLanguage("de-DE,de;q=0.9"), "nb");
  });
});

describe("omdirigering etter språkbytte og innlogging", () => {
  test("bare interne stier slippes gjennom", async () => {
    const { safeInternalPath } = await import("@/lib/safe-path");
    assert.equal(safeInternalPath("/priser?x=1"), "/priser?x=1");
    assert.equal(safeInternalPath("//evil.example"), null);
    assert.equal(safeInternalPath("/\\evil.example"), null);
    assert.equal(safeInternalPath("https://evil.example"), null);
    assert.equal(safeInternalPath(null), null);
  });
});
