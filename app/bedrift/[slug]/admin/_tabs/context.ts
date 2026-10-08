import type { company } from "@/db/schema";
import type { PlanState } from "@/lib/billing";
import { ADMIN_TAB_LABELS } from "@/lib/company-labels";
import type { CompanyAction, CompanyRole } from "@/lib/company-permissions";
import type { Locale, T } from "@/lib/i18n";
import type { CurrentUser } from "@/lib/session";

// Det alle fanene i administrasjonen får fra skallet (page.tsx). Hver fane ligger i
// _tabs/<nøkkel>.tsx, eksporterer default async function XTab({ ctx }) og henter egne data.

export type AdminTab = keyof typeof ADMIN_TAB_LABELS;
export const ADMIN_TABS = Object.keys(ADMIN_TAB_LABELS) as AdminTab[];

// ?fane=… og det fanene selv leser. velg: velg flere søkere, periode: 30/90/365 dager under
// Oversikt, logg: filteret i aktivitetsloggen, for: f.eks. «Venter > 7 d» under Søkere.
export type AdminQuery = {
  fane?: string;
  q?: string;
  sted?: string;
  apen?: string;
  fag?: string;
  liste?: string;
  avbrutt?: string;
  stilling?: string;
  student?: string;
  sok?: string;
  velg?: string;
  periode?: string;
  logg?: string;
  for?: string;
};

export type AdminCtx = {
  user: CurrentUser;
  company: typeof company.$inferSelect;
  role: CompanyRole;
  plan: PlanState;
  business: boolean;
  // /bedrift/<slug>/admin
  base: string;
  // Prisen på Bedrift i måneden, formatert («1 990 kr»).
  monthly: string;
  // Kan kjøpe og endre abonnementet (company.billing).
  canBuy: boolean;
  t: T;
  locale: Locale;
  query: AdminQuery;
};

// Fanen vises bare for roller som kan gjøre dette (lib/company-permissions.ts).
export const TAB_ACTION: Record<AdminTab, CompanyAction> = {
  oversikt: "company.view",
  stillinger: "jobs.draft",
  sokere: "applications.view",
  kandidater: "candidates.search",
  lister: "lists.edit",
  utfordringer: "challenges.view",
  profil: "company.edit",
  medlemmer: "members.view",
  personvern: "audit.view",
  utviklere: "webhooks.view",
  abonnement: "company.view",
};
