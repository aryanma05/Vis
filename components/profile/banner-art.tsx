import type { ReactNode } from "react";
import type { BannerArt } from "@/lib/profile-style";

// De ferdige bannerbildene, tegnet som SVG (1600 × 400) så de er skarpe i alle
// størrelser. Alt «tilfeldig» kommer fra en fast frøverdi, så serveren og nettleseren
// tegner nøyaktig det samme. `u` gjør id-ene unike når flere bannere vises på én side.

const W = 1600;
const H = 400;

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, min: number, max: number) => min + r() * (max - min);
const f = (n: number) => n.toFixed(1);

function stars(seed: number, count: number, maxY: number, color = "#ffffff") {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => (
    <circle key={`s${i}`} cx={f(r() * W)} cy={f(r() * maxY)} r={f(between(r, 0.5, 1.7))} fill={color} opacity={f(between(r, 0.25, 0.95))} />
  ));
}

// Fjellrygg i «low poly»: annenhver topp og dal, rette streker mellom.
function ridge(seed: number, base: number, amp: number) {
  const r = rng(seed);
  let d = `M -60 ${H} L -60 ${base}`;
  let peak = r() > 0.5;
  for (let x = -60; x < W + 60; ) {
    x += between(r, 50, 150);
    const y = peak ? base - amp * between(r, 0.55, 1) : base - amp * between(r, 0, 0.3);
    d += ` L ${f(x)} ${f(y)}`;
    peak = !peak;
  }
  return `${d} L ${W + 60} ${H} Z`;
}

function wave(base: number, amp: number, length: number, phase: number) {
  let d = `M -20 ${H} L -20 ${base}`;
  for (let x = -20; x <= W + 20; x += 20) d += ` L ${x} ${f(base + Math.sin((x / length) * Math.PI * 2 + phase) * amp)}`;
  return `${d} L ${W + 20} ${H} Z`;
}

function crest(base: number, amp: number, length: number, phase: number) {
  let d = "";
  for (let x = -20; x <= W + 20; x += 20) d += `${x === -20 ? "M" : " L"} ${x} ${f(base + Math.sin((x / length) * Math.PI * 2 + phase) * amp)}`;
  return d;
}

