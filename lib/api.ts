import "server-only";

import { authenticateApiKey } from "@/lib/api-keys";
import { check, RULES } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request-ip";
import { siteUrl } from "@/lib/site";

// Felles for det åpne API-et under /api/v1: CORS, begrensninger og feilsvar.
// Alt er bare lesing av det som allerede er offentlig på Vis.

export const API_VERSION = "1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function apiError(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: { status, message } }, { status, headers: { ...CORS, ...headers } });
}

// Kjører en API-handler med begrensning per nøkkel (høyere grense) eller per IP.
export async function withApi(request: Request, handler: () => Promise<unknown>) {
  const auth = await authenticateApiKey(request.headers.get("authorization"));
  if (request.headers.get("authorization") && !auth) return apiError(401, "Invalid API key.");
  const limit = auth ? await check("apiKey", auth.id) : await check("api", ipFromHeaders(request.headers));
  const rateHeaders = {
    "X-RateLimit-Limit": String(auth ? RULES.apiKey.limit : RULES.api.limit),
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(limit.resetAt.getTime() / 1000)),
  };
  if (!limit.ok) {
    return apiError(429, "Too many requests. Try again shortly.", { ...rateHeaders, "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))) });
  }
  try {
    const data = await handler();
    if (data === null || data === undefined) return apiError(404, "Not found.", rateHeaders);
    return Response.json(data, {
      headers: { ...CORS, ...rateHeaders, "Cache-Control": auth ? "private, no-store" : "public, max-age=60, s-maxage=60" },
    });
  } catch (error) {
    console.error("[api]", error);
    return apiError(500, "Something went wrong.", rateHeaders);
  }
}

export const absoluteUrl = (url: string | null | undefined) => (url ? (url.startsWith("/") ? `${siteUrl()}${url}` : url) : null);
export const intParam = (value: string | null, fallback: number, max: number) => Math.min(Math.max(Number(value) || fallback, 1), max);
