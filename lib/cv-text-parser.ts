// Leser en CV ut fra teksten alene, uten språkmodell eller andre betalte tjenester.
// Reglene ser etter kjente overskrifter (Erfaring, Utdanning, Skills …), datoer og
// skilletegn. Resultatet er et utkast som brukeren ser over før det lagres, så det
// trenger ikke være perfekt – men det skal aldri finne på noe som ikke står i CV-en.

import type { ParsedCv } from "@/lib/validation";

export type CvLine = {
  text: string;
  /** Skriftstørrelse i punkter, når den er kjent (PDF og Word). */
  size?: number;
  /** Linjen er rykket inn, typisk et kulepunkt. */
  indent?: boolean;
  /** Side og spalte linjen står i (PDF). Spalte -1 er et banner over begge spaltene. */
  page?: number;
  column?: number;
};

type Line = { text: string; size: number; indent: boolean; marker: boolean; page: number; column: number };
type Kind = "summary" | "experience" | "education" | "skills" | "contact" | "other";

/* -------------------------------------------------------------------------- */
/*  Ordlister                                                                 */
/* -------------------------------------------------------------------------- */

const HEADINGS: Record<Kind, string[]> = {
  summary: [
    "profil", "om meg", "kort om meg", "sammendrag", "oppsummering", "personlig profil", "profiltekst", "nøkkelinformasjon",
    "summary", "profile", "about", "about me", "professional summary", "career summary", "objective", "career objective",
  ],
  experience: [
    "erfaring", "arbeidserfaring", "yrkeserfaring", "relevant erfaring", "jobberfaring", "praksis", "verv", "tillitsverv",
    "frivillig arbeid", "frivillig erfaring", "prosjekterfaring", "arbeidsliv", "experience", "work experience",
    "professional experience", "relevant experience", "employment", "employment history", "work history", "career",
    "volunteering", "volunteer experience", "internships",
  ],
  education: [
    "utdanning", "utdannelse", "skolegang", "kurs", "kurs og sertifiseringer", "sertifiseringer", "sertifikater",
    "videreutdanning", "utdanning og kurs", "education", "academic background", "certifications", "certificates",
    "courses", "licenses og certifications", "education og certifications", "qualifications",
  ],
  skills: [
    "ferdigheter", "kompetanse", "nøkkelkompetanse", "kjernekompetanse", "teknisk kompetanse", "tekniske ferdigheter",
    "teknologier", "verktøy", "verktøy og teknologier", "teknologier og verktøy", "ferdigheter og verktøy", "toppferdigheter",
    "topp ferdigheter", "skills", "technical skills", "key skills", "core skills", "top skills", "core competencies",
    "competencies", "expertise", "technologies", "tools", "tech stack", "tools og technologies", "technologies og tools",
  ],
  contact: [
    "kontakt", "kontaktinfo", "kontaktinformasjon", "personalia", "personlig informasjon", "personlige opplysninger",
    "contact", "contact info", "contact information", "contact details", "personal details", "personal information",
  ],
  other: [
    "språk", "språkkunnskaper", "referanser", "interesser", "hobbyer", "fritid", "fritidsinteresser", "prosjekter",
    "utvalgte prosjekter", "publikasjoner", "priser", "utmerkelser", "prestasjoner", "annet", "andre opplysninger",
    "førerkort", "portefølje", "languages", "references", "interests", "hobbies", "projects", "selected projects",
    "publications", "awards", "honors", "honors-awards", "achievements", "other", "additional information", "portfolio",
  ],
};

// Brukes når overskriften ser ut som en overskrift (store bokstaver, større skrift eller kolon)
// men ikke står i listen over, f.eks. «Ledererfaring» eller «Tekniske verktøy».
const HEADING_STEMS: [Kind, string[]][] = [
  ["other", ["språk", "language", "referanse", "reference"]],
  ["experience", ["erfaring", "experience", "employment", "verv", "praksis"]],
  ["education", ["utdann", "education", "sertifi", "certific", "kurs", "course"]],
  ["skills", ["ferdighet", "kompetanse", "skill", "teknologi", "verktøy", "competenc"]],
  ["summary", ["profil", "sammendrag", "summary", "profile", "om meg", "about"]],
  ["contact", ["kontakt", "contact", "personalia"]],
  ["other", ["interesse", "interest", "hobb", "prosjekt", "project", "publika", "award", "utmerkel", "portef", "portfol"]],
];

// Også uten mellomrom, for overskrifter med sperret skrift («O M M E G» blir «OMMEG»).
const HEADING_LOOKUP = new Map<string, Kind>(
  (Object.entries(HEADINGS) as [Kind, string[]][]).flatMap(([kind, words]) =>
    words.flatMap((w) => [[w.replace(/\s+/g, ""), kind] as const, [w, kind] as const]),
  ),
);

