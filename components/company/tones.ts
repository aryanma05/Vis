import type { CompanyRole } from "@/lib/company-permissions";
import type { InviteStatus } from "@/lib/company-labels";
import type { ApplicationStatus } from "@/lib/constants";

// Farger for status, roller og invitasjoner i bedriftsdelen: nøytral pille med farget prikk (tone i globals.css). Hentes bare herfra, så samme
// ting har samme farge overalt. Bare eksisterende fargetokener.

// Pille (bakgrunn og tekst) per søknadsstatus.
export const STAGE_TONE: Record<ApplicationStatus, string> = {
  ny: "tone tone-sea",
  intervju: "tone tone-ice",
  tilbud: "tone tone-success",
  avslag: "tone tone-mist text-mist",
  trukket: "tone tone-mist text-mist/70",
};

// Prikker i kolonnene og fyll i grafer (samme farger som søkeroversikten).
export const STAGE_FILL: Record<ApplicationStatus, string> = {
  ny: "bg-sea",
  intervju: "bg-ice",
  tilbud: "bg-success",
  avslag: "bg-mist/50",
  trukket: "bg-mist/30",
};

export const ROLE_TONE: Record<CompanyRole, string> = {
  owner: "tone tone-warn",
  admin: "tone tone-sea",
  member: "tone tone-success",
  reviewer: "tone tone-mist",
};

export const INVITE_TONE: Record<InviteStatus, string> = {
  pending: "tone tone-warn",
  accepted: "tone tone-success",
  declined: "tone tone-mist text-mist",
  revoked: "tone tone-mist text-mist",
  expired: "tone tone-danger",
};

// Hvor lenge en søker har ventet: nøytral under 7 dager, gul fra 7, rød fra 14.
export function ageTone(days: number) {
  if (days >= 14) return "tone tone-danger";
  if (days >= 7) return "tone tone-warn";
  return "tone tone-mist text-mist";
}
