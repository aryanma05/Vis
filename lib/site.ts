// Adressen appen kjører på, brukt i delbare lenker, e-poster, sitemap og
// forhåndsbilder (Open Graph). Samme rekkefølge som i lib/auth.ts.
export function siteUrl(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {}
  }
  return "http://localhost:3000";
}

export const SITE_NAME = "Vis";
export const SITE_TAGLINE = "Din faglige identitet, samlet på ett sted.";
export const SITE_DESCRIPTION =
  "Vis er stedet for utviklere, designere og alle som lager digitalt i Norden: et visuelt visittkort, en ryddig CV og prosjektene dine – samlet i én profil.";

// Lenke til en profil, uten domenet: /@brukernavn.
export const profilePath = (username: string) => `/@${username}`;
export const projectPath = (id: string) => `/prosjekt/${id}`;
export const tagPath = (slug: string) => `/tag/${encodeURIComponent(slug)}`;
