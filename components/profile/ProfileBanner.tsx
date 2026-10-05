import type { ReactNode } from "react";
import BannerArtSvg from "@/components/profile/banner-art";
import { BANNER_GRADIENTS, isLightColor, type BannerConfig, type BannerPattern } from "@/lib/profile-style";

// Banneret øverst på profilen. Fyller elementet det ligger i (som må være `relative`).
// Brukes både på profilen og i forhåndsvisningene i redigeringen; `uid` gjør SVG-id-ene unike.

const lighting = (color: string) =>
  `radial-gradient(120% 160% at 88% -20%, color-mix(in srgb, #ffffff 24%, ${color}) 0%, transparent 55%), linear-gradient(135deg, ${color} 0%, color-mix(in srgb, #000000 32%, ${color}) 100%)`;

// Høydekurver: ringer rundt noen få punkter, gjort ujevne med sinusbølger.
function contours(ink: string) {
  const centers = [
    [260, 120, 0.4],
    [900, 330, 2.1],
    [1420, 60, 4.2],
  ];
  return centers.flatMap(([cx, cy, phase], c) =>
    Array.from({ length: 13 }, (_, k) => {
      const base = 18 + k * 22;
      let d = "";
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const r = base * (1 + 0.16 * Math.sin(3 * a + phase + k * 0.25) + 0.08 * Math.sin(5 * a - phase));
        d += `${i === 0 ? "M" : "L"} ${(cx + Math.cos(a) * r * 1.5).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
      }
      return <path key={`${c}-${k}`} d={`${d}Z`} fill="none" stroke={ink} strokeWidth={k % 4 === 0 ? 1.6 : 1} />;
    }),
  );
}

function PatternLayer({ pattern, color, uid }: { pattern: BannerPattern; color: string; uid: string }) {
  const ink = isLightColor(color) ? "rgb(0 0 0 / 0.18)" : "rgb(255 255 255 / 0.22)";
  const id = `${uid}-p`;
  const tiles: Record<Exclude<BannerPattern, "topografi">, { w: number; h: number; body: ReactNode }> = {
    prikker: { w: 22, h: 22, body: <circle cx="11" cy="11" r="2.2" fill={ink} /> },
    rutenett: { w: 32, h: 32, body: <path d="M 32 0 L 0 0 0 32" fill="none" stroke={ink} strokeWidth="1.2" /> },
    striper: { w: 18, h: 18, body: <path d="M -4 22 L 22 -4 M -4 4 L 4 -4 M 14 22 L 22 14" stroke={ink} strokeWidth="5" /> },
    bolger: { w: 60, h: 24, body: <path d="M 0 12 Q 15 2 30 12 T 60 12" fill="none" stroke={ink} strokeWidth="2" /> },
    sjakk: {
      w: 40,
      h: 40,
      body: (
        <>
          <rect width="20" height="20" fill={ink} />
          <rect x="20" y="20" width="20" height="20" fill={ink} />
        </>
      ),
    },
    sirkler: {
      w: 44,
      h: 44,
      body: (
        <>
          <circle cx="22" cy="22" r="15" fill="none" stroke={ink} strokeWidth="1.6" />
          <circle cx="22" cy="22" r="7" fill="none" stroke={ink} strokeWidth="1.6" />
        </>
      ),
    },
    pluss: { w: 30, h: 30, body: <path d="M 15 9 V 21 M 9 15 H 21" stroke={ink} strokeWidth="2.4" strokeLinecap="round" /> },
  };

  // Høydekurvene skaleres med banneret; de andre mønstrene har fast størrelse i piksler.
  if (pattern === "topografi") {
    return (
      <svg viewBox="0 0 1600 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        {contours(ink)}
      </svg>
    );
  }
  return (
    <svg className="absolute inset-0 size-full" aria-hidden="true">
      <defs>
        <pattern id={id} width={tiles[pattern].w} height={tiles[pattern].h} patternUnits="userSpaceOnUse">
          {tiles[pattern].body}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

// Standardbanneret: aksentfargen som lys, et svakt rutenett og to sirkler.
function AccentLayer({ accent }: { accent: string }) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 130% at 88% -10%, color-mix(in srgb, ${accent} 55%, transparent), transparent 70%), radial-gradient(55% 110% at 0% 110%, color-mix(in srgb, ${accent} 22%, transparent), transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 [mask-image:radial-gradient(90%_120%_at_70%_0%,black,transparent_75%)]"
        style={{
          backgroundImage: `linear-gradient(color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -bottom-28 right-[10%] size-72 rounded-full border md:size-96" style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }} />
      <div className="absolute -bottom-44 right-[4%] size-[26rem] rounded-full border md:size-[34rem]" style={{ borderColor: `color-mix(in srgb, ${accent} 25%, transparent)` }} />
    </>
  );
}

export default function ProfileBanner({ banner, accent, uid = "banner" }: { banner: BannerConfig | null; accent: string; uid?: string }) {
  const b = banner ?? { type: "accent" as const };
  switch (b.type) {
    case "color":
      return <div className="absolute inset-0" style={{ background: lighting(b.color) }} />;
    case "gradient":
      return <div className="absolute inset-0" style={{ background: BANNER_GRADIENTS[b.gradient].css }} />;
    case "pattern":
      return (
        <div className="absolute inset-0" style={{ background: lighting(b.color) }}>
          <PatternLayer pattern={b.pattern} color={b.color} uid={uid} />
        </div>
      );
    case "art":
      return <BannerArtSvg art={b.art} uid={uid} />;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={b.url} alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: `50% ${b.y}%` }} />;
    default:
      return <AccentLayer accent={accent} />;
  }
}
