"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { PET_COLORS, type PetAccessory, type PetConfig, type PetSpecies } from "@/lib/profile-style";

// Kjæledyret tegnet i SVG (120 × 120). Alle artene deler samme «mochi»-kropp, så
// tilbehøret sitter likt på alle. Bevegelsen (blunk, øyne, pust og hale) styres utenfra.

type Palette = { body: string; shade: string; belly: string };

const DARK = "#2b2b33";
const NOSE = "#3d2f33";
const PINK = "#ffb3c1";

const BODY = "M 60 44 C 84 44 94 62 93 80 C 92 97 78 104 60 104 C 42 104 28 97 27 80 C 26 62 36 44 60 44 Z";

export const EYES: Record<PetSpecies, [[number, number], [number, number]]> = {
  katt: [[49, 72], [71, 72]],
  hund: [[49, 71], [71, 71]],
  rev: [[49, 71], [71, 71]],
  kanin: [[49, 72], [71, 72]],
  bjorn: [[49, 71], [71, 71]],
  panda: [[48, 71], [72, 71]],
  ugle: [[48, 70], [72, 70]],
  robot: [[49, 70], [71, 70]],
};

function Ears({ species, c }: { species: PetSpecies; c: Palette }) {
  switch (species) {
    case "katt":
      return (
        <>
          <path d="M 34 60 L 37 29 L 56 47 Z" fill={c.body} />
          <path d="M 86 60 L 83 29 L 64 47 Z" fill={c.body} />
          <path d="M 38 53 L 39.5 36 L 50 46 Z" fill={PINK} />
          <path d="M 82 53 L 80.5 36 L 70 46 Z" fill={PINK} />
        </>
      );
    case "rev":
      return (
        <>
          <path d="M 32 62 L 35 22 L 57 46 Z" fill={c.body} />
          <path d="M 88 62 L 85 22 L 63 46 Z" fill={c.body} />
          <path d="M 34.4 31 L 35 22 L 41.2 28.8 Z" fill={DARK} />
          <path d="M 85.6 31 L 85 22 L 78.8 28.8 Z" fill={DARK} />
          <path d="M 37 55 L 38.5 34 L 51 47 Z" fill={c.belly} />
          <path d="M 83 55 L 81.5 34 L 69 47 Z" fill={c.belly} />
        </>
      );
    case "kanin":
      return (
        <>
          <ellipse cx="46" cy="28" rx="7.5" ry="21" fill={c.body} transform="rotate(-12 46 28)" />
          <ellipse cx="74" cy="28" rx="7.5" ry="21" fill={c.body} transform="rotate(12 74 28)" />
          <ellipse cx="46" cy="29" rx="3.6" ry="15" fill={PINK} transform="rotate(-12 46 28)" />
          <ellipse cx="74" cy="29" rx="3.6" ry="15" fill={PINK} transform="rotate(12 74 28)" />
        </>
      );
    case "bjorn":
    case "panda": {
      const outer = species === "panda" ? DARK : c.body;
      const inner = species === "panda" ? "#44444f" : c.shade;
      return (
        <>
          <circle cx="37" cy="50" r="9.5" fill={outer} />
          <circle cx="83" cy="50" r="9.5" fill={outer} />
          <circle cx="37" cy="50" r="4.6" fill={inner} />
          <circle cx="83" cy="50" r="4.6" fill={inner} />
        </>
      );
    }
    case "ugle":
      return (
        <>
          <path d="M 36 56 L 33 36 L 49 48 Z" fill={c.shade} />
          <path d="M 84 56 L 87 36 L 71 48 Z" fill={c.shade} />
        </>
      );
    default:
      return null;
  }
}

function Tail({ species, c }: { species: PetSpecies; c: Palette }) {
  switch (species) {
    case "katt":
      return <path d="M 86 94 C 106 93 108 70 99 61" stroke={c.body} strokeWidth="7" strokeLinecap="round" fill="none" />;
    case "hund":
      return <path d="M 86 92 C 98 89 101 79 97 72" stroke={c.body} strokeWidth="6.5" strokeLinecap="round" fill="none" />;
    case "rev":
      return (
        <>
          <path d="M 82 94 C 108 98 118 72 106 52 C 103 66 94 78 82 82 Z" fill={c.body} />
          <path d="M 106 52 C 111 58 112 66 109 72 C 105 68 103 60 106 52 Z" fill={c.belly} />
        </>
      );
    case "kanin":
      return <circle cx="90" cy="93" r="7" fill={c.belly} />;
    case "bjorn":
    case "panda":
      return <circle cx="90" cy="95" r="4.5" fill={species === "panda" ? DARK : c.shade} />;
    case "ugle":
      return <path d="M 52 102 L 60 112 L 68 102 Z" fill={c.shade} />;
    default:
      return null;
  }
}

