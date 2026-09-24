// Faste valg som brukes både i databasen, på serveren og i nettleseren.
// (Ligger her og ikke i db/schema.ts, så klientkomponenter slipper å laste inn Drizzle.)

export const OPEN_TO = ["jobb", "freelance", "samarbeid", "mentor", "prat"] as const;
export type OpenTo = (typeof OPEN_TO)[number];
export const OPEN_TO_LABELS: Record<OpenTo, string> = {
  jobb: "Ny jobb",
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

export const CV_TEMPLATES = ["klassisk", "moderne", "kompakt"] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];
export const CV_TEMPLATE_LABELS: Record<CvTemplate, { name: string; description: string }> = {
  klassisk: { name: "Klassisk", description: "Én kolonne, rolig og tidløs." },
  moderne: { name: "Moderne", description: "Sidekolonne med kontakt og ferdigheter." },
  kompakt: { name: "Kompakt", description: "Tett og kort, får plass til mye på én side." },
};

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
