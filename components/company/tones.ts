import type { CompanyRole } from "@/lib/company-permissions";
import type { InviteStatus } from "@/lib/company-labels";
import type { ApplicationStatus } from "@/lib/constants";

// Farger for status, roller og invitasjoner i bedriftsdelen. Hentes bare herfra, så samme
// ting har samme farge overalt. Bare eksisterende fargetokener.

// Pille (bakgrunn og tekst) per søknadsstatus.
export const STAGE_TONE: Record<ApplicationStatus, string> = {
  ny: "bg-sea/15 text-sea",
  intervju: "bg-[#b197fc]/15 text-[#b197fc]",
  tilbud: "bg-success/15 text-success",
  avslag: "bg-fill text-mist",
  trukket: "bg-fill text-mist/70",
};

// Prikker i kolonnene og fyll i grafer (samme farger som søkeroversikten).
export const STAGE_FILL: Record<ApplicationStatus, string> = {
  ny: "bg-sea",
  intervju: "bg-[#b197fc]",
  tilbud: "bg-success",
  avslag: "bg-mist/50",
  trukket: "bg-mist/30",
};

export const ROLE_TONE: Record<CompanyRole, string> = {
  owner: "bg-warn/15 text-warn",
  admin: "bg-sea/15 text-sea",
  member: "bg-success/15 text-success",
  reviewer: "bg-fill text-mist",
};

export const INVITE_TONE: Record<InviteStatus, string> = {
  pending: "bg-warn/15 text-warn",
  accepted: "bg-success/15 text-success",
  declined: "bg-fill text-mist",
  revoked: "bg-fill text-mist",
  expired: "bg-danger/10 text-danger",
};

// Hvor lenge en søker har ventet: nøytral under 7 dager, gul fra 7, rød fra 14.
export function ageTone(days: number) {
  if (days >= 14) return "bg-danger/10 text-danger";
  if (days >= 7) return "bg-warn/15 text-warn";
  return "bg-fill text-mist";
}