// Norske sammensetninger («systemutvikler», «UX-designer») gjør at disse må kunne stå inne i ord.
const ROLE_PARTS = [
  "utvikler", "designer", "konsulent", "rådgiver", "leder", "sjef", "analytiker", "arkitekt", "ingeniør", "assistent",
  "lærer", "lektor", "forsker", "spesialist", "koordinator", "ansvarlig", "medarbeider", "selger", "ekspeditør",
  "sykepleier", "gründer", "praktikant", "programmerer", "tekniker", "redaktør", "journalist", "fotograf", "illustratør",
  "veileder", "mentor", "frivillig", "vikar", "lærling", "sommerjobb", "student", "operatør", "montør", "elektriker",
  "snekker", "regnskapsfører", "økonom", "revisor", "advokat", "jurist", "direktør", "styreleder", "styremedlem", "kokk",
  "servitør", "kasserer", "sjåfør", "trainee", "freelance", "frilans", "skribent", "saksbehandler", "strateg",
  "produkteier", "daglig leder",
];
const ROLE_WORDS =
  /\b(?:developer|engineer|designer|consultant|advis[eo]r|manager|lead|head of|director|analyst|architect|assistant|teacher|researcher|scientist|specialist|coordinator|owner|founder|co-?founder|ceo|cto|cfo|coo|cpo|cmo|vp|president|intern|internship|trainee|volunteer|programmer|administrator|technician|writer|editor|photographer|illustrator|animator|officer|representative|associate|executive|strategist|tutor|instructor|lecturer|professor|nurse|tester|contractor|freelancer|chair|apprentice|cashier|waiter|chef|driver|clerk|accountant|auditor|lawyer|attorney|devops|scrum master|partner|member)\b/i;

const ORG_SUFFIX = /(?:^|\s)(?:AS|ASA|SA|DA|ANS|AB|ApS|Oy|Inc\.?|Ltd\.?|LLC|GmbH|BV|AG|PLC|Corp\.?|Co\.)$/;
const ORG_PARTS = [
  "kommune", "universitet", "university", "høgskole", "høyskole", "sykehus", "direktorat", "departement", "etaten",
  "tilsynet", "skole", "school", "college", "academy", "akademi", "sparebank", "forsikring", "gruppen", "consulting",
  "technologies", "byrå", "agency", "stiftelse", "forening", "forbund", "fylkeskommune", "studentsamskipnad",
];
const ORG_NAMES =
  /\b(?:NAV|Equinor|Telenor|DNB|Schibsted|Vipps|FINN|Bekk|Kantega|Knowit|Accenture|Capgemini|Deloitte|PwC|KPMG|EY|Evry|Tietoevry|TietoEVRY|Visma|Cognite|Kahoot!?|Oda|Posten|Bring|Statkraft|Hydro|Yara|Aker|Kongsberg|Storebrand|Gjensidige|SINTEF|Ruter|Vy|NRK|TV 2|Netcompany|Computas|Miles|Bouvet|Itera|Iterate|Webstep|Sopra Steria|Google|Microsoft|Meta|Amazon|Apple|Spotify|Netflix|IBM|Oracle|SAP|Cisco|Ericsson|Nordea|Rema 1000|Coop|Elkjøp|IKEA|Forsvaret|Politiet|Skatteetaten|Statens vegvesen|Mattilsynet|Helse \p{L}+)\b/u;

const INSTITUTION_PARTS = [
  "universitet", "university", "høgskole", "høyskole", "college", "skole", "school", "gymnas", "videregående", "akademi",
  "academy", "institutt", "institute", "handelshøyskole", "polytechnic",
];
const INSTITUTION_NAMES =
  /\b(?:NTNU|UiO|UiB|UiT|UiA|UiS|OsloMet|NHH|BI|NMBU|USN|HVL|HiOF|Kristiania|Noroff|Westerdals|Coursera|Udemy|edX|Codecademy|freeCodeCamp|LinkedIn Learning|ETH|MIT)\b/;

const DEGREE =
  /(?:bachelor|master|ph\.?\s?d|doktorgrad|sivilingeniør|siv\.\s?ing|cand\.|årsstudium|årsenhet|studiekompetanse|studiespesialisering|fagbrev|svennebrev|diplom|certificate|certification|sertifikat|sertifisering|kurs\b|course|bootcamp|grunnfag|mellomfag|hovedfag|påbygg|\bvg[123]\b|yrkesfag|associate degree|high school|\b(?:msc|bsc|m\.sc|b\.sc|mba|mphil|llm)\b)|\b(?:MS|BS|MA|BA|MSc|BSc|MBA)\b/i;

const CITIES = new Set([
  "oslo", "bergen", "trondheim", "stavanger", "kristiansand", "tromsø", "drammen", "fredrikstad", "sandnes", "ålesund",
  "bodø", "sandefjord", "tønsberg", "sarpsborg", "skien", "porsgrunn", "larvik", "haugesund", "arendal", "moss", "hamar",
  "lillehammer", "gjøvik", "molde", "kristiansund", "harstad", "halden", "kongsberg", "asker", "bærum", "sandvika",
  "lillestrøm", "lørenskog", "ski", "jessheim", "elverum", "horten", "grimstad", "steinkjer", "levanger", "narvik", "alta",
  "hammerfest", "førde", "sogndal", "voss", "stord", "leirvik", "mo i rana", "mosjøen", "namsos", "kirkenes", "vadsø",
  "svolvær", "ås", "kongsvinger", "hønefoss", "notodden", "egersund", "bryne", "florø", "ørsta", "volda", "raufoss",
  "nesodden", "nittedal", "askøy", "stockholm", "göteborg", "gothenburg", "malmö", "uppsala", "københavn", "copenhagen",
  "aarhus", "helsinki", "reykjavik", "london", "berlin", "amsterdam", "paris", "barcelona", "madrid", "lisboa", "lisbon",
  "dublin", "edinburgh", "manchester", "new york", "san francisco", "seattle", "toronto", "zürich", "zurich", "münchen",
  "munich", "wien", "vienna", "praha", "prague", "warszawa", "warsaw", "tallinn", "riga", "vilnius",
  // Fylker og land, så «Trondheim, Trøndelag, Norway» blir ett sted.
  "viken", "akershus", "buskerud", "østfold", "vestfold", "telemark", "innlandet", "oppland", "hedmark", "agder",
  "vest-agder", "aust-agder", "rogaland", "vestland", "hordaland", "sogn og fjordane", "møre og romsdal", "trøndelag",
  "nordland", "troms", "finnmark", "troms og finnmark", "norge", "norway", "sverige", "sweden", "danmark", "denmark",
  "finland", "island", "iceland", "tyskland", "germany", "storbritannia", "uk", "united kingdom", "england", "usa",
  "united states", "spania", "spain", "frankrike", "france", "nederland", "netherlands",
  "remote", "hybrid", "hjemmekontor", "fjernarbeid",
]);

