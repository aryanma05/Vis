import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { ipFromHeaders } from "@/lib/request-ip";

const handler = toNextJsHandler(auth);

// Better Auth stoler bare på X-Forwarded-For når den har én IP, og ellers deler alle
// besøkende samme rate limit (så én person som prøver flere ganger kan stenge registreringen
// for alle). Bak Render står det flere IP-er der, så vi sender bare klientens IP videre,
// funnet på samme måte som appens egne grenser (lib/request-ip.ts, inkl. TRUSTED_IP_HEADER).
function withClientIp(request: Request) {
  const ip = ipFromHeaders(request.headers);
  if (ip === "lokal" || request.headers.get("x-forwarded-for") === ip) return request;
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-for", ip);
  return new Request(request, { headers });
}

export const GET = (request: Request) => handler.GET(withClientIp(request));
export const POST = (request: Request) => handler.POST(withClientIp(request));
