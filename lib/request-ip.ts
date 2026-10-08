import "server-only";

import { headers } from "next/headers";

type Env = Record<string, string | undefined>;

// Klientens IP-adresse, til begrensninger per besøkende. Brukes både av appens egne grenser
// (lib/rate-limit.ts) og av Better Auth (app/api/auth/[...all]/route.ts), så de er enige.
//
// Første verdi i X-Forwarded-For er den klienten selv oppgir hvis proxyen legger til i stedet
// for å erstatte headeren (Cloudflare gjør det). Står TRUSTED_IP_HEADER (f.eks.
// «cf-connecting-ip» eller «true-client-ip») satt, brukes den headeren, som proxyen alltid
// setter selv. Se docs/sikkerhet/PRODUKSJONSSJEKKLISTE.md for hvordan det sjekkes på Render.
export function ipFromHeaders(h: Headers, env: Env = process.env) {
  const trusted = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const value = h.get(trusted)?.split(",")[0]?.trim();
    if (value) return value;
  }
  const real = h.get("x-real-ip")?.trim();
  if (env.VERCEL && real) return real;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || real || "lokal";
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}
