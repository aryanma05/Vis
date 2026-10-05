import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { safeInternalPath } from "@/lib/safe-path";

// Bytter språk og sender tilbake til siden man var på (bare interne stier).
export function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("til");
  const back = url.searchParams.get("tilbake") ?? "/";
  const safeBack = safeInternalPath(back) ?? "/";
  const headers = new Headers({ Location: safeBack, "Cache-Control": "no-store" });
  if (isLocale(to)) {
    const secure = url.protocol === "https:" ? "; Secure" : "";
    headers.append("Set-Cookie", `${LOCALE_COOKIE}=${to}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`);
  }
  return new Response(null, { status: 303, headers });
}