// Ansiktet utenom øynene: snute, nese, munn og kinn.
function Face({ species, c }: { species: PetSpecies; c: Palette }) {
  const cheeks = (
    <>
      <ellipse cx="40" cy="81" rx="4.6" ry="2.7" fill="#ff8fa3" opacity="0.45" />
      <ellipse cx="80" cy="81" rx="4.6" ry="2.7" fill="#ff8fa3" opacity="0.45" />
    </>
  );
  const smile = <path d="M 55.5 80 Q 57.8 82.6 60 80 Q 62.2 82.6 64.5 80" stroke={NOSE} strokeWidth="1.4" strokeLinecap="round" fill="none" />;
  switch (species) {
    case "katt":
      return (
        <>
          <path d="M 56 51 L 57 56 M 60 50 L 60 56 M 64 51 L 63 56" stroke={c.shade} strokeWidth="2" strokeLinecap="round" />
          {cheeks}
          <path d="M 58 76.6 L 62 76.6 L 60 79 Z" fill={NOSE} />
          {smile}
          <path d="M 39 77 L 27 74.5 M 39 80 L 27 81 M 81 77 L 93 74.5 M 81 80 L 93 81" stroke={c.shade} strokeWidth="1" strokeLinecap="round" opacity="0.8" />
        </>
      );
    case "hund":
      return (
        <>
          <ellipse cx="71" cy="69" rx="8.5" ry="7.5" fill={c.shade} opacity="0.55" />
          <ellipse cx="60" cy="81" rx="10.5" ry="7.5" fill={c.belly} />
          {cheeks}
          <ellipse cx="60" cy="77.2" rx="3.6" ry="2.5" fill={NOSE} />
          <path d="M 60 79.5 V 82 M 56 82 Q 60 85 64 82" stroke={NOSE} strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <path d="M 58 84 Q 60 89.5 62 84 Z" fill="#ff7b93" />
          <path d="M 37 52 C 23 50 17 71 23 81 C 27 88 36 81 38 70 Z" fill={c.shade} />
          <path d="M 83 52 C 97 50 103 71 97 81 C 93 88 84 81 82 70 Z" fill={c.shade} />
        </>
      );
    case "rev":
      return (
        <>
          <path d="M 29 77 C 40 70 50 75 60 83 C 70 75 80 70 91 77 C 87 95 75 103 60 103 C 45 103 33 95 29 77 Z" fill={c.belly} />
          {cheeks}
          <ellipse cx="60" cy="81" rx="3.2" ry="2.3" fill={NOSE} />
          <path d="M 57 85 Q 60 87.5 63 85" stroke={NOSE} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </>
      );
    case "kanin":
      return (
        <>
          {cheeks}
          <path d="M 58.2 77 L 61.8 77 L 60 79 Z" fill="#ff8fa3" />
          {smile}
          <rect x="58.3" y="81.4" width="3.4" height="3.6" rx="0.8" fill="#ffffff" stroke={c.shade} strokeWidth="0.6" />
        </>
      );
    case "bjorn":
    case "panda":
      return (
        <>
          {species === "panda" && (
            <>
              <ellipse cx="48" cy="71" rx="6.8" ry="8.4" fill={DARK} transform="rotate(28 48 71)" />
              <ellipse cx="72" cy="71" rx="6.8" ry="8.4" fill={DARK} transform="rotate(-28 72 71)" />
            </>
          )}
          <ellipse cx="60" cy="81" rx="10.5" ry="7.5" fill={species === "panda" ? "#ffffff" : c.belly} />
          {cheeks}
          <ellipse cx="60" cy="77.6" rx="3.8" ry="2.6" fill={NOSE} />
          <path d="M 60 80 V 82 M 56.5 82.5 Q 60 85 63.5 82.5" stroke={NOSE} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </>
      );
    case "ugle":
      return (
        <>
          <circle cx="48" cy="70" r="10.5" fill={c.belly} />
          <circle cx="72" cy="70" r="10.5" fill={c.belly} />
          <path d="M 56.5 78 L 63.5 78 L 60 84.5 Z" fill="#f59f00" />
          {cheeks}
          <path d="M 50 92 l 3 3 l 3 -3 M 57 96 l 3 3 l 3 -3 M 64 92 l 3 3 l 3 -3" stroke={c.shade} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <ellipse cx="29" cy="83" rx="6.5" ry="14" fill={c.shade} transform="rotate(14 29 83)" />
          <ellipse cx="91" cy="83" rx="6.5" ry="14" fill={c.shade} transform="rotate(-14 91 83)" />
        </>
      );
    default:
      return null;
  }
}

