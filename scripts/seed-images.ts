// Lager illustrasjoner til eksempelprosjektene (skisser av apper og nettsider) som
// SVG, og gjør dem om til WebP med sharp. Brukes bare av scripts/seed.ts lokalt.
import sharp from "sharp";

type Palette = { bg: string; panel: string; accent: string; accent2: string; ink: string; muted: string };

export const PALETTES: Record<string, Palette> = {
  fjord: { bg: "#0b1d3a", panel: "#12294d", accent: "#5eb8d4", accent2: "#c7f9ff", ink: "#ffffff", muted: "#8fb3c9" },
  mose: { bg: "#0f2a1d", panel: "#173a29", accent: "#9fe0a8", accent2: "#e4ffd9", ink: "#ffffff", muted: "#9cc4a8" },
  nordlys: { bg: "#17123a", panel: "#221b52", accent: "#b9a6ff", accent2: "#7ef0d0", ink: "#ffffff", muted: "#a9a1d6" },
  molte: { bg: "#fff7ec", panel: "#ffffff", accent: "#ff8f3d", accent2: "#ffc27a", ink: "#2b1a08", muted: "#9a7b5c" },
  papir: { bg: "#f4f1ea", panel: "#ffffff", accent: "#1f4d3a", accent2: "#e9c46a", ink: "#15231c", muted: "#6b7b72" },
  rose: { bg: "#2a0f1c", panel: "#3a1628", accent: "#ff9fb5", accent2: "#ffd6e0", ink: "#ffffff", muted: "#d7a3b3" },
  is: { bg: "#e9f4fb", panel: "#ffffff", accent: "#086788", accent2: "#5eb8d4", ink: "#071a52", muted: "#5b7285" },
};

const W = 1600;
const H = 1000;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

