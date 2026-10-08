import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { can, TERMS_ACTIONS, TWO_FACTOR_EXEMPT, type CompanyAction, type CompanyRole } from "@/lib/company-permissions";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";

const { company, companyMember, user } = schema;

export type { CompanyAction, CompanyRole };

// Versjonen av databehandleravtalen (/vilkar/databehandleravtale). Lagres når den godtas.
export const COMPANY_TERMS_VERSION = "2026-10";

export type CompanyGate = { role: CompanyRole; needs2fa: boolean; termsAccepted: boolean };

// Rollen i bedriften, om bedriften krever tofaktor som personen mangler, og om
// databehandleravtalen er godtatt. Null når personen ikke er medlem. Én spørring per forespørsel.
export const getCompanyGate = cache(async (userId: string | null | undefined, companyId: string): Promise<CompanyGate | null> => {
  if (!userId || !isUuid(companyId)) return null;
  const [row] = await db
    .select({ role: companyMember.role, require2fa: company.require2fa, termsAcceptedAt: company.termsAcceptedAt, twoFactorEnabled: user.twoFactorEnabled })
    .from(companyMember)
    .innerJoin(company, eq(company.id, companyMember.companyId))
    .innerJoin(user, eq(user.id, companyMember.userId))
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { role: row.role, needs2fa: row.require2fa && !row.twoFactorEnabled, termsAccepted: row.termsAcceptedAt !== null };
});

// Alle tilgangssjekker i bedriftsdelen går hit (matrisen i lib/company-permissions.ts).
// Gir rollen, eller kaster en feil brukeren kan se.
export async function requireCompanyPermission(userId: string, companyId: string, action: CompanyAction): Promise<CompanyRole> {
  const gate = await getCompanyGate(userId, companyId);
  if (!gate) throw new UserFacingError("Du har ikke tilgang til denne bedriften.");
  if (!can(gate.role, action)) throw new UserFacingError("Rollen din gir ikke tilgang til dette.");
  if (gate.needs2fa && !(TWO_FACTOR_EXEMPT as readonly CompanyAction[]).includes(action)) {
    throw new UserFacingError("Bedriften krever tofaktorinnlogging. Slå det på under Konto.");
  }
  if ((TERMS_ACTIONS as readonly CompanyAction[]).includes(action) && !gate.termsAccepted) {
    throw new UserFacingError("Godta databehandleravtalen under Personvern og logg først.");
  }
  return gate.role;
}

// For det som ikke går gjennom en rolle (f.eks. betaling): databehandleravtalen må være godtatt.
export async function requireTermsAccepted(companyId: string) {
  const [row] = isUuid(companyId)
    ? await db.select({ termsAcceptedAt: company.termsAcceptedAt }).from(company).where(eq(company.id, companyId)).limit(1)
    : [];
  if (!row?.termsAcceptedAt) throw new UserFacingError("Godta databehandleravtalen under Personvern og logg først.");
}
