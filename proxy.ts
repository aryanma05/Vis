import { NextResponse, type NextRequest } from "next/server";
import { isOwnHost, usernameForHost } from "@/lib/domain-lookup";
import { siteUrl } from "@/lib/site";

// Egne domener (Pro): ola.no viser profilen til Ola, ola.no/cv viser CV-en. Alt annet på
// et eget domene sendes til hovedsiden, der innlogging og resten av appen ligger.
// På appens egne adresser gjør denne ingenting (ingen databaseoppslag).
export async function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (isOwnHost(host)) return NextResponse.next();

  let username: string | null = null;
  try {
    username = await usernameForHost(host);
  } catch {
    return NextResponse.next();
  }
  if (!username) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname === "/" || pathname === "/cv") {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/profil/${username}` : `/profil/${username}/cv`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.redirect(new URL(`${pathname}${search}`, siteUrl()), 308);
}

export const config = {
  // Ikke statiske filer, bilder, API-et eller filer lagret i databasen.
  matcher: ["/((?!_next/|api/|filer/|bygg-inn/|favicon|icon|apple-icon|opengraph-image|robots.txt|sitemap.xml|manifest).*)"],
};
