import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ACCENTS,
  APPLICATION_STATUS_LABELS,
  CONTACT_REASON_LABELS,
  CV_TEMPLATE_LABELS,
  FIELDS,
  JOB_TYPE_LABELS,
  OPEN_TO_LABELS,
  PERIODS,
  PROGRESS_LABELS,
  REACTION_LABELS,
  REMOTE_LABELS,
  REPORT_REASON_LABELS,
} from "@/lib/constants";
import { ACHIEVEMENTS, TIER_NAMES } from "@/lib/achievement-defs";
import { DEFAULT_LOCALE, localeCookie, translate } from "@/lib/i18n";
import { BANNER_ARTS, BANNER_GRADIENTS, BANNER_PATTERNS, PET_ACCESSORIES, PET_COLORS, PET_SPECIES } from "@/lib/profile-style";
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
    ...Object.values(PROGRESS_LABELS),
    ...ACHIEVEMENTS.flatMap((a) => [a.name, a.goal, a.about, ...(a.goalOne ? [a.goalOne] : [])]),
    ...TIER_NAMES.filter(Boolean),
    ...Object.values(PET_SPECIES).flatMap((p) => [p.label, p.sound]),
    ...all(between("components/pet/Pet.tsx", "const PHRASES = [", "];"), /"([^"]+)"/g),
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
    ...all(read("components/settings/SettingsDialog.tsx"), /(?:label|description): "([^"]+)"/g),
    ...all(read("lib/rate-limit.ts"), /(?:message: |SLOW_DOWN = )"([^"]+)"/g),
    ...Object.values(ACCENTS).map((a) => a.label),
    ...Object.values(REPORT_REASON_LABELS),
    ...Object.values(BANNER_GRADIENTS).map((g) => g.label),
    ...Object.values(BANNER_PATTERNS),
    ...Object.values(BANNER_ARTS),
    ...Object.values(PET_COLORS).map((c) => c.label),
    ...Object.values(PET_ACCESSORIES).map((a) => a.label),
    ...all(read("app/profil/rediger/konto/AccountForms.tsx"), /(?:label|description): "([^"]+)"/g),
    ...all(read("app/om/page.tsx"), /(?:title|text): "([^"]+)"/g),
    ...all(read("app/ny/page.tsx"), /(?:label|text): "([^"]+)"/g),
    ...all(read("components/ImageEditor.tsx"), /label: "([^"]+)"/g),
    ...all(between("app/innsikt/page.tsx", "const PERIOD_LABEL", ";"), /: "([^"]+)"/g),
    ...all(between("app/bedrift/[slug]/admin/page.tsx", "const ROLE_LABEL", "as const"), /: "([^"]+)"/g),
    ...all(between("app/bedrift/[slug]/admin/page.tsx", "const UPSELL_TEXT", "as const"), /: "([^"]+)"/g),
    ...Object.values(APPLICATION_STATUS_LABELS),
    ...all(between("components/moderation/ReportDialog.tsx", "const TITLES", "as const"), /: "([^"]+)"/g),
    ...all(between("app/varsler/page.tsx", "function dayLabel", "\n}"), /return "([^"]+)"/g),
  ];
}

// Meldinger brukeren ser: UserFacingError("…") oversettes i runAction (lib/action.ts),
// og toast("…") i Toaster (components/ui/toast.tsx).
function keysInMessages() {
  const keys = new Set<string>();
  for (const file of ["app", "components", "lib"].flatMap((d) => sourceFiles(join(ROOT, d)))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/UserFacingError\(([\s\S]*?)\);/g)) all(m[1], /"((?:[^"\\]|\\.)*)"/g).forEach((k) => keys.add(k));
    // Egne feilklasser (class X extends UserFacingError) sender teksten via super(…).
    for (const m of text.matchAll(/extends UserFacingError[\s\S]*?super\(([\s\S]*?)\);/g)) all(m[1], /"((?:[^"\\]|\\.)*)"/g).forEach((k) => keys.add(k));
    for (const m of text.matchAll(/\btoast(?:\.(?:success|error|info))?\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
  }
  return keys;
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

  test("feilmeldinger fra serveren og varsler (toast) er oversatt", () => {
    const missing = [...keysInMessages()].filter((key) => !(key in EN));
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

  test("norsk er standard, uansett nettleserens språk; engelsk bare når det er valgt", () => {
    assert.equal(DEFAULT_LOCALE, "nb");
    const server = read("lib/i18n/server.ts");
    assert.doesNotMatch(server, /accept-language/i);
    assert.equal(localeCookie("en", true), "vis-sprak=en; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
    assert.equal(localeCookie("nb", false), "vis-sprak=nb; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});

describe("feilmeldinger på riktig språk", () => {
  test("skjemafeil: zods standardmeldinger blir norske, og kan oversettes", async () => {
    const { z } = await import("zod");
    const { fieldErrors, projectInput } = await import("@/lib/validation");
    const error = z.object({ name: z.string().max(5) }).safeParse({ name: "for langt navn" }).error!;
    assert.deepEqual(fieldErrors(error), { name: ["Maks 5 tegn."] });
    assert.deepEqual(fieldErrors(error, "en"), { name: ["Max 5 characters."] });

    // Egne meldinger i skjemaet (med variabler fra .refine-params) oversettes også.
    const tags = Array.from({ length: 40 }, (_, i) => `tag${i}`);
    const parsed = projectInput.safeParse({ title: "", tags });
    assert.ok(!parsed.success);
    const en = fieldErrors(parsed.error, "en");
    assert.deepEqual(en.title, ["The project needs a title."]);
    assert.match(en.tags[0], /^Max \d+ technologies\.$/);
  });

  test("feil brukeren ser har norsk tekst og en mal som kan oversettes", async () => {
    const { UserFacingError } = await import("@/lib/result");
    const error = new UserFacingError("Du kan ha opptil {n} samlinger.", { n: 50 });
    assert.equal(error.message, "Du kan ha opptil 50 samlinger.");
    assert.equal(translate("en", error.text, error.vars), "You can have up to 50 collections.");
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