// Kjente verktøy og teknologier. Brukes bare når CV-en ikke har en egen seksjon for ferdigheter.
const KNOWN_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "Kotlin", "Swift", "C#", "C++", "Rust", "Ruby", "PHP", "Scala", "Dart",
  "Elixir", "SQL", "HTML", "CSS", "Sass", "Tailwind", "React Native", "React", "Next.js", "Vue", "Nuxt", "Angular",
  "Svelte", "Node.js", "Deno", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring Boot", "Spring", ".NET",
  "Rails", "Laravel", "Flutter", "GraphQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka",
  "Docker", "Kubernetes", "Terraform", "AWS", "Azure", "GCP", "Google Cloud", "Firebase", "Supabase", "Linux", "Git",
  "GitHub Actions", "CI/CD", "Jest", "Playwright", "Cypress", "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
  "InDesign", "After Effects", "Premiere Pro", "Blender", "Unity", "Unreal Engine", "Power BI", "Tableau", "Jira",
  "Scrum", "Kanban", "TensorFlow", "PyTorch", "Pandas", "NumPy", "WordPress", "Webflow", "Framer", "Storybook",
];

/* -------------------------------------------------------------------------- */
/*  Datoer                                                                    */
/* -------------------------------------------------------------------------- */

const MONTH_NUMBER: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};
const MONTH =
  "(?:jan(?:uar|uary)?|feb(?:ruar|ruary)?|mar(?:s|ch)?|apr(?:il)?|mai|may|jun[ie]?|jul[iy]?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|des(?:ember)?|dec(?:ember)?)\\.?";
const SEASON = "(?:vår(?:en)?|sommer(?:en)?|høst(?:en)?|vinter(?:en)?|spring|summer|autumn|fall|winter)";
const YEAR = "(?:19[5-9]\\d|20\\d\\d)";
const ONE_DATE =
  `(?:(?:\\d{1,2}\\.?\\s+)?(?:${MONTH}|${SEASON})\\s*(?:of\\s+)?${YEAR}` +
  `|(?:\\d{1,2}[./])?(?:0?[1-9]|1[0-2])[./]\\s?${YEAR}` +
  `|${YEAR}[-./](?:0[1-9]|1[0-2])(?!\\d)` +
  `|${YEAR})`;
const ONGOING = "(?:nå|naa|d\\.\\s?d\\.?|dd|dags dato|i dag|pågående|fortsatt|present|current|now|today|ongoing)";
const B = "(?<![\\p{L}\\d])";
const E = "(?![\\p{L}\\d])";

const RANGE_RE = new RegExp(
  `${B}(?:(?:fra|from)\\s+)?(${ONE_DATE})\\s*(?:[-–—~/]+|til|to|until|→)\\s*(${ONE_DATE}|${ONGOING})${E}`,
  "iu",
);
const SINCE_RE = new RegExp(`${B}(?:siden|since|fra|from)\\s+(${ONE_DATE})${E}`, "iu");
const OPEN_RE = new RegExp(`${B}(${ONE_DATE})\\s*[-–—]+\\s*$`, "iu");
const SINGLE_RE = new RegExp(`${B}(${ONE_DATE})${E}`, "iu");
const ONGOING_RE = new RegExp(`^${ONGOING}$`, "iu");
const DURATION =
  /\(?\s*(?:\d+\+?\s*(?:år|years?|yrs?|mnd\.?|måneder|måned|months?|mos)\b(?:\s*(?:og|and|,)?\s*\d+\s*(?:mnd\.?|måneder|måned|months?|mos)\b)?|less than a year|under ett år)\s*\)?/giu;
const HAS_DURATION = new RegExp(DURATION.source, "iu");

function toDate(token: string) {
  const t = token.toLowerCase();
  const year = /(19[5-9]\d|20\d\d)/.exec(t)?.[1];
  if (!year) return null;
  const name = /(jan|feb|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|des|dec)/.exec(t)?.[1];
  const month =
    (name && MONTH_NUMBER[name]) ||
    Number(/(?:^|[./\s])(\d{1,2})[./]\s?\d{4}$/.exec(t)?.[1] ?? /^\d{4}[-./](\d{2})$/.exec(t)?.[1] ?? 0);
  return month >= 1 && month <= 12 ? `${year}-${String(month).padStart(2, "0")}` : year;
}

type Dated = { start: string | null; end: string | null; rest: string };

