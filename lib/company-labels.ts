import type { CompanyRole } from "@/lib/company-permissions";

// Etiketter og lister for bedriftsdelen. Trygge å bruke i nettleseren (ingen database).
// Tekstene er norske og oversettes med t() der de vises (tests/i18n.test.ts sjekker dem).

export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–1000", "1000+"] as const;

/* -------------------------------------------------------------------------- */
/*  Roller og invitasjoner                                                    */
/* -------------------------------------------------------------------------- */

export const ROLE_LABEL: Record<CompanyRole, string> = {
  owner: "Eier",
  admin: "Administrator",
  member: "Rekrutterer",
  reviewer: "Vurderer",
};

// «Dette får du tilgang til»: fire punkter per rolle, i samme rekkefølge som matrisen
// (lib/company-permissions.ts). ok: false vises med strek (det rollen ikke kan).
export const ROLE_ACCESS: Record<CompanyRole, readonly { label: string; ok: boolean }[]> = {
  owner: [
    { label: "Alt en administrator kan", ok: true },
    { label: "Krev tofaktor for hele bedriften", ok: true },
    { label: "Gi administratortilgang og overføre eierskapet", ok: true },
    { label: "Slette bedriften", ok: true },
  ],
  admin: [
    { label: "Bedriftsprofil, personvern og abonnement", ok: true },
    { label: "Invitere og fjerne rekrutterere og vurderere", ok: true },
    { label: "Aktivitetslogg, eksport og webhooks", ok: true },
    { label: "Gi administratortilgang eller slette bedriften", ok: false },
  ],
  member: [
    { label: "Publisere stillinger og flytte søkere", ok: true },
    { label: "Se kontaktinfo og svare kandidater", ok: true },
    { label: "Kandidatsøk, lister og lagrede søk", ok: true },
    { label: "Invitere andre eller endre bedriftsprofilen", ok: false },
  ],
  reviewer: [
    { label: "Se søkere og stillinger", ok: true },
    { label: "Skrive notater og vurderingskort", ok: true },
    { label: "Se kontaktinfo eller sende meldinger", ok: false },
    { label: "Kandidatsøk og lister", ok: false },
  ],
};

export type InviteStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";
export type InviteKind = "member" | "employee" | "owner";

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  pending: "Venter",
  accepted: "Godtatt",
  declined: "Avslått",
  revoked: "Trukket tilbake",
  expired: "Utløpt",
};

export const INVITE_KIND_LABELS: Record<InviteKind, string> = {
  member: "Tilgang til admin",
  employee: "Synlig i teamet",
  owner: "Eierskap",
};

/* -------------------------------------------------------------------------- */
/*  Aktivitetsloggen                                                          */
/* -------------------------------------------------------------------------- */

// Hver handling som logges (lib/audit.ts), med det som står etter navnet: «Kari sendte en invitasjon».
export const AUDIT_ACTION_LABELS = {
  "invite.sent": "sendte en invitasjon",
  "invite.resent": "sendte en invitasjon på nytt",
  "invite.revoked": "trakk tilbake en invitasjon",
  "invite.accepted": "godtok invitasjonen",
  "invite.declined": "avslo invitasjonen",
  "member.role_changed": "endret rollen til et medlem",
  "member.removed": "fjernet et medlem",
  "member.left": "forlot bedriften",
  "owner.transferred": "overførte eierskapet",
  "employee.removed": "fjernet noen fra teamet",
  "company.updated": "endret bedriftsprofilen",
  "company.verified": "bekreftet bedriften",
  "company.verification_reset": "endret navn eller nettside, så bekreftelsen ble fjernet",
  "company.privacy_changed": "endret personverninnstillingene",
  "company.terms_accepted": "godtok databehandleravtalen",
  "job.published": "publiserte en stilling",
  "job.closed": "lukket en stilling",
  "job.deleted": "slettet en stilling",
  "application.viewed": "åpnet en søknad",
  "application.status": "flyttet en søker",
  "application.bulk_status": "flyttet flere søkere",
  "application.hired": "markerte en søker som ansatt",
  "application.note": "skrev et notat",
  "application.review": "vurderte en søker",
  "application.compared": "sammenlignet kandidater",
  "candidate.contacted": "kontaktet en kandidat",
  "list.added": "la en kandidat i en liste",
  "list.removed": "fjernet en kandidat fra en liste",
  "list.note": "skrev et notat i en liste",
  "list.exported": "lastet ned en liste",
  "list.deleted": "slettet en liste",
  "template.saved": "lagret en svarmal",
  "template.deleted": "slettet en svarmal",
  "webhook.created": "la til en webhook",
  "webhook.changed": "endret en webhook",
  "webhook.deleted": "slettet en webhook",
  "webhook.tested": "testet en webhook",
  "interview.slots_created": "la ut intervjutider",
  "interview.booked": "booket et intervju",
  "interview.cancelled": "avlyste et intervju",
  "retention.purged": "slettet utløpte søknader",
  "audit.exported": "lastet ned aktivitetsloggen",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;
export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];
export type AuditTargetType = "application" | "user" | "job" | "list" | "webhook" | "invite" | "company" | "template" | "interview";