function Accessory({ kind, species }: { kind: PetAccessory; species: PetSpecies }) {
  const [[lx, ly], [rx, ry]] = EYES[species];
  const lens = species === "ugle" ? 11.5 : 7.4;
  switch (kind) {
    case "sloyfe":
      return (
        <g transform="translate(77 49) rotate(18)">
          <path d="M 0 0 L -11 -7 L -11 7 Z" fill="#ff6b8b" />
          <path d="M 0 0 L 11 -7 L 11 7 Z" fill="#ff6b8b" />
          <circle r="3.4" fill="#e64980" />
        </g>
      );
    case "caps":
      return (
        <>
          <ellipse cx="80" cy="49.5" rx="19" ry="3.8" fill="#2f6fd6" />
          <path d="M 38 50 C 38 30 82 30 82 50 Z" fill="#4b93ff" />
          <path d="M 60 33 V 50" stroke="#2f6fd6" strokeWidth="1.2" />
          <circle cx="60" cy="33.5" r="2.4" fill="#2f6fd6" />
        </>
      );
    case "lue":
      return (
        <>
          <path d="M 37 54 C 35 27 85 27 83 54 Z" fill="#e03131" />
          <rect x="35" y="48" width="50" height="9" rx="4.5" fill="#c92a2a" />
          {[40, 46, 52, 58, 64, 70, 76].map((x) => (
            <path key={x} d={`M ${x + 2} 49.5 V 55.5`} stroke="#a51d1d" strokeWidth="1.3" />
          ))}
          <circle cx="60" cy="27" r="6.5" fill="#ffffff" />
        </>
      );
    case "briller":
      return (
        <g fill="rgb(255 255 255 / 0.18)" stroke="#1d1d22" strokeWidth="2">
          <circle cx={lx} cy={ly} r={lens} />
          <circle cx={rx} cy={ry} r={lens} />
          <path d={`M ${lx + lens} ${ly} Q 60 ${ly - 3} ${rx - lens} ${ry}`} fill="none" />
          <path d={`M ${lx - lens} ${ly - 1} L 29 ${ly - 4} M ${rx + lens} ${ry - 1} L 91 ${ry - 4}`} fill="none" />
        </g>
      );
    case "hodetelefoner":
      return (
        <>
          <path d="M 28 68 C 26 30 94 30 92 68" stroke="#25252d" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="21" y="60" width="11" height="18" rx="5" fill="#4b93ff" />
          <rect x="88" y="60" width="11" height="18" rx="5" fill="#4b93ff" />
        </>
      );
    case "skjerf":
      return (
        <>
          <path d="M 29 88 C 45 97 75 97 91 88 L 91 96 C 75 105 45 105 29 96 Z" fill="#f76707" />
          <path d="M 40 93 L 40 100 M 52 95.5 L 52 102.5 M 68 95.5 L 68 102.5 M 80 93 L 80 100" stroke="#ffd8a8" strokeWidth="2.4" />
          <rect x="68" y="96" width="10" height="17" rx="3" fill="#e8590c" transform="rotate(10 73 96)" />
        </>
      );
    case "partyhatt":
      return (
        <g transform="rotate(-14 60 50)">
          <path d="M 47 51 L 60 15 L 73 51 Z" fill="#845ef7" />
          <path d="M 51 40 L 69 40 M 54.5 30 L 65.5 30" stroke="#ffd43b" strokeWidth="2.5" />
          <ellipse cx="60" cy="51" rx="13.5" ry="3" fill="#7048e8" />
          <circle cx="60" cy="15" r="4" fill="#ffd43b" />
        </g>
      );
    case "blomst":
      return (
        <g transform="translate(41 48)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5.5" rx="3.6" ry="5.4" fill="#ffffff" transform={`rotate(${a})`} />
          ))}
          <circle r="3.4" fill="#fcc419" />
        </g>
      );
    case "doktorhatt":
      return (
        <>
          <path d="M 44 50 L 76 50 L 74 40 L 46 40 Z" fill="#212529" />
          <path d="M 60 27 L 92 36 L 60 45 L 28 36 Z" fill="#343a40" />
          <path d="M 60 36 L 86 39 L 87 52" stroke="#fab005" strokeWidth="1.8" fill="none" />
          <rect x="84.5" y="51" width="5" height="7" rx="1.5" fill="#fab005" />
          <circle cx="60" cy="36" r="2" fill="#fab005" />
        </>
      );
    case "krone":
      return (
        <>
          <path d="M 43 49 L 43 30 L 52 39 L 60 25 L 68 39 L 77 30 L 77 49 Z" fill="#ffd43b" stroke="#e0a800" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="60" cy="42" r="3" fill="#e03131" />
          <circle cx="49" cy="44" r="2.2" fill="#4dabf7" />
          <circle cx="71" cy="44" r="2.2" fill="#4dabf7" />
        </>
      );
    default:
      return null;
  }
}