const tidy = (s: string) =>
  s
    .replace(DURATION, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/^[\s·•|,:;()–—-]+|[\s·•|,:;(–—-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

// Finner en periode i linjen («aug. 2021 – nå», «01/2019 - 07/2021», «Sommer 2018»).
function findDates(text: string, allowSingle: boolean): Dated | null {
  const flat = text.replace(/\t/g, "  ");
  const cut = (m: RegExpExecArray) => tidy(`${flat.slice(0, m.index)}  ${flat.slice(m.index + m[0].length)}`);

  const range = RANGE_RE.exec(flat);
  if (range) {
    const ongoing = ONGOING_RE.test(range[2].trim());
    return { start: toDate(range[1]), end: ongoing ? null : toDate(range[2]), rest: cut(range) };
  }
  const open = SINCE_RE.exec(flat) ?? OPEN_RE.exec(flat);
  if (open) return { start: toDate(open[1]), end: null, rest: cut(open) };

  const m = allowSingle ? SINGLE_RE.exec(flat) : null;
  if (!m) return null;

  // Et enkelt årstall teller bare når det står først eller sist i en kort linje,
  // så «Vant prisen i 2019» ikke blir en ny oppføring.
  const before = tidy(flat.slice(0, m.index));
  const after = tidy(flat.slice(m.index + m[0].length));
  const rest = cut(m);
  if (before && after) return null;
  if (words(rest) > 6 || /\b(?:i|in|på|on|fra|til|from|to|år|year|since|siden|of|av|før|etter)$/i.test(before)) return null;
  const date = toDate(m[1]);
  return { start: date, end: date, rest };
}

/* -------------------------------------------------------------------------- */
/*  Små hjelpere                                                              */
/* -------------------------------------------------------------------------- */

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const lower = (s: string) => s.toLocaleLowerCase("nb");
const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase("nb") + s.slice(1) : s);
const hasAny = (text: string, parts: string[]) => {
  const t = lower(text);
  return parts.some((p) => t.includes(p));
};

const isRole = (s: string) => hasAny(s, ROLE_PARTS) || ROLE_WORDS.test(s);
const isOrg = (s: string) => ORG_SUFFIX.test(s.trim()) || hasAny(s, ORG_PARTS) || ORG_NAMES.test(s);
const isInstitution = (s: string) => hasAny(s, INSTITUTION_PARTS) || INSTITUTION_NAMES.test(s);
const isDegree = (s: string) => DEGREE.test(s);

function isPlace(part: string) {
  const t = lower(part)
    .replace(/^\d{4}\s+/, "")
    .replace(/^(?:greater|stor-)\s*/, "")
    .replace(/(?:-området|\s+area|\s+region|\s+og omegn)$/, "")
    .trim();
  return CITIES.has(t);
}

// «Trondheim, Trøndelag, Norway» eller «Oslo» – hele teksten er et sted.
const isLocation = (text: string) => {
  const parts = text.split(/\s*,\s*/).filter(Boolean);
  return parts.length > 0 && parts.length <= 4 && parts.every(isPlace);
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,}/;
const isContact = (s: string) => /@/.test(s) || PHONE.test(s) || /https?:\/\/|www\.|\.(?:com|no|dev|io|net|org|me)\b/i.test(s);

const NOISE = /^(?:curriculum vitae|cv|resume|résumé|resumé|side \d+(?: av \d+)?|page \d+(?: of \d+)?|\d{1,2}(?:\s*(?:\/|av|of)\s*\d{1,2})?)$/i;

// Deler en tekst på skilletegn, men ikke inne i parenteser: «Språk (norsk, engelsk)».
function splitOutside(text: string, separator: RegExp) {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (depth === 0) {
      const m = separator.exec(text.slice(i));
      if (m && m.index === 0) {
        out.push(text.slice(start, i));
        i += m[0].length - 1;
        start = i + 1;
      }
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

const STRONG_SEP = /^(?:\s*\t\s*|\s+[|·•]\s+|\s+[–—]\s+|\s+-\s+)/;
const COMMA_SEP = /^,\s*/;

// «Produktdesigner, Bekk Consulting AS, Oslo» → ["Produktdesigner", "Bekk Consulting AS", "Oslo"].
// Steder som står etter hverandre slås sammen igjen: «Trondheim, Norway».
function headerParts(text: string) {
  const parts = splitOutside(text, STRONG_SEP).flatMap((chunk) => splitOutside(chunk, COMMA_SEP));
  const out: string[] = [];
  for (const part of parts) {
    const prev = out.at(-1);
    if (prev && isLocation(prev) && isPlace(part)) out[out.length - 1] = `${prev}, ${part}`;
    else out.push(part);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Linjer og overskrifter                                                    */
/* -------------------------------------------------------------------------- */

const MARKER = /^(?:[•●▪■◦‣∙·○◆◇▸►▶✓✔➢➤→*]|[-–—](?=\s))\s*/u;

function normalize(input: CvLine[]): Line[] {
  const out: Line[] = [];
  for (const raw of input) {
    for (const piece of raw.text.split(/\r?\n/)) {
      let text = piece
        .replace(/[   ]/g, " ")
        .replace(/[​-‍﻿­]/g, "")
        .replace(/[ \f\v]+/g, " ")
        .replace(/\s*\t[\s\t]*/g, "\t")
        .trim();
      // «E R F A R I N G» → «ERFARING»
      if (/^(?:\p{L} ){3,}\p{L}$/u.test(text)) text = text.replace(/ /g, "");
      const marker = MARKER.test(text);
      if (marker) text = text.replace(MARKER, "").trim();
      if (!text || NOISE.test(text)) continue;
      out.push({ text, size: raw.size ?? 0, indent: Boolean(raw.indent), marker, page: raw.page ?? 0, column: raw.column ?? 0 });
    }
  }
  return out;
}

// Vanlig skriftstørrelse i dokumentet: medianen, vektet etter tekstmengde.
function bodySize(lines: Line[]) {
  const sized = lines.filter((l) => l.size > 0).map((l) => ({ size: l.size, weight: l.text.length }));
  if (sized.length === 0) return 0;
  sized.sort((a, b) => a.size - b.size);
  const half = sized.reduce((s, x) => s + x.weight, 0) / 2;
  let acc = 0;
  for (const x of sized) {
    acc += x.weight;
    if (acc >= half) return x.size;
  }
  return sized.at(-1)!.size;
}

const headingKey = (text: string) =>
  lower(text)
    .replace(/[:：.]+$/, "")
    .replace(/\s*&\s*|\s+and\s+/g, " og ")
    .replace(/\s+/g, " ")
    .trim();

function headingKind(line: Line, body: number, current?: Kind | "header"): { kind: Kind; rest: string } | null {
  const text = line.text.replace(/\t/g, " ").trim();
  const exact = HEADING_LOOKUP.get(headingKey(text));
  if (exact) return { kind: exact, rest: "" };

  // «Ferdigheter: React, TypeScript». Inne i ferdigheter er «Språk: C#, Java» en kategori, ikke en ny seksjon.
  const inline = /^([^:]{2,40}):\s*(.+)$/.exec(text);
  if (inline) {
    const kind = HEADING_LOOKUP.get(headingKey(inline[1]));
    if (kind && !(current === "skills" && (kind === "skills" || kind === "other"))) return { kind, rest: inline[2] };
  }

  if (words(text) > 4 || text.length > 40 || /\d/.test(text)) return null;
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upper = letters.length >= 3 && letters === letters.toLocaleUpperCase("nb");
  const bigger = body > 0 && line.size >= body + 1;
  if (!upper && !bigger && !text.endsWith(":")) return null;

  if (ORG_SUFFIX.test(text)) return null;
  const key = headingKey(text);
  const titleLike = isRole(text) || isOrg(text);
  for (const [kind, stems] of HEADING_STEMS) {
    if (!stems.some((s) => key.includes(s))) continue;
    // «PROSJEKTLEDER» er en rolle, ikke en overskrift om prosjekter.
    return kind === "other" && titleLike ? null : { kind, rest: "" };
  }
  // En tydelig overskrift vi ikke kjenner (større skrift og store bokstaver): hopp over innholdet.
  return upper && !titleLike && body > 0 && line.size >= body * 1.15 ? { kind: "other", rest: "" } : null;
}

const NAME_WORD = /^(?:\p{Lu}[\p{L}'’.-]*|van|von|de|der|den|da|di|la|le|af|du|bin|el|al)$/u;

function looksLikeName(text: string) {
  if (text.length > 50 || /[\d@/:|\t]/.test(text)) return false;
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2 || parts.length > 5 || !parts.every((w) => NAME_WORD.test(w))) return false;
  return !HEADING_LOOKUP.has(headingKey(text)) && !isRole(text) && !isOrg(text) && !isLocation(text);
}

const titleCase = (text: string) =>
  text === text.toLocaleUpperCase("nb")
    ? text.toLocaleLowerCase("nb").replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase("nb"))
    : text;

function findName(lines: Line[], body: number) {
  if (body > 0) {
    let best = -1;
    lines.forEach((l, i) => {
      if (l.size >= body * 1.25 && looksLikeName(l.text) && (best < 0 || l.size > lines[best].size)) best = i;
    });
    if (best >= 0) return best;
  }
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (looksLikeName(lines[i].text)) return i;
  }
  return -1;
}

/* -------------------------------------------------------------------------- */
/*  Kontaktinfo: lenker og bosted                                             */
/* -------------------------------------------------------------------------- */

const KNOWN_SITES: [RegExp, string][] = [
  [/linkedin\.com/i, "LinkedIn"],
  [/github\.com/i, "GitHub"],
  [/gitlab\.com/i, "GitLab"],
  [/behance\.net/i, "Behance"],
  [/dribbble\.com/i, "Dribbble"],
  [/medium\.com/i, "Medium"],
  [/stackoverflow\.com/i, "Stack Overflow"],
  [/(?:twitter|x)\.com/i, "X"],
  [/figma\.com/i, "Figma"],
  [/youtube\.com/i, "YouTube"],
  [/instagram\.com/i, "Instagram"],
];
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s,;|·•()<>"]*)?/gi;
const SITE_TLDS = /\.(?:no|com|dev|io|me|net|org|app|design|studio|page|site|xyz|se|dk|art|co|tech|portfolio)(?:\/|$)/i;
const NOT_LINKS = /^(?:node\.js|next\.js|vue\.js|nuxt\.js|three\.js|d3\.js|express\.js|socket\.io|asp\.net|ado\.net|vb\.net)$/i;

function findLinks(lines: Line[], contactish: Set<Line>) {
  const out: { label: string; url: string }[] = [];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    let text = line.text.replace(EMAIL, " ");
    // «www.linkedin.com/in/kari-» + «nordmann-123 (LinkedIn)» på neste linje.
    const next = lines[i + 1]?.text;
    if (next && /\.[a-z]{2,}\/\S*[-/_]$/i.test(text)) text += /^[\w%.-][\w%./-]*/.exec(next)?.[0] ?? "";
    for (const m of text.matchAll(URL_RE)) {
      const raw = m[0].replace(/[.)]+$/, "");
      const site = KNOWN_SITES.find(([re]) => re.test(raw));
      const explicit = /^https?:\/\/|^www\./i.test(raw);
      // Domener uten «www.» godtas bare i kontaktfeltet, så «Vue.js» ikke blir en lenke.
      if (NOT_LINKS.test(raw)) continue;
      if (!site && !explicit && !(contactish.has(line) && SITE_TLDS.test(raw))) continue;
      if (site && !/\.[a-z]{2,}\/./i.test(raw) && !explicit) continue; // «github.com» uten brukernavn
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const key = lower(url).replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label: site?.[1] ?? "Nettside", url });
    }
  });
  return out;
}

