import { isLocale, localeCookie } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/safe-path";

// Bytter språk og sender tilbake til siden man var på (bare interne stier). Reserve for
// når JavaScript ikke er lastet; ellers bytter innstillingene språk uten å laste siden på nytt.
export function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("til");
  const back = url.searchParams.get("tilbake") ?? "/";
  const safeBack = safeInternalPath(back) ?? "/";
  const headers = new Headers({ Location: safeBack, "Cache-Control": "no-store" });
  if (isLocale(to)) headers.append("Set-Cookie", localeCookie(to, url.protocol === "https:"));
  return new Response(null, { status: 303, headers });
}
