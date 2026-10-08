// Hvem i en bedrift kan gjøre hva. Ren logikk uten database, så den kan brukes både på
// serveren (lib/company-access.ts) og i grensesnittet. Alle tilgangssjekker går hit; ingen
// skriver egne lister over roller.
//
// Eier (owner), administrator (admin), rekrutterer (member) og vurderer (reviewer).
// Vurderer er for ledere og intervjuere: ser søkerne og vurderer dem, men får aldri
// kontaktinfo, sender ingen meldinger og bruker ikke kandidatsøket.

export const COMPANY_ROLES = ["owner", "admin", "member", "reviewer"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const COMPANY_ACTIONS = [
  "company.view",
  "members.view",
  "applications.view",
  "jobs.draft",
  "challenges.view",
  "notes.write",
  "reviews.write",
  "applications.contactDetails",
  "jobs.publish",
  "applications.move",
  "applications.bulk",
  "applications.hire",
  "templates.manage",
  "interviews.manage",
  "reviews.criteria",
  "candidates.search",
  "candidates.contact",
  "lists.edit",
  "searches.manage",
  "company.edit",
  "company.privacy",
  "company.billing",
  "members.invite",
  "members.manage",
  "audit.view",
  "jobs.delete",
  "lists.delete",
  "challenges.manage",
  "webhooks.view",
  "lists.export",
  "audit.export",
  "webhooks.manage",
  "company.security",
  "company.delete",
  "members.grantAdmin",
] as const;
export type CompanyAction = (typeof COMPANY_ACTIONS)[number];

const ALL = COMPANY_ROLES;
const RECRUITERS = ["owner", "admin", "member"] as const;
const ADMINS = ["owner", "admin"] as const;
const OWNER = ["owner"] as const;

// Matrisen. Noen handlinger krever i tillegg Bedrift (requireBusiness hos den som kaller):
// notes.write, reviews.write, applications.move/bulk/hire, templates.manage, interviews.manage,
// reviews.criteria, candidates.search/contact, lists.edit, searches.manage (når de lages),
// lists.export, audit.export, webhooks.manage (når de lages) og company.security.
export const CAN: Record<CompanyAction, readonly CompanyRole[]> = {
  "company.view": ALL,
  "members.view": ALL,
  "applications.view": ALL,
  "jobs.draft": ALL,
  "challenges.view": ALL,
  "notes.write": ALL,
  "reviews.write": ALL,
  "applications.contactDetails": RECRUITERS,
  "jobs.publish": RECRUITERS,
  "applications.move": RECRUITERS,
  "applications.bulk": RECRUITERS,
  "applications.hire": RECRUITERS,
  "templates.manage": RECRUITERS,
  "interviews.manage": RECRUITERS,
  "reviews.criteria": RECRUITERS,
  "candidates.search": RECRUITERS,
  "candidates.contact": RECRUITERS,
  "lists.edit": RECRUITERS,
  "searches.manage": RECRUITERS,
  "company.edit": ADMINS,
  "company.privacy": ADMINS,
  "company.billing": ADMINS,
  "members.invite": ADMINS,
  "members.manage": ADMINS,
  "audit.view": ADMINS,
  "jobs.delete": ADMINS,
  "lists.delete": ADMINS,
  "challenges.manage": ADMINS,
  "webhooks.view": ADMINS,
  "lists.export": ADMINS,
  "audit.export": ADMINS,
  "webhooks.manage": ADMINS,
  "company.security": OWNER,
  "company.delete": OWNER,
  "members.grantAdmin": OWNER,
};

export const can = (role: CompanyRole | null | undefined, action: CompanyAction) => Boolean(role && CAN[action].includes(role));

// Krever at databehandleravtalen er godtatt.
export const TERMS_ACTIONS = ["jobs.publish", "candidates.search", "candidates.contact"] as const satisfies readonly CompanyAction[];
// Tillatt uten tofaktor selv når bedriften krever det, så man ser hvem man skal spørre.
export const TWO_FACTOR_EXEMPT = ["company.view", "members.view"] as const satisfies readonly CompanyAction[];

// Rollene en person kan gi andre: eieren gir alt unntatt eier, administratorer gir
// rekrutterer og vurderer. Eierskap overføres med en egen invitasjon.
export function assignableRoles(actor: CompanyRole | null | undefined): CompanyRole[] {
  if (actor === "owner") return ["admin", "member", "reviewer"];
  if (actor === "admin") return ["member", "reviewer"];
  return [];
}

// Kan actor endre rollen til eller fjerne target? Ingen rører eieren, bare eieren rører en
// administrator, og administratorer kan endre og fjerne rekrutterere og vurderere.
// Alle unntatt eieren kan fjerne seg selv (self).
export function canManageMember(actorRole: CompanyRole | null | undefined, targetRole: CompanyRole | null | undefined, self: boolean) {
  if (!actorRole || !targetRole || targetRole === "owner") return false;
  if (self) return true;
  if (targetRole === "admin") return actorRole === "owner";
  return actorRole === "owner" || actorRole === "admin";
}
