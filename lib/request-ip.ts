import "server-only";

import { headers } from "next/headers";

// Klientens IP-adresse, til begrensninger per besøkende. Render setter klientens IP
// først i X-Forwarded-For (se app/api/auth/[...all]/route.ts), Vercel setter X-Real-IP.
export function ipFromHeaders(h: Headers) {
  const real = h.get("x-real-ip")?.trim();
  if (process.env.VERCEL && real) return real;
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || real || "lokal";
}

export async function clientIp() {
  return ipFromHeaders(await headers());
}