// Humøret styrer øynene: glad (^ ^), forelsket (hjerter), svimmel (spiraler),
// søvnig (lukket) og overrasket (store øyne).
export type PetMood = "normal" | "happy" | "love" | "dizzy" | "sleepy" | "surprised";

function MoodEye({ cx, cy, mood, ink }: { cx: number; cy: number; mood: Exclude<PetMood, "normal" | "surprised">; ink: string }) {
  switch (mood) {
    case "happy":
      return <path d={`M ${cx - 3.8} ${cy + 1.2} Q ${cx} ${cy - 4} ${cx + 3.8} ${cy + 1.2}`} stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none" />;
    case "sleepy":
      return <path d={`M ${cx - 3.6} ${cy + 0.4} Q ${cx} ${cy + 2.6} ${cx + 3.6} ${cy + 0.4}`} stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />;
    case "love":
      return (
        <motion.path
          d={`M ${cx} ${cy + 3.6} C ${cx - 6} ${cy - 0.6} ${cx - 3.4} ${cy - 5.6} ${cx} ${cy - 2.6} C ${cx + 3.4} ${cy - 5.6} ${cx + 6} ${cy - 0.6} ${cx} ${cy + 3.6} Z`}
          fill="#ff4d6d"
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" }}
        />
      );
    case "dizzy":
      return (
        <motion.path
          d={`M ${cx} ${cy} m -0.6 0 a 0.6 0.6 0 1 1 1.2 0 a 1.6 1.6 0 1 1 -3.2 0 a 2.6 2.6 0 1 1 5.2 0 a 3.6 3.6 0 1 1 -7.2 0`}
          stroke={ink}
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" }}
        />
      );
  }
}

function Eyes({ species, look, blink, mood }: { species: PetSpecies; look: { x: number; y: number }; blink: boolean; mood: PetMood }) {
  // Pandaen har øynene på svarte flekker, og roboten på en mørk skjerm: da må strekene være lyse.
  const ink = species === "robot" ? "#7df9ff" : species === "panda" ? "#ffffff" : "#1e1a1d";
  if (mood !== "normal" && mood !== "surprised") {
    return (
      <>
        {EYES[species].map(([cx, cy], i) => (
          <MoodEye key={`${mood}-${i}`} cx={cx} cy={cy} mood={mood} ink={ink} />
        ))}
      </>
    );
  }
  const big = mood === "surprised" ? 1.4 : 1;
  return (
    <>
      {EYES[species].map(([cx, cy], i) => (
        <motion.g
          key={i}
          animate={{ scaleY: blink ? 0.12 : big, scaleX: big, x: look.x, y: look.y }}
          transition={{ scaleY: { duration: 0.08 }, default: { type: "spring", stiffness: 260, damping: 20 } }}
          style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: "view-box" }}
        >
          {species === "robot" ? (
            <rect x={cx - 3.2} y={cy - 4.6} width="6.4" height="9.2" rx="3.2" fill="#7df9ff" />
          ) : species === "panda" ? (
            <>
              <circle cx={cx} cy={cy} r="3.3" fill="#ffffff" />
              <circle cx={cx} cy={cy} r="2.2" fill="#14141a" />
              <circle cx={cx + 0.9} cy={cy - 1} r="0.8" fill="#ffffff" />
            </>
          ) : (
            <>
              <ellipse cx={cx} cy={cy} rx={species === "ugle" ? 4.8 : 3.7} ry={species === "ugle" ? 4.8 : 4.3} fill="#1e1a1d" />
              <circle cx={cx + 1.2} cy={cy - 1.5} r={species === "ugle" ? 1.6 : 1.25} fill="#ffffff" />
            </>
          )}
        </motion.g>
      ))}
    </>
  );
}

// Ekstra rødme når dyret er glad eller blir klappet.
function Blush({ species, show }: { species: PetSpecies; show: boolean }) {
  const y = species === "robot" ? 93 : 81;
  return (
    <motion.g initial={false} animate={{ opacity: show ? 0.75 : 0 }} transition={{ duration: 0.3 }}>
      <ellipse cx="40" cy={y} rx="5.6" ry="3.2" fill="#ff6b8b" />
      <ellipse cx="80" cy={y} rx="5.6" ry="3.2" fill="#ff6b8b" />
    </motion.g>
  );
}