// Filtrene i loggen. «Alle» viser alt, også stillinger.
export const AUDIT_GROUPS = {
  tilgang: [
    "invite.sent",
    "invite.resent",
    "invite.revoked",
    "invite.accepted",
    "invite.declined",
    "member.role_changed",
    "member.removed",
    "member.left",
    "owner.transferred",
    "employee.removed",
  ],
  sokere: [
    "application.viewed",
    "application.status",
    "application.bulk_status",
    "application.hired",
    "application.note",
    "application.review",
    "application.compared",
    "candidate.contacted",
    "list.added",
    "list.removed",
    "list.note",
    "list.deleted",
    "interview.slots_created",
    "interview.booked",
    "interview.cancelled",
    "retention.purged",
  ],
  eksport: ["list.exported", "audit.exported"],
  innstillinger: [
    "company.updated",
    "company.verified",
    "company.verification_reset",
    "company.privacy_changed",
    "company.terms_accepted",
    "template.saved",
    "template.deleted",
    "webhook.created",
    "webhook.changed",
    "webhook.deleted",
    "webhook.tested",
  ],
} as const satisfies Record<string, readonly AuditAction[]>;

export type AuditGroup = keyof typeof AUDIT_GROUPS;

export const AUDIT_GROUP_LABELS: Record<AuditGroup, string> = {
  tilgang: "Tilgang",
  sokere: "Søkere",
  eksport: "Eksport",
  innstillinger: "Innstillinger",
};

// Det alle i bedriften ser i «Aktivitet» under Oversikt (sammen med nye søknader).
export const FEED_ACTIONS = [
  "job.published",
  "job.closed",
  "application.status",
  "application.bulk_status",
  "application.hired",
  "invite.accepted",
  "member.left",
  "interview.booked",
  "company.verified",
] as const satisfies readonly AuditAction[];

/* -------------------------------------------------------------------------- */
/*  Søkere: maler, vurdering og lagringstid                                   */
/* -------------------------------------------------------------------------- */

export type TemplateKind = "takk" | "intervju" | "tilbud" | "avslag" | "generell";
export type Recommendation = "ja" | "kanskje" | "nei";

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  takk: "Takk for søknaden",
  intervju: "Intervju",
  tilbud: "Tilbud",
  avslag: "Avslag",
  generell: "Generell",
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  ja: "Ja",
  kanskje: "Kanskje",
  nei: "Nei",
};

// Kriteriene i vurderingskortet når stillingen ikke har egne.
export const DEFAULT_CRITERIA = ["Teknisk nivå", "Prosjektkvalitet", "Kommunikasjon", "Læringsvilje"];

// Måneder søknader beholdes etter at stillingen er lukket (Gratis: alltid 6).
export const RETENTION_OPTIONS = [3, 6, 12] as const;

/* -------------------------------------------------------------------------- */
/*  Administrasjonen                                                          */
/* -------------------------------------------------------------------------- */

// Fanene i administrasjonen, i rekkefølgen de vises.
export const ADMIN_TAB_LABELS = {
  oversikt: "Oversikt",
  stillinger: "Stillinger",
  sokere: "Søkere",
  kandidater: "Kandidatsøk",
  lister: "Lister",
  utfordringer: "Utfordringer",
  profil: "Bedriftsprofil",
  medlemmer: "Team og tilgang",
  personvern: "Personvern og logg",
  utviklere: "Webhooks",
  abonnement: "Abonnement",
} as const;

// Hva Bedrift låser opp, per fane.
export const UPSELL_TEXT = {
  kandidater: "Søk blant folk som har valgt å være synlige for bedrifter, se prosjektene deres, lagre søk og få varsel om nye kandidater, lag lister med notater og ta kontakt direkte.",
  sokere: "Flytt søkerne gjennom Ny → Intervju → Tilbud → Avslag, skriv notater og sammenlign dem side om side. Kandidaten får beskjed automatisk hver gang dere flytter dem.",
  utfordringer: "Legg ut en liten oppgave, og la studenter og juniorer svare med et prosjekt. Rettferdigere enn kodetester, og dere ser hvordan folk faktisk jobber.",
  generelt: "Ubegrenset med stillinger, søkeroversikt, kandidatsøk med lagrede søk og varsler, lister, utfordringer og webhooks.",
  oversikt: "Velg 30, 90 eller 365 dager, og se visninger, søkere, svartid og trakten for hver stilling.",
  logg: "Hele aktivitetsloggen i 24 måneder, og last den ned som CSV. Uten Bedrift ser dere de siste 30 dagene.",
  maler: "Egne svarmaler med flettefelt, og flytt eller avslå mange søkere på en gang. Alle får et ordentlig svar.",
  intervju: "Legg ut intervjutider, så booker kandidatene selv og får en kalenderfil. Alle får påminnelse dagen før.",
  vurdering: "Notater med @nevning og vurderingskort med de samme kriteriene for alle. Dere ser kollegenes vurdering når dere har levert deres egen.",
} as const;

// Sammenligningen under Abonnement.
export const PLAN_FEATURES = {
  free: [
    "Én aktiv stilling om gangen",
    "Søk med Vis-profilen og søkeroversikt",
    "Automatisk «Takk for søknaden»",
    "Invitasjoner, roller og tilgang",
    "Aktivitetslogg for de siste 30 dagene",
    "Oversikt med søkere, svartid og Spart med Vis",
  ],
  business: [
    "Ubegrenset med stillinger",
    "Flytt søkere, svarmaler og massehandlinger",
    "Notater med @nevning og vurderingskort",
    "Intervjubooking med kalenderfil",
    "Kandidatsøk, lister med eksport og direkte kontakt",
    "Aktivitetslogg i 24 måneder med CSV",
    "Krev tofaktor for hele bedriften",
    "Utfordringer og webhooks",
  ],
} as const;