const ARTS: Record<BannerArt, (u: string) => ReactNode> = {
  fjell: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1850" />
          <stop offset="0.48" stopColor="#8e4590" />
          <stop offset="0.8" stopColor="#f08a6c" />
          <stop offset="1" stopColor="#ffd59e" />
        </linearGradient>
        <radialGradient id={`${u}-glow`}>
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${u}-sky)`} />
      {stars(11, 40, 120)}
      <circle cx="1080" cy="255" r="230" fill={`url(#${u}-glow)`} />
      <circle cx="1080" cy="255" r="64" fill="#fff0c2" />
      <path d={ridge(3, 285, 150)} fill="#a35a8f" opacity="0.85" />
      <path d={ridge(7, 315, 120)} fill="#6e3a7e" />
      <path d={ridge(13, 345, 90)} fill="#432660" />
      <path d={ridge(21, 385, 60)} fill="#1e1640" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${520 + i * 34} ${120 + (i % 2) * 14} q 9 -8 18 0 q 9 -8 18 0`} stroke="#2a1a4a" strokeWidth="3" fill="none" strokeLinecap="round" />
      ))}
    </>
  ),

  nordlys: (u) => {
    const r = rng(5);
    return (
      <>
        <defs>
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#020617" />
            <stop offset="0.65" stopColor="#0a1a36" />
            <stop offset="1" stopColor="#0f3140" />
          </linearGradient>
          <linearGradient id={`${u}-a`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#10b981" />
            <stop offset="0.35" stopColor="#2dd4bf" />
            <stop offset="0.65" stopColor="#4ade80" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id={`${u}-b`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="0.5" stopColor="#f472b6" />
            <stop offset="1" stopColor="#34d399" />
          </linearGradient>
          <filter id={`${u}-blur`} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
        </defs>
        <rect width={W} height={H} fill={`url(#${u}-sky)`} />
        {stars(17, 140, 330)}
        <g filter={`url(#${u}-blur)`}>
          <path d="M -100 230 C 220 110, 420 280, 720 170 S 1220 110, 1700 210" stroke={`url(#${u}-a)`} strokeWidth="95" fill="none" opacity="0.85" />
          <path d="M -100 140 C 300 50, 640 210, 940 100 S 1420 40, 1700 120" stroke={`url(#${u}-b)`} strokeWidth="55" fill="none" opacity="0.55" />
        </g>
        <path d="M -100 230 C 220 110, 420 280, 720 170 S 1220 110, 1700 210" stroke="#bbf7d0" strokeWidth="1.5" fill="none" opacity="0.35" strokeDasharray="2 9" />
        <path d={`M 0 ${H} L 0 345 Q 260 300 520 340 T 1040 330 T 1600 335 L ${W} ${H} Z`} fill="#030712" />
        {Array.from({ length: 70 }, (_, i) => {
          const x = i * 24 + between(r, -8, 8);
          const h = between(r, 22, 56);
          const y = 352 + Math.sin(i / 5) * 10;
          return <path key={i} d={`M ${f(x)} ${f(y - h)} L ${f(x - h * 0.28)} ${f(y)} L ${f(x + h * 0.28)} ${f(y)} Z`} fill="#030712" />;
        })}
      </>
    );
  },

  blakopi: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-bg`} cx="0.5" cy="0.4" r="0.9">
          <stop offset="0" stopColor="#1756c4" />
          <stop offset="1" stopColor="#0a3485" />
        </radialGradient>
        <pattern id={`${u}-fine`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
        </pattern>
        <pattern id={`${u}-major`} width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ffffff" strokeOpacity="0.18" />
        </pattern>
        <marker id={`${u}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" fillOpacity="0.8" />
        </marker>
      </defs>
      <rect width={W} height={H} fill={`url(#${u}-bg)`} />
      <rect width={W} height={H} fill={`url(#${u}-fine)`} />
      <rect width={W} height={H} fill={`url(#${u}-major)`} />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.6">
        <circle cx="330" cy="190" r="110" />
        <circle cx="330" cy="190" r="62" />
        <circle cx="330" cy="190" r="140" strokeDasharray="6 7" strokeOpacity="0.4" />
        <path d="M 180 190 H 480 M 330 40 V 340" strokeOpacity="0.4" />
        <path d="M 220 345 H 440" markerStart={`url(#${u}-arrow)`} markerEnd={`url(#${u}-arrow)`} />
        <rect x="700" y="60" width="140" height="270" rx="24" />
        <rect x="714" y="88" width="112" height="210" rx="6" strokeOpacity="0.5" />
        <path d="M 730 112 H 800 M 730 130 H 780 M 730 210 H 810 M 730 228 H 790" strokeOpacity="0.5" />
        <rect x="730" y="150" width="80" height="44" rx="4" strokeOpacity="0.5" />
        <path d="M 870 60 V 330" markerStart={`url(#${u}-arrow)`} markerEnd={`url(#${u}-arrow)`} strokeOpacity="0.6" />
        <path d="M 1110 110 L 1200 160 L 1200 260 L 1110 310 L 1020 260 L 1020 160 Z" />
        <path d="M 1020 160 L 1110 210 L 1200 160 M 1110 210 V 310" />
        <path d="M 1110 110 L 1110 210" strokeDasharray="5 6" strokeOpacity="0.45" />
        <path d="M 1300 300 A 120 120 0 0 1 1420 180" strokeDasharray="3 6" strokeOpacity="0.5" />
        <path d="M 1300 300 L 1420 300 M 1300 300 L 1300 180" strokeOpacity="0.5" />
      </g>
      <g fill="#ffffff" fillOpacity="0.75" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="14">
        <text x="300" y="372">Ø 220</text>
        <text x="884" y="200">270</text>
        <text x="1312" y="172" fillOpacity="0.5">R 120</text>
        <text x="1380" y="372" fillOpacity="0.55" fontSize="12">VIS · BLAD 01 · 1:1</text>
      </g>
    </>
  ),

  terminal: (u) => {
    const r = rng(29);
    const colors = ["#c792ea", "#82aaff", "#c3e88d", "#f78c6c", "#89ddff", "#cbd5e1", "#cbd5e1"];
    let indent = 0;
    return (
      <>
        <defs>
          <linearGradient id={`${u}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0b1020" />
            <stop offset="1" stopColor="#131a2e" />
          </linearGradient>
          <radialGradient id={`${u}-glow`} cx="0.85" cy="0.1" r="0.6">
            <stop offset="0" stopColor="#4b93ff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#4b93ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${u}-bg)`} />
        <rect width={W} height={H} fill={`url(#${u}-glow)`} />
        <rect x="0" y="0" width="64" height={H} fill="#ffffff" opacity="0.03" />
        {Array.from({ length: 14 }, (_, line) => {
          const y = 34 + line * 26;
          if (r() < 0.12) return <text key={line} x="40" y={y + 9} textAnchor="end" fontSize="12" fill="#475569" fontFamily="ui-monospace, monospace">{line + 1}</text>;
          indent = Math.max(0, Math.min(4, indent + (r() < 0.3 ? 1 : r() < 0.3 ? -1 : 0)));
          let x = 96 + indent * 36;
          const tokens = Math.floor(between(r, 2, 7));
          return (
            <g key={line}>
              <text x="40" y={y + 9} textAnchor="end" fontSize="12" fill="#475569" fontFamily="ui-monospace, monospace">
                {line + 1}
              </text>
              {Array.from({ length: tokens }, (_, i) => {
                const w = between(r, 26, 150);
                const el = <rect key={i} x={f(x)} y={y} width={f(w)} height="11" rx="5.5" fill={colors[Math.floor(r() * colors.length)]} opacity="0.8" />;
                x += w + 12;
                return el;
              })}
              {line === 9 && (
                <rect x={f(x)} y={y - 3} width="10" height="17" fill="#e2e8f0">
                  <animate attributeName="opacity" values="1;1;0;0" dur="1.1s" repeatCount="indefinite" />
                </rect>
              )}
            </g>
          );
        })}
      </>
    );
  },

  havet: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5cc4f5" />
          <stop offset="0.7" stopColor="#c6ecff" />
          <stop offset="1" stopColor="#fff4d6" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${u}-sky)`} />
      <circle cx="1250" cy="96" r="80" fill="#fff6cf" opacity="0.5" />
      <circle cx="1250" cy="96" r="46" fill="#fff9e0" />
      {[
        [260, 90, 1],
        [680, 60, 0.8],
        [1500, 140, 0.9],
      ].map(([x, y, s], i) => (
        <g key={i} fill="#ffffff" opacity="0.9" transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx="0" cy="0" rx="70" ry="22" />
          <ellipse cx="-30" cy="-14" rx="34" ry="24" />
          <ellipse cx="22" cy="-20" rx="40" ry="30" />
        </g>
      ))}
      <path d={wave(215, 9, 420, 0)} fill="#7dd3fc" />
      <path d={wave(240, 12, 360, 1.4)} fill="#38bdf8" />
      <path d={wave(275, 15, 520, 2.6)} fill="#0ea5e9" />
      <path d={wave(310, 18, 460, 0.7)} fill="#0284c7" />
      <path d={wave(350, 20, 600, 2)} fill="#075985" />
      <path d={crest(310, 18, 460, 0.7)} stroke="#e0f2fe" strokeOpacity="0.55" strokeWidth="3" fill="none" strokeDasharray="40 30" />
      <path d={crest(350, 20, 600, 2)} stroke="#e0f2fe" strokeOpacity="0.45" strokeWidth="3" fill="none" strokeDasharray="60 40" />
    </>
  ),

  byen: (u) => {
    const layer = (seed: number, base: number, min: number, max: number, color: string, windows: boolean) => {
      const lr = rng(seed);
      const out: ReactNode[] = [];
      for (let x = -20; x < W; ) {
        const w = between(lr, 46, 120);
        const h = between(lr, min, max);
        const top = base - h;
        out.push(<rect key={`b${x}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 10)} fill={color} />);
        if (lr() < 0.25) out.push(<rect key={`a${x}`} x={f(x + w / 2 - 1)} y={f(top - 26)} width="2" height="26" fill={color} />);
        if (windows) {
          for (let wy = top + 14; wy < base - 14; wy += 22) {
            for (let wx = x + 10; wx < x + w - 14; wx += 16) {
              const lit = lr() < 0.28;
              out.push(<rect key={`w${f(wx)}-${f(wy)}`} x={f(wx)} y={f(wy)} width="7" height="10" rx="1" fill={lit ? "#ffd27a" : "#2c2858"} opacity={lit ? 0.9 : 0.7} />);
            }
          }
        }
        x += w + between(lr, 2, 10);
      }
      return out;
    };
    return (
      <>
        <defs>
          <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#090d24" />
            <stop offset="0.6" stopColor="#1e1b4b" />
            <stop offset="1" stopColor="#4a2f73" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${u}-sky)`} />
        {stars(43, 90, 200)}
        <circle cx="1320" cy="92" r="34" fill="#fef6c8" />
        <circle cx="1308" cy="84" r="6" fill="#efe4a8" />
        <circle cx="1332" cy="104" r="4" fill="#efe4a8" />
        <circle cx="1320" cy="92" r="70" fill="#fef6c8" opacity="0.08" />
        {layer(7, 330, 90, 200, "#2b275c", false)}
        {layer(19, 370, 90, 210, "#1a1740", true)}
        {layer(31, 410, 50, 140, "#0c0a22", true)}
      </>
    );
  },

  kosmos: (u) => (
    <>
      <defs>
        <radialGradient id={`${u}-bg`} cx="0.45" cy="0.5" r="0.8">
          <stop offset="0" stopColor="#1c1238" />
          <stop offset="1" stopColor="#04030c" />
        </radialGradient>
        <linearGradient id={`${u}-planet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd38a" />
          <stop offset="0.6" stopColor="#e2723b" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
        <clipPath id={`${u}-clip`}>
          <circle cx="1180" cy="210" r="88" />
        </clipPath>
        {/* Den fremre halvdelen av ringen (i ringens egne, roterte koordinater). */}
        <clipPath id={`${u}-front`}>
          <rect x="990" y="210" width="380" height="60" />
        </clipPath>
        <filter id={`${u}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${u}-bg)`} />
      <g filter={`url(#${u}-blur)`}>
        <ellipse cx="420" cy="200" rx="260" ry="110" fill="#7c3aed" opacity="0.55" />
        <ellipse cx="640" cy="260" rx="220" ry="90" fill="#db2777" opacity="0.4" />
        <ellipse cx="260" cy="110" rx="160" ry="70" fill="#0ea5e9" opacity="0.35" />
      </g>
      {stars(53, 220, H)}
      {[
        [880, 90],
        [140, 300],
        [1460, 70],
      ].map(([x, y], i) => (
        <path key={i} d={`M ${x - 9} ${y} H ${x + 9} M ${x} ${y - 9} V ${y + 9}`} stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
      ))}
      <g transform="rotate(-14 1180 210)">
        <ellipse cx="1180" cy="210" rx="170" ry="34" fill="none" stroke="#fde68a" strokeOpacity="0.45" strokeWidth="7" />
      </g>
      <circle cx="1180" cy="210" r="88" fill={`url(#${u}-planet)`} />
      <g clipPath={`url(#${u}-clip)`} opacity="0.25">
        <rect x="1080" y="170" width="220" height="12" fill="#7c2d12" transform="rotate(-14 1180 210)" />
        <rect x="1080" y="215" width="220" height="18" fill="#fff1d6" transform="rotate(-14 1180 210)" />
        <rect x="1080" y="250" width="220" height="9" fill="#7c2d12" transform="rotate(-14 1180 210)" />
      </g>
      <g transform="rotate(-14 1180 210)">
        <ellipse cx="1180" cy="210" rx="170" ry="34" fill="none" stroke="#fde68a" strokeOpacity="0.9" strokeWidth="7" clipPath={`url(#${u}-front)`} />
      </g>
      <circle cx="420" cy="96" r="20" fill="#cbd5e1" />
      <circle cx="414" cy="90" r="4" fill="#94a3b8" />
      <circle cx="428" cy="104" r="3" fill="#94a3b8" />
    </>
  ),

  synth: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12062e" />
          <stop offset="0.55" stopColor="#5b1a78" />
          <stop offset="1" stopColor="#ef5a8f" />
        </linearGradient>
        <linearGradient id={`${u}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe66d" />
          <stop offset="1" stopColor="#ff4f9a" />
        </linearGradient>
        <mask id={`${u}-cut`}>
          <rect width={W} height={H} fill="#ffffff" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x="0" y={190 + i * 13 + i * i} width={W} height={2 + i * 1.6} fill="#000000" />
          ))}
        </mask>
      </defs>
      <rect width={W} height={260} fill={`url(#${u}-sky)`} />
      {stars(61, 70, 160)}
      <circle cx="800" cy="250" r="140" fill={`url(#${u}-sun)`} mask={`url(#${u}-cut)`} />
      <path d={ridge(67, 262, 70)} fill="#2a0e4d" />
      <rect x="0" y="258" width={W} height={H - 258} fill="#14052b" />
      <g stroke="#ff4fd8" strokeOpacity="0.75" strokeWidth="1.6">
        {Array.from({ length: 9 }, (_, i) => {
          const y = 260 + Math.pow(i, 1.75) * 4.2;
          return <path key={`h${i}`} d={`M 0 ${f(y)} H ${W}`} />;
        })}
        {Array.from({ length: 31 }, (_, i) => {
          const k = i - 15;
          return <path key={`v${i}`} d={`M ${800 + k * 30} 260 L ${800 + k * 210} ${H}`} />;
        })}
      </g>
      <rect x="0" y="252" width={W} height="10" fill="#ff4fd8" opacity="0.25" />
    </>
  ),

  lekent: () => {
    const r = rng(73);
    const palette = ["#ff6b6b", "#4dabf7", "#ffd43b", "#51cf66", "#845ef7", "#1a1a1a"];
    const shapes: ReactNode[] = [];
    const cols = 11;
    const rows = 3;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = (col + 0.5) * (W / cols) + between(r, -40, 40);
        const cy = (row + 0.5) * (H / rows) + between(r, -30, 30);
        const color = palette[Math.floor(r() * palette.length)];
        const rot = Math.floor(between(r, -40, 40));
        const kind = Math.floor(r() * 6);
        const key = `${row}-${col}`;
        if (kind === 0) shapes.push(<circle key={key} cx={f(cx)} cy={f(cy)} r={f(between(r, 14, 30))} fill={color} />);
        else if (kind === 1)
          shapes.push(<path key={key} d="M -26 14 L 0 -26 L 26 14 Z" fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" transform={`translate(${f(cx)} ${f(cy)}) rotate(${rot})`} />);
        else if (kind === 2)
          shapes.push(<path key={key} d="M -40 0 q 10 -16 20 0 t 20 0 t 20 0 t 20 0" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" transform={`translate(${f(cx)} ${f(cy)}) rotate(${rot})`} />);
        else if (kind === 3) shapes.push(<rect key={key} x="-16" y="-16" width="32" height="32" rx="4" fill={color} transform={`translate(${f(cx)} ${f(cy)}) rotate(${rot})`} />);
        else if (kind === 4)
          shapes.push(
            <g key={key} fill={color} transform={`translate(${f(cx)} ${f(cy)}) rotate(${rot})`}>
              {[0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => <circle key={`${i}${j}`} cx={i * 12 - 12} cy={j * 12 - 12} r="3" />))}
            </g>,
          );
        else shapes.push(<path key={key} d="M -26 10 A 26 26 0 0 1 26 10 Z" fill={color} transform={`translate(${f(cx)} ${f(cy)}) rotate(${rot})`} />);
      }
    }
    return (
      <>
        <rect width={W} height={H} fill="#fff3d9" />
        {shapes}
      </>
    );
  },
};

export default function BannerArtSvg({ art, uid }: { art: BannerArt; uid: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
      {ARTS[art](uid)}
    </svg>
  );
}