function Robot({ c, children }: { c: Palette; children: ReactNode }) {
  return (
    <>
      <path d="M 60 46 V 33" stroke={c.shade} strokeWidth="2.6" />
      <motion.circle
        cx="60"
        cy="31"
        r="4.2"
        fill="#ff6b6b"
        animate={{ opacity: [1, 0.45, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <rect x="23" y="63" width="8" height="16" rx="3" fill={c.shade} />
      <rect x="89" y="63" width="8" height="16" rx="3" fill={c.shade} />
      <rect x="40" y="99" width="12" height="7" rx="3" fill={c.shade} />
      <rect x="68" y="99" width="12" height="7" rx="3" fill={c.shade} />
      <rect x="29" y="46" width="62" height="56" rx="17" fill={c.body} />
      <rect x="29" y="88" width="62" height="14" rx="7" fill={c.shade} opacity="0.35" />
      <rect x="37" y="56" width="46" height="29" rx="10" fill="#101629" />
      {children}
      <path d="M 55 78 Q 60 81.5 65 78" stroke="#7df9ff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <ellipse cx="40" cy="93" rx="4" ry="2.4" fill="#ff8fa3" opacity="0.5" />
      <ellipse cx="80" cy="93" rx="4" ry="2.4" fill="#ff8fa3" opacity="0.5" />
    </>
  );
}

export default function PetSvg({
  pet,
  look = { x: 0, y: 0 },
  blink = false,
  wag = true,
  breathe = true,
  mood = "normal",
}: {
  pet: PetConfig;
  look?: { x: number; y: number };
  blink?: boolean;
  wag?: boolean;
  breathe?: boolean;
  mood?: PetMood;
}) {
  const c = PET_COLORS[pet.color];
  const s = pet.species;
  const eyes = <Eyes species={s} look={look} blink={blink} mood={mood} />;
  const sleepy = mood === "sleepy";
  // Glad og klappet: halen logrer fortere. Søvnig: rolig, dyp pust og stille hale.
  const excited = mood === "happy" || mood === "love";

  return (
    <svg viewBox="0 0 120 120" className="size-full overflow-visible" aria-hidden="true">
      <ellipse cx="60" cy="108" rx="27" ry="4.5" fill="#000000" opacity="0.2" />
      <motion.g
        animate={breathe ? { scaleY: sleepy ? [1, 1.06, 1] : [1, 1.03, 1], scaleX: sleepy ? [1, 0.98, 1] : [1, 0.99, 1] } : undefined}
        transition={{ duration: sleepy ? 4.2 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "60px", originY: "106px", transformBox: "view-box" }}
      >
        {s === "robot" ? (
          <Robot c={c}>
            {eyes}
            <Blush species={s} show={excited} />
          </Robot>
        ) : (
          <>
            <motion.g
              animate={wag && !sleepy ? { rotate: excited ? [-14, 16, -14] : [-7, 9, -7] } : { rotate: 0 }}
              transition={{ duration: excited ? 0.32 : s === "hund" ? 0.5 : 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ originX: "84px", originY: "92px", transformBox: "view-box" }}
            >
              <Tail species={s} c={c} />
            </motion.g>
            <Ears species={s} c={c} />
            {s === "panda" ? (
              <>
                <ellipse cx="46" cy="104" rx="8.5" ry="4.8" fill={DARK} />
                <ellipse cx="74" cy="104" rx="8.5" ry="4.8" fill={DARK} />
              </>
            ) : (
              <>
                <ellipse cx="46" cy="104" rx="8.5" ry="4.8" fill={s === "ugle" ? "#f59f00" : c.shade} />
                <ellipse cx="74" cy="104" rx="8.5" ry="4.8" fill={s === "ugle" ? "#f59f00" : c.shade} />
              </>
            )}
            <path d={BODY} fill={c.body} />
            {s !== "rev" && s !== "ugle" && <ellipse cx="60" cy="92" rx="17" ry="10" fill={s === "panda" ? "#ffffff" : c.belly} opacity="0.85" />}
            {s === "ugle" && <ellipse cx="60" cy="92" rx="18" ry="11" fill={c.belly} opacity="0.7" />}
            <Face species={s} c={c} />
            <Blush species={s} show={excited} />
            {eyes}
          </>
        )}
        <Accessory kind={pet.accessory} species={s} />
      </motion.g>
    </svg>
  );
}
