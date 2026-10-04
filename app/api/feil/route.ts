import { recordError } from "@/lib/errors";
import { check } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/request-ip";
import { getCurrentUser } from "@/lib/session";

// Feil som skjer i nettleseren (app/error.tsx og app/global-error.tsx) sendes hit, så
// de vises i feilloggen under /admin?fane=system. Bare melding, feilkode og sti.
export async function POST(request: Request) {
  const limit = await check("clientError", ipFromHeaders(request.headers));
  if (!limit.ok) return new Response(null, { status: 429 });

  let body: { message?: unknown; digest?: unknown; path?: unknown; stack?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const message = text(body.message, 1000);
  if (!message) return new Response(null, { status: 400 });

  const user = await getCurrentUser().catch(() => null);
  const error = new Error(message);
  error.stack = text(body.stack, 4000) ?? undefined;
  recordError({ source: "client", event: "client.error", error, digest: text(body.digest, 100), path: text(body.path, 300), userId: user?.id });
  return new Response(null, { status: 204 });
}
