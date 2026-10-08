import type { TemplateKind } from "@/lib/company-labels";

// Svarmalene uten database: standardmalene, flettefeltene og selve flettingen. Trygg i
// nettleseren (forhåndsvisningen i TemplatesDialog) og ren, så den kan testes alene.
// E-postene til kandidatene er alltid på norsk (se spesifikasjonen § 6).

export const TEMPLATE_KINDS = ["takk", "intervju", "tilbud", "avslag", "generell"] as const satisfies readonly TemplateKind[];
export const MERGE_FIELDS = ["fornavn", "navn", "stilling", "bedrift", "svartid", "bookinglenke"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type TemplateVars = Partial<Record<MergeField, string | number | null | undefined>>;

export const MAX_TEMPLATES = 30;
export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_SUBJECT_MAX = 150;
export const TEMPLATE_BODY_MAX = 3000;
// Svartiden kandidaten får i «Takk for søknaden» ({svartid}).
export const RESPONSE_DAYS = [7, 10, 14, 21] as const;

export type TemplateText = { name: string; subject: string; body: string };

// Alltid tilgjengelige, også uten Bedrift. En linje med tomt flettefelt fjernes, så
// «Velg en tid her: {bookinglenke}» forsvinner når stillingen ikke har ledige tider.
export const DEFAULT_TEMPLATES: Record<TemplateKind, TemplateText> = {
  takk: {
    name: "Takk for søknaden",
    subject: "Takk for søknaden på {stilling}",
    body: "Hei {fornavn}!\n\nTakk for at du søkte på {stilling} hos {bedrift}. Vi har fått søknaden din og ser på den så snart vi kan.\nDu hører fra oss innen {svartid} dager.\n\nVennlig hilsen\n{bedrift}",
  },
  intervju: {
    name: "Invitasjon til intervju",
    subject: "{bedrift} vil gjerne snakke med deg",
    body: "Hei {fornavn}!\n\nTakk for søknaden på {stilling}. Vi vil gjerne bli bedre kjent med deg og inviterer deg til et intervju.\nVelg en tid som passer deg her: {bookinglenke}\n\nVi gleder oss til å snakke med deg!\n\nVennlig hilsen\n{bedrift}",
  },
  tilbud: {
    name: "Tilbud",
    subject: "Gode nyheter fra {bedrift}",
    body: "Hei {fornavn}!\n\nVi vil gjerne gi deg et tilbud på {stilling}. Vi tar kontakt med detaljene snart.\n\nGratulerer!\n\nVennlig hilsen\n{bedrift}",
  },
  avslag: {
    name: "Avslag",
    subject: "Svar på søknaden din hos {bedrift}",
    body: "Hei {fornavn}!\n\nTakk for at du søkte på {stilling}, og for tiden du brukte. Vi har gått videre med andre kandidater denne gangen.\n\nProsjektene dine ligger fortsatt på Vis, klare for neste mulighet. Lykke til videre!\n\nVennlig hilsen\n{bedrift}",
  },
  generell: {
    name: "Generell melding",
    subject: "Om søknaden din på {stilling}",
    body: "Hei {fornavn}!\n\nTakk for søknaden på {stilling}.\n\nVennlig hilsen\n{bedrift}",
  },
};

const FIELD = /\{(\w+)\}/g;
const isField = (name: string): name is MergeField => (MERGE_FIELDS as readonly string[]).includes(name);
const filled = (vars: TemplateVars, name: MergeField) => {
  const value = vars[name];
  return value === null || value === undefined ? "" : String(value).trim();
};

// Ren tekst ut: HTML-tagger fjernes (også i navn og titler som flettes inn), og mailer
// escaper resten. Ukjente felt som {foo} står som de er.
const stripTags = (text: string) => text.replace(/<\/?[a-zA-Z!?][^<>]*>/g, "").replace(/<(?=[a-zA-Z!?/])/g, "");

export function renderTemplate(body: string, vars: TemplateVars): string {
  const lines = String(body ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => ![...line.matchAll(FIELD)].some(([, name]) => isField(name) && !filled(vars, name)))
    .map((line) => line.replace(FIELD, (match, name: string) => (isField(name) ? filled(vars, name) : match)));
  return stripTags(lines.join("\n"))
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Emnet er én linje: tomme felt blir borte i stedet for at hele emnet forsvinner.
export function renderSubject(subject: string, vars: TemplateVars): string {
  const line = String(subject ?? "")
    .replace(/\s+/g, " ")
    .replace(FIELD, (match, name: string) => (isField(name) ? filled(vars, name) : match));
  return stripTags(line).replace(/\s{2,}/g, " ").trim();
}

export function renderMessage(template: Pick<TemplateText, "subject" | "body">, vars: TemplateVars) {
  return { subject: renderSubject(template.subject, vars), body: renderTemplate(template.body, vars) };
}

// Flettefeltene for én søker. bookingUrl bare når stillingen har ledige intervjutider.
export function templateVars(c: { name: string; jobTitle: string; companyName: string; responseDays: number; bookingUrl?: string | null }): TemplateVars {
  return {
    fornavn: c.name.trim().split(/\s+/)[0] || c.name,
    navn: c.name,
    stilling: c.jobTitle,
    bedrift: c.companyName,
    svartid: c.responseDays,
    bookinglenke: c.bookingUrl ?? "",
  };
}

// Malen som brukes når ingen er valgt (samme regel som pickTemplate på serveren): den nyeste
// egne av typen, ellers standardmalen. Listen kommer sortert fra listTemplates.
export function defaultTemplateFor<T extends { kind: TemplateKind; builtIn: boolean }>(templates: T[], kind: TemplateKind): T | undefined {
  return templates.find((t) => t.kind === kind && !t.builtIn) ?? templates.find((t) => t.kind === kind);
}