const dedupePlaces = (text: string) =>
  [...new Map(text.split(/\s*,\s*/).map((p) => [lower(p), p])).values()].join(", ");

function findLocation(lines: Line[]) {
  const found = findPlace(lines);
  return found ? dedupePlaces(found) : null;
}

function findPlace(lines: Line[]) {
  for (const line of lines) {
    const text = line.text.replace(/^(?:bosted|adresse|address|location|sted)\s*:\s*/i, "");
    for (const part of splitOutside(text, /^(?:\s*\t\s*|\s+[|·•–—]\s+|\s+-\s+|\s*;\s*)/)) {
      if (isLocation(part)) return part;
      const postal = /\b\d{4}\s+(\p{Lu}[\p{L}-]+(?:\s+\p{Lu}[\p{L}-]+)?)\b/u.exec(part);
      if (postal && isPlace(postal[1])) return postal[1];
      const first = part.split(/\s*,\s*/);
      if (first.length > 1 && isPlace(first[0]) && first.slice(1).every(isPlace)) return part;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Oppføringer (erfaring og utdanning)                                       */
/* -------------------------------------------------------------------------- */

type Entry = { header: string[]; start: string | null; end: string | null; location: string | null; description: Line[] };

const isDuration = (text: string) => HAS_DURATION.test(text) && !tidy(text);

type EntryKind = "experience" | "education";

function partCount(header: string[]) {
  return header.reduce((n, h) => n + (/\s(?:hos|at|@|ved)\s/i.test(h) ? 2 : headerParts(h).length), 0);
}

// Trenger overskriften en linje til? Ja hvis den bare har én del, eller hvis den mangler
// arbeidsgiver/skole og linjen ved siden av ser ut som nettopp det (LinkedIn setter skolen
// på en egen linje over graden).
function wantsMore(header: string[], candidate: string, kind: EntryKind) {
  if (header.length >= 3) return false;
  if (partCount(header) < 2) return true;
  const parts = header.flatMap((h) => headerParts(h));
  const next = headerParts(candidate);
  if (kind === "education") return !parts.some(isInstitution) && next.some(isInstitution);
  return !parts.some(isOrg) && next.every((p) => isOrg(p) && !isRole(p));
}

function splitEntries(lines: Line[], kind: EntryKind): Entry[] {
  const dated = lines.map((l) => (l.marker && words(l.text) > 10 ? null : findDates(l.text, !l.marker && !l.indent)));
  const noise = lines.map((l, i) => !dated[i] && isDuration(l.text));
  const headerLike = (i: number) => {
    const l = lines[i];
    const t = l.text;
    if (l.marker || l.indent || dated[i] || noise[i] || isLocation(t)) return false;
    if (words(t) > 12 || t.length > 110) return false;
    return !/[.!?]$/.test(t) || words(t) <= 4;
  };

  const anchors = dated.flatMap((d, i) => (d ? [i] : []));
  if (anchors.length === 0) return fallbackEntries(lines, headerLike, kind);

  // Står overskriften (rolle/skole) før eller etter datoen? Den første oppføringen avgjør.
  let headerFirst = false;
  for (let i = anchors[0] - 1; i >= 0; i--) {
    if (noise[i]) continue;
    headerFirst = headerLike(i);
    break;
  }

  const used = new Set<number>();
  const drafts = anchors.map((a, k) => {
    const d = dated[a]!;
    const entry: Entry = { header: [], start: d.start, end: d.end, location: null, description: [] };
    if (d.rest && isLocation(d.rest)) entry.location = d.rest;
    else if (d.rest && /\p{L}{2}/u.test(d.rest)) entry.header.push(d.rest);

    let first = a;
    if (headerFirst) {
      const floor = k > 0 ? anchors[k - 1] + 1 : 0;
      for (let i = a - 1; i >= floor; i--) {
        if (noise[i]) continue;
        if (!headerLike(i) || used.has(i) || !wantsMore(entry.header, lines[i].text, kind)) break;
        entry.header.unshift(lines[i].text);
        used.add(i);
        first = i;
      }
    } else {
      const ceil = k + 1 < anchors.length ? anchors[k + 1] : lines.length;
      for (let i = a + 1; i < ceil; i++) {
        if (noise[i]) continue;
        if (!headerLike(i) || !wantsMore(entry.header, lines[i].text, kind)) break;
        entry.header.push(lines[i].text);
        used.add(i);
      }
    }
    used.add(a);
    return { entry, first };
  });

  // Alt mellom én oppføring og den neste er beskrivelse (eller sted).
  drafts.forEach(({ entry, first }, k) => {
    const end = k + 1 < drafts.length ? drafts[k + 1].first : lines.length;
    const begin = headerFirst ? first : anchors[k];
    for (let i = begin; i < end; i++) {
      if (used.has(i) || noise[i]) continue;
      if (!entry.location && isLocation(lines[i].text)) entry.location = lines[i].text;
      else entry.description.push(lines[i]);
    }
  });
  return drafts.map((d) => d.entry);
}

// Ingen datoer å henge oppføringene på: korte linjer etter brødtekst starter en ny oppføring.
function fallbackEntries(lines: Line[], headerLike: (i: number) => boolean, kind: EntryKind): Entry[] {
  const out: Entry[] = [];
  let inHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const current = out.at(-1);
    if (headerLike(i)) {
      if (inHeader && current && current.header.length < 2) {
        current.header.push(line.text);
        continue;
      }
      if (!inHeader) {
        out.push({ header: [line.text], start: null, end: null, location: null, description: [] });
        inHeader = true;
        continue;
      }
    }
    inHeader = false;
    if (!current) continue;
    if (!current.location && isLocation(line.text)) current.location = line.text;
    else current.description.push(line);
  }
  // Uten datoer er det lett å ta feil, så bare oppføringer med en kjent rolle, arbeidsgiver,
  // skole eller grad tas med.
  const known = kind === "education" ? (p: string) => isInstitution(p) || isDegree(p) : (p: string) => isRole(p) || isOrg(p);
  return out.filter((e) => e.header.some((h) => headerParts(h).some(known)));
}

// Linjer som bare er en fortsettelse av forrige linje (brutt tekst) slås sammen.
function joinWrapped(lines: Line[]) {
  const out: string[] = [];
  for (const line of lines) {
    const text = line.text.replace(/\t+/g, " ");
    const prev = out.at(-1);
    const continues = prev && !line.marker && (/^[\p{Ll}(]/u.test(text) || /(?:[,-]|\bog|\band)$/u.test(prev));
    if (prev && continues) {
      out[out.length - 1] = prev.endsWith("-") && /^\p{Ll}/u.test(text) ? prev.slice(0, -1) + text : `${prev} ${text}`;
    } else {
      out.push(text);
    }
  }
  return out;
}

function experienceFrom(entry: Entry, orgFirst: boolean, previous: ParsedCv["experience"][number] | undefined) {
  let title: string | null = null;
  let organization: string | null = null;
  let location = entry.location;
  const loose: string[] = [];

  for (const line of entry.header) {
    const hos = /^(.+?)\s+(?:hos|at|@)\s+(.+)$/i.exec(line.replace(/\t/g, " "));
    if (hos && !title && !organization) {
      title = hos[1].trim();
      const [org, ...rest] = headerParts(hos[2]);
      organization = org ?? null;
      location ??= rest.find(isLocation) ?? null;
      continue;
    }
    for (const part of headerParts(line)) {
      if (isLocation(part)) location ??= part;
      else if (!organization && isOrg(part) && !(isRole(part) && !ORG_SUFFIX.test(part))) organization = part;
      else if (!title && isRole(part)) title = part;
      else loose.push(part);
    }
  }
  for (const part of loose) {
    if (orgFirst ? !organization : title) organization ??= part;
    else title ??= part;
  }
  // LinkedIn lister flere roller under samme arbeidsgiver uten å gjenta navnet.
  if (title && !organization && previous?.organization && isRole(title)) organization = previous.organization;

  return {
    title: title ?? "",
    organization: organization ?? "",
    location,
    startDate: entry.start,
    endDate: entry.end,
    description: joinWrapped(entry.description).join("\n") || null,
  };
}

function splitDegree(text: string) {
  const m = /^(.+?)\s+(?:i|in|innen|innenfor)\s+(.+)$/i.exec(text);
  if (m && isDegree(m[1])) return { degree: m[1].trim(), field: capitalize(m[2].trim()) };
  return { degree: text, field: null };
}

function educationFrom(entry: Entry) {
  let institution: string | null = null;
  let degree: string | null = null;
  let field: string | null = null;
  const loose: string[] = [];

  for (const line of entry.header) {
    const ved = /^(.+?)\s+(?:ved|at|fra|from)\s+(.+)$/i.exec(line.replace(/\t/g, " "));
    if (ved && isDegree(ved[1]) && !degree && !institution) {
      ({ degree, field } = splitDegree(ved[1].trim()));
      institution = headerParts(ved[2]).find((p) => !isLocation(p)) ?? null;
      continue;
    }
    for (const part of headerParts(line)) {
      if (isLocation(part)) continue;
      if (!institution && isInstitution(part) && !isDegree(part)) institution = part;
      else if (isDegree(part)) {
        if (!degree) ({ degree, field } = splitDegree(part));
      } else loose.push(part);
    }
  }
  for (const part of loose) {
    if (!institution) institution = part;
    else if (!field) field = capitalize(part);
  }

  return {
    institution: institution ?? "",
    degree,
    fieldOfStudy: field,
    startDate: entry.start,
    endDate: entry.end,
    description: joinWrapped(entry.description).join("\n") || null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Ferdigheter                                                               */
/* -------------------------------------------------------------------------- */

function skillsFrom(lines: Line[]) {
  const out: string[] = [];
  for (const line of lines) {
    let text = line.text;
    const category = /^([^:]{2,40}):\s*(.+)$/.exec(text);
    if (category) text = category[2];
    for (let part of splitOutside(text, /^(?:\s*[,;•·|\t]\s*|\s+[–—-]\s+|\s+\/\s+)/)) {
      part = part.replace(/[★☆●○◉◎]+/g, "").replace(/\.+$/, "").trim();
      if (part && words(part) <= 4 && part.length <= 60 && /\p{L}/u.test(part)) out.push(part);
    }
  }
  return out;
}

function knownSkills(text: string) {
  return KNOWN_SKILLS.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\d.#+])${escaped}(?![\\p{L}\\d#+]|\\.\\p{L})`, "u").test(text);
  });
}

/* -------------------------------------------------------------------------- */
/*  Opprydding                                                                */
/* -------------------------------------------------------------------------- */

const YEAR_MONTH = /^\d{4}(-(0[1-9]|1[0-2]))?$/;

// Ugyldige datoer blir null, tomme oppføringer og duplikater fjernes, og alt kuttes
// til lengdene skjemaet godtar.
export function cleanParsedCv(cv: ParsedCv): ParsedCv {
  const date = (v: string | null) => (v && YEAR_MONTH.test(v.trim()) ? v.trim() : null);
  const text = (v: string | null, max: number) => v?.trim().slice(0, max) || null;
  const seenSkills = new Set<string>();

  return {
    name: text(cv.name, 120),
    headline: text(cv.headline, 120),
    summary: text(cv.summary, 2000),
    location: text(cv.location, 100),
    links: cv.links
      .map((l) => ({ label: l.label.trim().slice(0, 40), url: l.url.trim() }))
      .map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` }))
      .filter((l) => l.label && URL.canParse(l.url))
      .slice(0, 10),
    // Oppføringer der bare rollen eller arbeidsgiveren ble funnet beholdes, så brukeren kan fylle ut resten.
    experience: cv.experience
      .filter((e) => e.title.trim() || e.organization.trim())
      .map((e) => ({
        title: e.title.trim().slice(0, 150),
        organization: e.organization.trim().slice(0, 150),
        location: text(e.location, 100),
        startDate: date(e.startDate),
        endDate: date(e.endDate),
        description: text(e.description, 3000),
      }))
      .slice(0, 50),
    education: cv.education
      .filter((e) => e.institution.trim() || e.degree?.trim())
      .map((e) => ({
        institution: e.institution.trim().slice(0, 150),
        degree: text(e.degree, 150),
        fieldOfStudy: text(e.fieldOfStudy, 150),
        startDate: date(e.startDate),
        endDate: date(e.endDate),
        description: text(e.description, 3000),
      }))
      .slice(0, 30),
    skills: cv.skills
      .map((s) => s.trim())
      .filter((s) => {
        const key = lower(s);
        if (!s || s.length > 60 || seenSkills.has(key)) return false;
        seenSkills.add(key);
        return true;
      })
      .slice(0, 40),
  };
}

/* -------------------------------------------------------------------------- */
/*  Hele CV-en                                                                */
/* -------------------------------------------------------------------------- */

type Section = { kind: Kind | "header"; lines: Line[] };

export function parseCvLines(input: CvLine[]): ParsedCv {
  const lines = normalize(input);
  const body = bodySize(lines);
  const orgFirst = lines.some((l) => /^(?:top skills|toppferdigheter|topp-ferdigheter)$/i.test(l.text));

  // Navn og tittel øverst.
  const nameIndex = findName(lines, body);
  let headlineIndex = -1;
  let headline: string | null = null;
  if (nameIndex >= 0) {
    for (let i = nameIndex + 1; i < Math.min(lines.length, nameIndex + 3); i++) {
      const line = lines[i];
      if (headingKind(line, body) || findDates(line.text, false)) break;
      const parts = headerParts(line.text);
      const part = parts.find((p) => !isContact(p) && !isLocation(p));
      if (part && words(part) <= 14 && part.length <= 120 && !/^\d/.test(part)) {
        // «Produktdesigner · Bergen · e-post» gir «Produktdesigner»; «Utvikler hos Vipps | React» beholdes hel.
        const rest = parts.filter((p) => p !== part);
        const contactOnly = rest.length > 0 && rest.every((p) => isContact(p) || isLocation(p));
        headline = contactOnly || line.text.length > 120 ? part : line.text.replace(/\t+/g, " · ");
        headlineIndex = i;
        break;
      }
      if (!isContact(line.text) && !isLocation(line.text)) break;
    }
  }

  // Seksjoner. Hver spalte har sine egne seksjoner, så sidespalten ikke blander seg med
  // hovedspalten. På neste side fortsetter hver spalte der den slapp.
  const sections: Section[] = [];
  const byColumn = new Map<number, Section>();
  let current: Section = { kind: "header", lines: [] };
  let place = "";
  lines.forEach((line, i) => {
    if (`${line.page}:${line.column}` !== place) {
      place = `${line.page}:${line.column}`;
      const previous = line.column >= 0 ? byColumn.get(line.column) : undefined;
      current = previous ?? { kind: "header", lines: [] };
      if (!previous) sections.push(current);
    }
    if (i === nameIndex || i === headlineIndex) return;
    const heading = headingKind(line, body, current.kind);
    if (heading) {
      current = { kind: heading.kind, lines: heading.rest ? [{ ...line, text: heading.rest }] : [] };
      sections.push(current);
    } else {
      current.lines.push(line);
    }
    byColumn.set(line.column, current);
  });
  const sectionsOf = (kind: Section["kind"]) => sections.filter((s) => s.kind === kind);
  const of = (kind: Section["kind"]) => sectionsOf(kind).flatMap((s) => s.lines);

  const headerLines = of("header");
  const contactLines = [...headerLines, ...of("contact")];
  if (headlineIndex >= 0) contactLines.unshift(lines[headlineIndex]);
  if (nameIndex >= 0) contactLines.unshift(lines[nameIndex]);
  const contactSet = new Set(contactLines);

  // Sammendrag: egen seksjon, ellers lange setninger i toppfeltet.
  let summaryLines = of("summary");
  if (summaryLines.length === 0) summaryLines = headerLines.filter((l) => words(l.text) >= 12 && !isContact(l.text));
  const summary = joinWrapped(summaryLines).join(" ") || null;

  const experience: ParsedCv["experience"] = [];
  for (const section of sectionsOf("experience")) {
    for (const entry of splitEntries(section.lines, "experience")) experience.push(experienceFrom(entry, orgFirst, experience.at(-1)));
  }
  const education = sectionsOf("education")
    .flatMap((section) => splitEntries(section.lines, "education"))
    .map(educationFrom);

  let skills = skillsFrom(of("skills"));
  if (skills.length === 0) skills = knownSkills(lines.map((l) => l.text).join("\n"));

  const nameLine = nameIndex >= 0 ? lines[nameIndex].text : null;

  return cleanParsedCv({
    name: nameLine ? titleCase(nameLine) : null,
    headline,
    summary,
    location: findLocation(contactLines),
    links: findLinks(lines, contactSet),
    experience,
    education,
    skills,
  });
}

export function parseCvText(text: string) {
  return parseCvLines(text.split(/\r?\n/).map((t) => ({ text: t })));
}
