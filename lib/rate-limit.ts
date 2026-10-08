import "server-only";

import { lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { UserFacingError } from "@/lib/result";

// Begrensninger som gjelder på tvers av serverprosesser (tabellen rate_bucket).
// Hver regel teller per bruker eller per IP i et fast tidsvindu.

export type Rule = { limit: number; windowSeconds: number; message: string };

const SLOW_DOWN = "Du har gjort dette mange ganger på kort tid. Vent litt og prøv igjen.";

export const RULES = {
  // Hver runde starter en nettleser eller bruker av en gratis kvote hos Microlink.
  screenshots: { limit: 20, windowSeconds: 60 * 60, message: "Du har tatt mange skjermbilder på kort tid. Vent litt og prøv igjen." },
  projectCreate: { limit: 30, windowSeconds: 24 * 60 * 60, message: "Du har laget mange prosjekter i dag. Prøv igjen i morgen." },
  githubImport: { limit: 60, windowSeconds: 60 * 60, message: "Du har importert mye fra GitHub på kort tid. Vent litt og prøv igjen." },
  follow: { limit: 200, windowSeconds: 60 * 60, message: SLOW_DOWN },
  contact: { limit: 5, windowSeconds: 24 * 60 * 60, message: "Du har sendt mange henvendelser i dag. Prøv igjen i morgen." },
  clientError: { limit: 20, windowSeconds: 10 * 60, message: SLOW_DOWN },
  api: { limit: 120, windowSeconds: 60, message: "For mange forespørsler. Vent et minutt." },
  apiKey: { limit: 1200, windowSeconds: 60, message: "For mange forespørsler. Vent et minutt." },
  checkout: { limit: 10, windowSeconds: 60 * 60, message: SLOW_DOWN },
  jobPost: { limit: 20, windowSeconds: 24 * 60 * 60, message: "Dere har lagt ut mange stillinger i dag. Prøv igjen i morgen." },
  domainCheck: { limit: 20, windowSeconds: 60 * 60, message: SLOW_DOWN },
  collection: { limit: 300, windowSeconds: 60 * 60, message: SLOW_DOWN },
  projectUpdate: { limit: 20, windowSeconds: 24 * 60 * 60, message: "Du har lagt ut mange oppdateringer i dag. Prøv igjen i morgen." },
  partnerPost: { limit: 10, windowSeconds: 24 * 60 * 60, message: "Du har lagt ut mange prosjekter i dag. Prøv igjen i morgen." },
  partnerRequest: { limit: 10, windowSeconds: 24 * 60 * 60, message: "Du har sendt mange forespørsler i dag. Prøv igjen i morgen." },
  jobApply: { limit: 20, windowSeconds: 24 * 60 * 60, message: "Du har sendt mange søknader i dag. Prøv igjen i morgen." },
  challengeEntry: { limit: 20, windowSeconds: 24 * 60 * 60, message: SLOW_DOWN },
  savedSearch: { limit: 50, windowSeconds: 24 * 60 * 60, message: SLOW_DOWN },
  // Bedrift: tilgang, kontakt og eksport telles per bedrift (eller per bruker der det står).
  companyCreate: { limit: 3, windowSeconds: 24 * 60 * 60, message: "Du har laget mange bedrifter i dag. Prøv igjen i morgen." },
  companyInvite: { limit: 30, windowSeconds: 24 * 60 * 60, message: "Dere har sendt mange invitasjoner i dag. Prøv igjen i morgen." },
  // Per e-postadresse (sha256), så ingen kan bruke invitasjoner til å mase på én adresse.
  inviteEmail: { limit: 3, windowSeconds: 24 * 60 * 60, message: SLOW_DOWN },
  inviteResend: { limit: 1, windowSeconds: 24 * 60 * 60, message: "Invitasjonen ble sendt på nytt nylig. Prøv igjen i morgen." },
  companyContact: { limit: 25, windowSeconds: 24 * 60 * 60, message: "Bedriften har sendt mange henvendelser i dag. Prøv igjen i morgen." },
  csvExport: { limit: 20, windowSeconds: 24 * 60 * 60, message: "Dere har lastet ned mange lister i dag. Prøv igjen i morgen." },
  auditExport: { limit: 10, windowSeconds: 24 * 60 * 60, message: SLOW_DOWN },
  candidateSearch: { limit: 300, windowSeconds: 60 * 60, message: SLOW_DOWN },
  bulkAction: { limit: 10, windowSeconds: 60 * 60, message: SLOW_DOWN },
  applicationNote: { limit: 120, windowSeconds: 60 * 60, message: SLOW_DOWN },
  interviewSlots: { limit: 50, windowSeconds: 24 * 60 * 60, message: SLOW_DOWN },
  interviewBook: { limit: 10, windowSeconds: 60 * 60, message: SLOW_DOWN },
  companyVerify: { limit: 10, windowSeconds: 60 * 60, message: SLOW_DOWN },
  // Disse to brukes med check(), uten å kaste: maks én oppsummering per person per døgn, og
  // maks ett «X lagret profilen din» per bedrift og kandidat (nøkkel «bedrift:bruker») per 30 dager.
  companyDigest: { limit: 1, windowSeconds: 20 * 60 * 60, message: SLOW_DOWN },
  talentNotice: { limit: 1, windowSeconds: 30 * 24 * 60 * 60, message: SLOW_DOWN },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

export type HitResult = { ok: boolean; count: number; remaining: number; resetAt: Date };

// Teller ett forsøk. Telleren starter på nytt når vinduet er over. Én spørring, så to
// samtidige forsøk kan ikke begge slippe gjennom på siste plass.
export async function hit(key: string, rule: Pick<Rule, "limit" | "windowSeconds">): Promise<HitResult> {
  const window = sql`make_interval(secs => ${rule.windowSeconds})`;
  const rows = await db.execute<{ count: number; window_start: string | Date }>(sql`
    insert into rate_bucket (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_bucket.window_start <= now() - ${window} then 1 else rate_bucket.count + 1 end,
      window_start = case when rate_bucket.window_start <= now() - ${window} then now() else rate_bucket.window_start end
    returning count, window_start`);
  const row = rows[0];
  const count = Number(row.count);

  // Rydder gamle tellere av og til, så tabellen ikke vokser.
  if (Math.random() < 0.01) {
    void db
      .delete(schema.rateBucket)
      .where(lt(schema.rateBucket.windowStart, sql`now() - interval '2 days'`))
      .catch(() => {});
  }

  return {
    ok: count <= rule.limit,
    count,
    remaining: Math.max(0, rule.limit - count),
    resetAt: new Date(new Date(row.window_start).getTime() + rule.windowSeconds * 1000),
  };
}

// Kaster en feil brukeren kan se når grensen er nådd.
export async function enforce(name: RuleName, id: string) {
  const rule = RULES[name];
  // Eksempeldataene (scripts/seed.ts) lager mange prosjekter på en gang. Aldri i produksjon.
  if (process.env.VIS_SEEDING === "1" && process.env.NODE_ENV !== "production") {
    return { ok: true, count: 0, remaining: rule.limit, resetAt: new Date() };
  }
  const result = await hit(`${name}:${id}`, rule);
  if (!result.ok) throw new UserFacingError(rule.message);
  return result;
}

// Som enforce, men uten å kaste (for API-ruter som svarer med 429).
export function check(name: RuleName, id: string) {
  return hit(`${name}:${id}`, RULES[name]);
}