function rand(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function frame(p: Palette, inner: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.panel}"/></linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.28"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  ${inner}
</svg>`;
}

// Nettleservindu med et dashboard (grafer og nøkkeltall).
function dashboard(title: string, p: Palette, seed: number) {
  const r = rand(seed);
  const bars = Array.from({ length: 14 }, (_, i) => {
    const h = 60 + r() * 220;
    return `<rect x="${560 + i * 52}" y="${720 - h}" width="30" height="${h}" rx="6" fill="${i % 3 === 0 ? p.accent2 : p.accent}" opacity="${0.55 + r() * 0.45}"/>`;
  }).join("");
  const points = Array.from({ length: 12 }, (_, i) => `${560 + i * 64},${380 - r() * 120 - i * 6}`).join(" ");
  return frame(
    p,
    `<g filter="url(#shadow)"><rect x="120" y="90" width="1360" height="840" rx="26" fill="${p.panel}"/></g>
    <rect x="120" y="90" width="1360" height="56" rx="26" fill="${p.bg}" opacity="0.6"/>
    <circle cx="160" cy="118" r="8" fill="#ff5f57"/><circle cx="188" cy="118" r="8" fill="#febc2e"/><circle cx="216" cy="118" r="8" fill="#28c840"/>
    <rect x="160" y="190" width="300" height="700" rx="18" fill="${p.bg}" opacity="0.55"/>
    ${Array.from({ length: 7 }, (_, i) => `<rect x="190" y="${240 + i * 60}" width="${150 + r() * 90}" height="18" rx="9" fill="${i === 1 ? p.accent : p.muted}" opacity="${i === 1 ? 1 : 0.45}"/>`).join("")}
    <text x="520" y="235" font-family="Helvetica, Arial, sans-serif" font-size="42" font-weight="700" fill="${p.ink}">${esc(title)}</text>
    <text x="520" y="275" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${p.muted}">Oversikt · siste 30 dager</text>
    ${[0, 1, 2].map((i) => `<rect x="${520 + i * 300}" y="310" width="270" height="0" rx="16" fill="${p.bg}"/>`).join("")}
    <polyline points="${points}" fill="none" stroke="${p.accent2}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    ${bars}
    <rect x="1320" y="190" width="120" height="120" rx="60" fill="none" stroke="${p.accent}" stroke-width="18" stroke-dasharray="260 400"/>
    <text x="1380" y="262" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="${p.ink}">${Math.round(40 + r() * 55)}%</text>`,
  );
}

// To mobilskjermer ved siden av hverandre.
function mobile(title: string, p: Palette, seed: number) {
  const r = rand(seed);
  const phone = (x: number, y: number, rot: number, variant: number) => {
    const rows = Array.from({ length: 5 }, (_, i) => {
      const yy = 330 + i * 92;
      return `<rect x="30" y="${yy}" width="330" height="76" rx="18" fill="${p.bg}" opacity="0.7"/>
        <rect x="46" y="${yy + 16}" width="44" height="44" rx="12" fill="${i % 2 ? p.accent : p.accent2}"/>
        <rect x="104" y="${yy + 20}" width="${120 + r() * 100}" height="14" rx="7" fill="${p.ink}" opacity="0.85"/>
        <rect x="104" y="${yy + 44}" width="${80 + r() * 80}" height="10" rx="5" fill="${p.muted}" opacity="0.7"/>`;
    }).join("");
    return `<g transform="translate(${x} ${y}) rotate(${rot} 195 400)" filter="url(#shadow)">
      <rect width="390" height="800" rx="56" fill="#0a0a0a"/>
      <rect x="14" y="14" width="362" height="772" rx="44" fill="${p.panel}"/>
      <rect x="150" y="30" width="90" height="24" rx="12" fill="#0a0a0a"/>
      <text x="36" y="130" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="${p.ink}">${esc(variant === 0 ? title : "Detaljer")}</text>
      <rect x="30" y="160" width="330" height="140" rx="24" fill="${variant === 0 ? p.accent : p.accent2}"/>
      <text x="52" y="230" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="800" fill="${p.bg}">${variant === 0 ? "12:30" : "4,8 ★"}</text>
      <text x="52" y="270" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="${p.bg}" opacity="0.8">${variant === 0 ? "Neste avtale" : "Vurderinger"}</text>
      ${rows}
      <rect x="30" y="720" width="330" height="48" rx="24" fill="${p.bg}" opacity="0.8"/>
    </g>`;
  };
  return frame(
    p,
    `<circle cx="1300" cy="200" r="260" fill="${p.accent}" opacity="0.12"/>
     <circle cx="260" cy="880" r="200" fill="${p.accent2}" opacity="0.1"/>
     ${phone(430, 110, -6, 0)}${phone(800, 90, 5, 1)}`,
  );
}

// Landingsside med stor overskrift.
function landing(title: string, p: Palette, seed: number) {
  const r = rand(seed);
  return frame(
    p,
    `<g filter="url(#shadow)"><rect x="140" y="80" width="1320" height="860" rx="24" fill="${p.panel}"/></g>
    <rect x="140" y="80" width="1320" height="70" rx="24" fill="${p.panel}"/>
    <text x="190" y="128" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="800" fill="${p.ink}">${esc(title.split(" ")[0].toLowerCase())}</text>
    ${[0, 1, 2, 3].map((i) => `<rect x="${860 + i * 120}" y="108" width="90" height="16" rx="8" fill="${p.muted}" opacity="0.5"/>`).join("")}
    <text x="190" y="360" font-family="Georgia, serif" font-size="96" font-style="italic" fill="${p.ink}">${esc(title)}</text>
    <text x="190" y="440" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="${p.muted}">Laget med omtanke, fra idé til lansering.</text>
    <rect x="190" y="500" width="240" height="70" rx="35" fill="${p.accent}"/>
    <text x="310" y="545" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="${p.panel}">Kom i gang</text>
    ${[0, 1, 2].map((i) => `<rect x="${190 + i * 420}" y="640" width="380" height="240" rx="20" fill="${i === 1 ? p.accent2 : p.bg}" opacity="${0.5 + r() * 0.5}"/>`).join("")}
    <circle cx="1240" cy="380" r="150" fill="${p.accent2}" opacity="0.55"/>
    <rect x="1120" y="300" width="200" height="200" rx="40" fill="${p.accent}" opacity="0.8" transform="rotate(12 1220 400)"/>`,
  );
}

// Kart med markører.
function map(title: string, p: Palette, seed: number) {
  const r = rand(seed);
  const roads = Array.from({ length: 9 }, () => {
    const y1 = r() * H;
    const y2 = r() * H;
    return `<path d="M0 ${y1} C ${W * 0.3} ${y1 + 120}, ${W * 0.6} ${y2 - 140}, ${W} ${y2}" stroke="${p.muted}" stroke-opacity="0.35" stroke-width="${6 + r() * 10}" fill="none"/>`;
  }).join("");
  const pins = Array.from({ length: 9 }, () => {
    const x = 200 + r() * 1200;
    const y = 180 + r() * 640;
    return `<g transform="translate(${x} ${y})"><circle r="34" fill="${p.accent}" opacity="0.25"/><circle r="14" fill="${p.accent}"/><circle r="5" fill="${p.panel}"/></g>`;
  }).join("");
  return frame(
    p,
    `<path d="M0 620 C 300 520, 520 760, 820 640 S 1300 480, 1600 600 L1600 1000 L0 1000Z" fill="${p.accent2}" opacity="0.12"/>
    ${roads}${pins}
    <g filter="url(#shadow)"><rect x="80" y="80" width="460" height="230" rx="24" fill="${p.panel}"/></g>
    <text x="120" y="150" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="${p.ink}">${esc(title)}</text>
    <text x="120" y="195" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${p.muted}">9 steder i nærheten</text>
    <rect x="120" y="230" width="220" height="44" rx="22" fill="${p.accent}"/>`,
  );
}

// Kodeeditor med syntaksfarger.
function editor(title: string, p: Palette, seed: number) {
  const r = rand(seed);
  const colors = [p.accent, p.accent2, p.muted, p.ink];
  const lines = Array.from({ length: 16 }, (_, i) => {
    let x = 250 + (i % 4 === 0 ? 0 : 40 * ((i % 3) + 1));
    return Array.from({ length: 2 + Math.floor(r() * 4) }, () => {
      const w = 40 + r() * 170;
      const seg = `<rect x="${x}" y="${220 + i * 42}" width="${w}" height="16" rx="8" fill="${colors[Math.floor(r() * colors.length)]}" opacity="0.8"/>`;
      x += w + 16;
      return seg;
    }).join("");
  }).join("");
  return frame(
    p,
    `<g filter="url(#shadow)"><rect x="100" y="90" width="1400" height="830" rx="22" fill="#0d1117"/></g>
    <rect x="100" y="90" width="1400" height="54" rx="22" fill="#161b22"/>
    <text x="150" y="126" font-family="Menlo, monospace" font-size="20" fill="#8b949e">${esc(title.toLowerCase().replace(/\s+/g, "-"))}/src/index.ts</text>
    ${Array.from({ length: 16 }, (_, i) => `<text x="170" y="${234 + i * 42}" font-family="Menlo, monospace" font-size="18" fill="#484f58">${i + 1}</text>`).join("")}
    ${lines}
    <rect x="1080" y="640" width="380" height="240" rx="18" fill="${p.accent}" opacity="0.12" stroke="${p.accent}" stroke-opacity="0.5"/>
    <text x="1110" y="690" font-family="Menlo, monospace" font-size="20" fill="${p.accent}">✓ 42 tester bestått</text>`,
  );
}

const TEMPLATES = { dashboard, mobile, landing, map, editor } as const;
export type Template = keyof typeof TEMPLATES;

export async function projectImage(template: Template, title: string, palette: keyof typeof PALETTES, seed: number) {
  const svg = TEMPLATES[template](title, PALETTES[palette], seed);
  return sharp(Buffer.from(svg)).webp({ quality: 86 }).toBuffer();
}

// Abstrakt profilbilde: sirkler i to farger.
export async function avatarImage(a: string, b: string, seed: number) {
  const r = rand(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="400" height="400" fill="url(#g)"/>
    <circle cx="${120 + r() * 160}" cy="${130 + r() * 60}" r="${70 + r() * 30}" fill="#ffffff" opacity="0.28"/>
    <ellipse cx="200" cy="${400 + r() * 20}" rx="${150 + r() * 40}" ry="150" fill="#071a52" opacity="0.35"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}
