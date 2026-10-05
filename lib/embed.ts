import "server-only";

import { siteUrl } from "@/lib/site";

// Felles for merket (SVG) og innbyggingskortene (HTML) som andre nettsider viser.

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Bilder lagret i databasen har relative adresser (/filer/...).
export const absolute = (url: string | null | undefined) => (url ? (url.startsWith("/") ? `${siteUrl()}${url}` : url) : null);

// Omtrentlig tekstbredde i piksler for 11 px Verdana/Geist, til merket.
export function textWidth(text: string) {
  let w = 0;
  for (const c of text) w += /[ijlt.,:;'|!]/.test(c) ? 3.6 : /[mwMW@]/.test(c) ? 9.4 : /[A-ZÆØÅ]/.test(c) ? 7.6 : 6.4;
  return Math.ceil(w);
}

export type EmbedTheme = "mork" | "lys";
export const embedTheme = (value: string | null): EmbedTheme => (value === "lys" ? "lys" : "mork");

const THEMES = {
  mork: { bg: "#0b1229", card: "#111a36", fg: "#f3f6fd", mist: "#9ba7c7", line: "rgba(255,255,255,0.1)", accent: "#8ccbff" },
  lys: { bg: "#ffffff", card: "#f4f5f8", fg: "#16181d", mist: "#646a78", line: "rgba(20,30,60,0.1)", accent: "#0062cc" },
};

// Et selvstendig HTML-dokument (uten Next-layouten), så det er lett og kan vises i en iframe.
export function embedDocument({ title, body, theme }: { title: string; body: string; theme: EmbedTheme }) {
  const t = THEMES[theme];
  return `<!doctype html>
<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="robots" content="noindex"><meta name="color-scheme" content="${theme === "lys" ? "light" : "dark"}">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:${t.bg};overflow:hidden}
body{font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:${t.fg}}
a{color:inherit;text-decoration:none}
.card{display:block;min-height:100%;background:${t.bg};padding:16px;overflow:hidden}
.top{display:flex;gap:12px;align-items:center}
.avatar{width:48px;height:48px;border-radius:999px;object-fit:cover;background:${t.card};flex:none;display:flex;align-items:center;justify-content:center;font-weight:700;color:${t.mist}}
.name{font-weight:650;font-size:16px;letter-spacing:-0.01em}
.mist{color:${t.mist}}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
.shot{aspect-ratio:4/3;border-radius:10px;background:${t.card};object-fit:cover;width:100%;display:block}
.ptitle{margin-top:6px;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cover{aspect-ratio:2/1;width:100%;object-fit:cover;object-position:top;border-radius:12px;background:${t.card};display:block}
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12px}
.brand{font-weight:800;letter-spacing:-0.03em;color:${t.accent}}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.tag{font-size:11.5px;padding:3px 8px;border-radius:999px;background:${t.card};color:${t.mist}}
@media (max-width:380px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.grid>*:nth-child(3){display:none}}
</style></head><body>${body}</body></html>`;
}

// Kortene skal kunne vises på andre nettsider, men ikke kjøre skript eller hente noe
// annet enn bildene.
export function embedHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300",
    "Content-Security-Policy": "default-src 'none'; img-src https: data: 'self'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}
