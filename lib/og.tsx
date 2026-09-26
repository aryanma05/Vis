import "server-only";

import sharp from "sharp";
import { getStoredFile, FILE_URL_PREFIX } from "@/lib/storage";
import { log } from "@/lib/log";

// Felles for forhåndsbildene (Open Graph) som vises når noen deler en lenke.

export const OG_SIZE = { width: 1200, height: 630 };

// Schibsted Grotesk i fet og vanlig vekt, hentet én gang per serverprosess. Feiler det,
// bruker bildegeneratoren sin innebygde font.
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 800; style: "normal" }[]> | null = null;

async function loadGoogleFont(weight: 400 | 800) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@${weight}`, {
    // Eldre nettleser-ID gir TTF i stedet for WOFF2 (bildegeneratoren leser ikke WOFF2).
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
    signal: AbortSignal.timeout(4000),
  }).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("Fant ikke fontfilen");
  return fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer());
}

export function ogFonts() {
  fontsPromise ??= Promise.all([loadGoogleFont(800), loadGoogleFont(400)])
    .then(([bold, regular]) => [
      { name: "Schibsted", data: bold, weight: 800 as const, style: "normal" as const },
      { name: "Schibsted", data: regular, weight: 400 as const, style: "normal" as const },
    ])
    .catch((error) => {
      log.warn("og.fonts", { error });
      fontsPromise = null;
      return [];
    });
  return fontsPromise;
}

// Bilder lagres som WebP, som bildegeneratoren ikke leser. Hent og gjør om til PNG.
export async function imageDataUrl(url: string | null | undefined, { width, height }: { width: number; height: number }) {
  if (!url) return null;
  try {
    let bytes: Uint8Array;
    if (url.startsWith(FILE_URL_PREFIX)) {
      const file = await getStoredFile(decodeURIComponent(url.slice(FILE_URL_PREFIX.length)));
      if (!file || file.isPrivate) return null;
      bytes = new Uint8Array(file.data);
    } else if (/^https:\/\//.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    } else {
      return null;
    }
    const png = await sharp(bytes).resize(width, height, { fit: "cover" }).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (error) {
    log.warn("og.image", { error, url });
    return null;
  }
}

export const OG_COLORS = { ink: "#071a52", surface: "#0a245e", line: "#174b76", ice: "#c7f9ff", mist: "#b8d8e3" };

// Rutenettet fra «blueprint»-coverne, som bakgrunn.
export const gridBackground = {
  backgroundColor: OG_COLORS.ink,
  backgroundImage: `linear-gradient(rgba(199,249,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(199,249,255,0.08) 1px, transparent 1px)`,
  backgroundSize: "48px 48px",
};

export function Wordmark({ size = 44, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontSize: size, fontWeight: 800, letterSpacing: "-0.06em", color }}>
      vis
      <div style={{ width: size * 0.2, height: size * 0.2, borderRadius: 999, background: OG_COLORS.ice, marginLeft: size * 0.08 }} />
    </div>
  );
}
