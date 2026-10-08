// Faste valg som brukes både i databasen, på serveren og i nettleseren.
// (Ligger her og ikke i db/schema.ts, så klientkomponenter slipper å laste inn Drizzle.)

export const OPEN_TO = ["jobb", "sommerjobb", "freelance", "samarbeid", "mentor", "prat"] as const;
export type OpenTo = (typeof OPEN_TO)[number];
export const OPEN_TO_LABELS: Record<OpenTo, string> = {
  jobb: "Nye muligheter",
  sommerjobb: "Sommerjobb eller internship",
  freelance: "Frilansoppdrag",
  samarbeid: "Samarbeid",
  mentor: "Mentoring",
  prat: "En kaffeprat",
};

export const REACTION_TYPES = ["like", "useful", "inspiring"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export const REACTION_LABELS: Record<ReactionType, string> = {
  like: "Lik",
  useful: "Nyttig",
  inspiring: "Inspirerende",
};

// Om et prosjekt er ferdig eller fortsatt under arbeid.
export const PROJECT_PROGRESS = ["completed", "in_progress"] as const;
export type ProjectProgress = (typeof PROJECT_PROGRESS)[number];
export const PROGRESS_LABELS: Record<ProjectProgress, string> = {
  completed: "Fullført",
  in_progress: "Under arbeid",
};

// Andre enn eieren som kan stå oppført på et prosjekt.
export const MAX_PROJECT_MEMBERS = 20;

export const REPORT_REASONS = ["spam", "offensive", "harassment", "copyright", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam eller reklame",
  offensive: "Støtende eller upassende innhold",
  harassment: "Trakassering eller hets",
  copyright: "Brudd på opphavsrett",
  impersonation: "Utgir seg for å være noen andre",
  other: "Noe annet",
};

export const CV_TEMPLATES = ["klassisk", "moderne", "kompakt", "elegant", "tydelig"] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];
export const CV_TEMPLATE_LABELS: Record<CvTemplate, { name: string; description: string; pro?: boolean }> = {
  klassisk: { name: "Klassisk", description: "Én kolonne, rolig og tidløs." },
  moderne: { name: "Moderne", description: "Sidekolonne med kontakt og ferdigheter." },
  kompakt: { name: "Kompakt", description: "Tett og kort, får plass til mye på én side." },
  elegant: { name: "Elegant", description: "Klassisk typografi med serif, sentrert topp.", pro: true },
  tydelig: { name: "Tydelig", description: "Fargebånd øverst og to kolonner. Skiller seg ut.", pro: true },
};
export const isProTemplate = (t: CvTemplate) => Boolean(CV_TEMPLATE_LABELS[t].pro);

// Aksentfarger en profil kan velge. `ink` er fargen tekst på aksenten skal ha.
export const ACCENTS = {
  is: { label: "Is", color: "#c7f9ff", ink: "#071a52" },
  fjord: { label: "Fjord", color: "#5eb8d4", ink: "#04202c" },
  mose: { label: "Mose", color: "#9fe0a8", ink: "#0c2a12" },
  nordlys: { label: "Nordlys", color: "#b9a6ff", ink: "#1b1242" },
  molte: { label: "Molte", color: "#ffc27a", ink: "#3a2104" },
  rose: { label: "Rose", color: "#ff9fb5", ink: "#3d0d19" },
} as const;
export type AccentKey = keyof typeof ACCENTS;
export const ACCENT_KEYS = Object.keys(ACCENTS) as [AccentKey, ...AccentKey[]];

// «Kontakt meg»: hva henvendelsen gjelder. Samme verdier som contact_reason i databasen.
export const CONTACT_REASONS = ["jobb", "oppdrag", "samarbeid", "annet"] as const;
export type ContactReason = (typeof CONTACT_REASONS)[number];
export const CONTACT_REASON_LABELS: Record<ContactReason, string> = {
  jobb: "Jobb",
  oppdrag: "Oppdrag",
  samarbeid: "Samarbeid",
  annet: "Noe annet",
};

// Fagfelt i søket. Treffer rollen på prosjektet, teknologiene og tittelen på profilen.
export const FIELDS = {
  design: { label: "Design", words: ["design", "ux", "ui", "grafisk", "illustr", "figma"] },
  frontend: { label: "Frontend", words: ["frontend", "front-end", "react", "vue", "svelte", "css"] },
  backend: { label: "Backend", words: ["backend", "back-end", "api", "server", "database", "postgres"] },
  fullstack: { label: "Fullstack", words: ["fullstack", "full-stack", "nextjs"] },
  mobil: { label: "Mobil", words: ["mobil", "ios", "android", "swift", "kotlin", "react-native", "flutter"] },
  data: { label: "Data og KI", words: ["data", "ml", "maskinlæring", "machine-learning", "ai", "ki", "python", "analyse"] },
  spill: { label: "Spill", words: ["spill", "game", "unity", "unreal", "godot"] },
} as const;
export type FieldKey = keyof typeof FIELDS;
export const FIELD_KEYS = Object.keys(FIELDS) as FieldKey[];

export const PERIODS = { uke: { label: "Siste uke", days: 7 }, maned: { label: "Siste måned", days: 31 }, ar: { label: "Siste år", days: 366 } } as const;
export type PeriodKey = keyof typeof PERIODS;

// Stillinger. Samme nøkler som i lib/jobs.ts.
export const JOB_TYPE_LABELS = { fulltid: "Fulltid", deltid: "Deltid", internship: "Internship", sommerjobb: "Sommerjobb", trainee: "Trainee", frilans: "Frilans" } as const;
export const REMOTE_LABELS = { nei: "På kontoret", hybrid: "Hybrid", helt: "Helt hjemmefra" } as const;

// Søknader med Vis-profilen. Kolonnene i søkeroversikten, i rekkefølge.
export const APPLICATION_STAGES = ["ny", "intervju", "tilbud", "avslag"] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
export type ApplicationStatus = ApplicationStage | "trukket";
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  ny: "Ny",
  intervju: "Intervju",
  tilbud: "Tilbud",
  avslag: "Avslag",
  trukket: "Trukket",
};
// Hvordan man søker på en stilling.
export const APPLY_MODES = ["vis", "ekstern"] as const;
export type ApplyMode = (typeof APPLY_MODES)[number];
