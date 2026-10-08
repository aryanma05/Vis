// Content-Security-Policy for hele appen (settes i next.config.ts). Ligger for seg selv,
// uten avhengigheter, så den kan testes (tests/security.test.ts).
//
// Uten nonce: Next legger inn egne inline-skript (og temaskriptet i app/layout.tsx), så
// script-src må tillate 'unsafe-inline'. En nonce krever at alle sider rendres per
// forespørsel. Policyen stopper likevel skript fra andre domener, <object>/<embed>,
// <base>-kapring, skjemaer som sender til andre nettsteder, innramming på andre sider og
// fetch/XHR til ukjente adresser. Se docs/sikkerhet/SIKKERHETSMODELL.md.

type Env = Record<string, string | undefined>;

// Innebygde spillere fra embedUrl() i components/project/VideoEmbed.tsx.
const FRAME_SOURCES = ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.loom.com", "https://www.figma.com"];

const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

// Besøksstatistikken i components/Analytics.tsx henter et skript og sender hendelser dit.
function analyticsOrigins(env: Env) {
  if (env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return [originOf(env.NEXT_PUBLIC_PLAUSIBLE_SRC) ?? "https://plausible.io"];
  if (env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) {
    const own = originOf(env.NEXT_PUBLIC_UMAMI_SRC);
    return own ? [own] : ["https://cloud.umami.is", "https://api-gateway.umami.dev"];
  }
  return [];
}

export function contentSecurityPolicy(env: Env = process.env) {
  const dev = env.NODE_ENV !== "production";
  const analytics = analyticsOrigins(env);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-eval' bare under utvikling (React bruker eval til feilmeldinger der).
    // 'wasm-unsafe-eval': pdf.js kan bruke WebAssembly når CV-sider gjøres om til bilder.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : []), ...analytics],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Bilder i README-er og prosjekter kan ligge hvor som helst på nett.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", "https:"],
    "connect-src": ["'self'", ...analytics, ...(dev ? ["ws:", "wss:"] : [])],
    "frame-src": ["'self'", ...FRAME_SOURCES],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
