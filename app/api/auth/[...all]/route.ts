import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

// Render setter klientens IP først i X-Forwarded-For, fulgt av sine egne proxyer. Better Auth
// stoler bare på headeren når den har én IP, og ellers deler alle besøkende samme
// rate limit (så én person som prøver flere ganger kan stenge registreringen for alle).
// På Render sender vi derfor bare den første IP-en videre.
function withClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!process.env.RENDER || !forwarded?.includes(",")) return request;
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-for", forwarded.split(",")[0].trim());
  return new Request(request, { headers });
}

export const GET = (request: Request) => handler.GET(withClientIp(request));
export const POST = (request: Request) => handler.POST(withClientIp(request));
