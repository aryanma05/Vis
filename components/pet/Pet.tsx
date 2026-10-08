"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, type TargetAndTransition } from "framer-motion";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { useT } from "@/components/LocaleProvider";
import PetSvg, { type PetMood } from "@/components/pet/PetSvg";
import { PET_SPECIES, type PetConfig, type PetSpecies } from "@/lib/profile-style";

const PHRASES = ["Har du sett prosjektene her?", "Klapp meg igjen!", "Jeg passer på profilen.", "Psst … følg {owner}!", "Hold inne for å klappe meg."];

// Hvor lenge man må holde inne før det blir klapping, og hvor lenge dyret venter før det sovner.
const PET_HOLD_MS = 420;
const SLEEP_AFTER_MS = 30_000;
// Så mange raske trykk på rad gjør dyret svimmelt, og dobbelt så mange gir fest.
const DIZZY_AT = 6;
const PARTY_AT = 12;

type ParticleKind = "float" | "burst" | "confetti" | "zzz";
type Particle = { id: number; kind: ParticleKind; char?: string; color: string; x: number; y: number; rotate: number; delay: number; size: number };

const HEART = "#ff6b8b";
const STAR = "#ffd43b";
const CONFETTI = ["#ff6b8b", "#ffd43b", "#4dabf7", "#69db7c", "#b197fc", "#ffa94d"];

type Trick = "hopp" | "salto" | "piruett" | "dans" | "superhopp" | "rulle" | "overrasket" | "spesial";
const DECK: Trick[] = ["salto", "piruett", "dans", "superhopp", "rulle", "spesial", "overrasket", "hopp", "spesial"];

const shuffle = <T,>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

let nextId = 1;

// Avstander skaleres med størrelsen på dyret, så triksene ser like ut i editoren og på profilen.
const unitOf = (el: HTMLElement | null) => (el?.offsetWidth ?? 100) / 100;

// Kjæledyret på profilen: puster, blunker og følger musepekeren med øynene. Hvert trykk
// gir et nytt triks (salto, piruett, dans, superhopp med konfetti, rulle …), og hver art
// har sitt eget. Mange raske trykk gjør det svimmelt, enda flere gir fest. Holder man
// inne, blir det klappet (hjerteøyne), og får det være i fred en stund, sovner det.
// Størrelsen settes med `size` (piksler) eller med klasser i `className`.
export default function Pet({ pet, owner, size, className = "" }: { pet: PetConfig; owner?: string; size?: number; className?: string }) {
  const t = useT();
  const reduce = useReduceMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const body = useAnimationControls();
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [mood, setMood] = useState<PetMood>("normal");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [petting, setPetting] = useState(false);

  const moodRef = useRef<PetMood>("normal");
  const greeted = useRef(false);
  const lineIndex = useRef(0);
  const deck = useRef<Trick[]>([]);
  const busy = useRef(false);
  const combo = useRef(0);
  const lastClick = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pettingTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const suppressClick = useRef(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sleepTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Tidsavbrudd som ryddes bort når komponenten forsvinner.
  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const changeMood = useCallback((next: PetMood, ms?: number) => {
    clearTimeout(moodTimer.current);
    moodRef.current = next;
    setMood(next);
    if (ms) {
      moodTimer.current = setTimeout(() => {
        moodRef.current = "normal";
        setMood("normal");
      }, ms);
    }
  }, []);

  const say = useCallback((text: string, ms = 2600) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const spawn = useCallback(
    (kind: ParticleKind, count: number, options: { char?: string | string[]; color?: string | string[] } = {}) => {
      if (reduce) return;
      const u = unitOf(ref.current);
      const pick = <T,>(v: T | T[] | undefined, i: number): T | undefined => (Array.isArray(v) ? v[i % v.length] : v);
      const fresh: Particle[] = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const base = { id: nextId++, kind, char: pick(options.char, i), color: pick(options.color, i) ?? HEART, delay: 0, rotate: 0, size: 1 };
        switch (kind) {
          case "burst":
            return { ...base, x: Math.cos(angle) * 58 * u, y: Math.sin(angle) * 46 * u, rotate: Math.random() * 180, size: 0.8 + Math.random() * 0.5 };
          case "confetti":
            return { ...base, x: (Math.random() - 0.5) * 170 * u, y: -(40 + Math.random() * 60) * u, rotate: (Math.random() - 0.5) * 900, delay: Math.random() * 0.15, color: pick(options.color, i) ?? CONFETTI[i % CONFETTI.length] };
          case "zzz":
            return { ...base, x: (18 + i * 10) * u, y: -(44 + i * 14) * u, delay: i * 0.45, size: 0.8 + i * 0.25 };
          default:
            return { ...base, x: (Math.random() - 0.5) * 60 * u, y: -(52 + Math.random() * 24) * u, rotate: (Math.random() - 0.5) * 40, delay: i * 0.08, size: 0.8 + Math.random() * 0.5 };
        }
      });
      setParticles((list) => [...list.slice(-40 + count), ...fresh]);
      const ids = new Set(fresh.map((p) => p.id));
      later(() => setParticles((list) => list.filter((p) => !ids.has(p.id))), 2600);
    },
    [later, reduce],
  );

  /* ------------------------------------------------------------------------ */
  /*  Søvn                                                                    */
  /* ------------------------------------------------------------------------ */

  const scheduleSleep = useCallback(() => {
    clearTimeout(sleepTimer.current);
    if (reduce) return;
    sleepTimer.current = setTimeout(() => {
      if (busy.current) return;
      changeMood("sleepy");
    }, SLEEP_AFTER_MS);
  }, [changeMood, reduce]);

  // Zzz over hodet så lenge dyret sover.
  useEffect(() => {
    if (mood !== "sleepy") return;
    spawn("zzz", 3, { char: ["z", "z", "Z"], color: "var(--mist)" });
    const id = setInterval(() => spawn("zzz", 3, { char: ["z", "z", "Z"], color: "var(--mist)" }), 2600);
    return () => clearInterval(id);
  }, [mood, spawn]);

  useEffect(() => {
    scheduleSleep();
    const all = timers.current;
    return () => {
      clearTimeout(sleepTimer.current);
      clearTimeout(bubbleTimer.current);
      clearTimeout(moodTimer.current);
      clearTimeout(holdTimer.current);
      clearInterval(pettingTimer.current);
      all.forEach(clearTimeout);
    };
  }, [scheduleSleep]);

  /* ------------------------------------------------------------------------ */
  /*  Blunking og øyne                                                        */
  /* ------------------------------------------------------------------------ */

  // Blunker med ujevne mellomrom, som et ekte dyr.
  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        next();
      }, 2200 + Math.random() * 3600);
    };
    next();
    return () => clearTimeout(timer);
  }, [reduce]);

  // Øynene følger musepekeren.
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.6);
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, dist / 260);
        setLook({ x: (dx / dist) * 2.3 * reach, y: (dy / dist) * 1.7 * reach });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reduce]);

  /* ------------------------------------------------------------------------ */
  /*  Triks                                                                   */
  /* ------------------------------------------------------------------------ */

  const move = useCallback(
    async (...steps: TargetAndTransition[]) => {
      if (reduce) return;
      busy.current = true;
      try {
        for (const step of steps) await body.start(step);
      } finally {
        body.set({ x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1, skewX: 0 });
        busy.current = false;
      }
    },
    [body, reduce],
  );

  const u = () => unitOf(ref.current);
  const name = pet.name || t(PET_SPECIES[pet.species].label);

  // Vanlige replikker: hilsen, lyden til arten og noen faste setninger.
  function nextLine() {
    const greeting = pet.name ? t("Hei! Jeg er {name}.", { name: pet.name }) : t("Hei!");
    const lines = [greeting, t(PET_SPECIES[pet.species].sound), ...PHRASES.filter((p) => owner || !p.includes("{owner}")).map((p) => t(p, { owner: owner ?? "" }))];
    return lines[lineIndex.current++ % lines.length];
  }

  const hop = () => {
    spawn("float", 3, { char: "♥", color: HEART });
    return move({ y: [0, -18 * u(), 0, -5 * u(), 0], scaleY: [1, 0.86, 1.08, 0.97, 1], scaleX: [1, 1.1, 0.95, 1.02, 1], transition: { duration: 0.65, ease: "easeOut" } });
  };

  // Hver art har sitt eget triks.
  const special: Record<PetSpecies, () => Promise<void>> = {
    katt: () => {
      say(t("Purrrr …"));
      changeMood("happy", 2200);
      spawn("float", 4, { char: "♥", color: HEART });
      return move({ x: [0, -1.5, 1.5, -1.5, 1.5, -1.5, 1.5, 0], rotate: [0, -2, 2, -2, 2, 0], transition: { duration: 1.2, ease: "linear" } });
    },
    hund: () => {
      say(t("Voff! Voff! Kast pinnen!"));
      changeMood("happy", 2200);
      return move(
        { y: [0, -16 * u(), 0], transition: { duration: 0.35 } },
        { y: [0, -16 * u(), 0], transition: { duration: 0.35 } },
        { rotate: [0, -10, 10, 0], transition: { duration: 0.4 } },
      );
    },
    rev: () => {
      say(t("What does the fox say?"));
      changeMood("happy", 2400);
      spawn("float", 5, { char: ["♪", "♫"], color: ["#b197fc", "#4dabf7"] });
      return move({ rotate: [0, -16, 16, -16, 16, -10, 0], x: [0, -6 * u(), 6 * u(), -6 * u(), 6 * u(), 0], y: [0, -6 * u(), 0, -6 * u(), 0, -4 * u(), 0], transition: { duration: 1.4, ease: "easeInOut" } });
    },
    kanin: () => {
      say(t("Hopp, hopp, hopp!"));
      const h = { y: [0, -22 * u(), 0], scaleY: [1, 1.08, 0.9, 1], transition: { duration: 0.32 } };
      return move({ ...h, x: [0, 8 * u()] }, { ...h, x: [8 * u(), 16 * u()] }, { ...h, x: [16 * u(), 0] });
    },
    bjorn: () => {
      say(t("BRUMMMM!"));
      changeMood("surprised", 1200);
      return move({ scale: [1, 1.25, 1.25, 1], x: [0, -3, 3, -3, 3, 0], transition: { duration: 0.9, ease: "easeInOut" } });
    },
    panda: () => {
      say(t("*ruller rundt*"));
      return move(
        { x: [0, 34 * u()], rotate: [0, 360], transition: { duration: 0.7, ease: "easeInOut" } },
        { x: [34 * u(), 0], rotate: [360, 0], transition: { duration: 0.7, ease: "easeInOut" } },
      );
    },
    ugle: () => {
      say(t("Hoo-hoo! Jeg ser alt."));
      changeMood("surprised", 1600);
      return move({ rotate: [0, 0, 360, 360], y: [0, -6 * u(), -6 * u(), 0], transition: { duration: 1.3, times: [0, 0.15, 0.85, 1], ease: "easeInOut" } });
    },
    robot: () => {
      say(t("Bip-bop! Laster inn dansetrinn …"));
      spawn("burst", 6, { char: "⚡", color: "#7df9ff" });
      return move({ x: [0, -4, 5, -3, 4, 0, 0], skewX: [0, 8, -8, 6, -6, 0, 0], transition: { duration: 0.7, ease: "linear" } }, { rotate: [0, 90, 180, 270, 360], transition: { duration: 0.8, ease: "linear" } });
    },
  };

  const tricks: Record<Trick, () => Promise<void> | void> = {
    hopp: () => {
      say(nextLine());
      return hop();
    },
    salto: () => {
      say(t("Ta-da!"));
      later(() => spawn("burst", 7, { char: "✦", color: STAR }), 650);
      return move(
        { y: 6 * u(), scaleY: 0.85, scaleX: 1.1, transition: { duration: 0.12 } },
        { y: [6 * u(), -42 * u(), -42 * u(), 0], rotate: [0, -120, -300, -360], scaleY: [0.85, 1.1, 1, 1], scaleX: [1.1, 0.95, 1, 1], transition: { duration: 0.65, ease: "easeInOut" } },
        { scaleY: [1, 0.85, 1.05, 1], scaleX: [1, 1.12, 0.97, 1], transition: { duration: 0.3 } },
      );
    },
    piruett: () => {
      say(t("Wiiii!"));
      spawn("burst", 5, { char: "✧", color: ["#ffffff", STAR] });
      return move({ scaleX: [1, -1, 1, -1, 1], y: [0, -10 * u(), -10 * u(), -10 * u(), 0], transition: { duration: 0.9, ease: "easeInOut" } });
    },
    dans: () => {
      say(t("Dansetid!"));
      changeMood("happy", 1900);
      spawn("float", 4, { char: ["♪", "♫", "♪", "♬"], color: ["#b197fc", "#4dabf7", "#69db7c", "#ffa94d"] });
      return move({ rotate: [0, -12, 12, -12, 12, 0], x: [0, -5 * u(), 5 * u(), -5 * u(), 5 * u(), 0], y: [0, -7 * u(), 0, -7 * u(), 0, 0], transition: { duration: 1.2, ease: "easeInOut" } });
    },
    superhopp: () => {
      say(t("Til himmels!"));
      later(() => spawn("confetti", 16), 700);
      const height = Math.min(70, 60 * u());
      return move(
        { y: 8 * u(), scaleY: 0.78, scaleX: 1.15, transition: { duration: 0.18 } },
        { y: -height, scaleY: 1.15, scaleX: 0.9, transition: { duration: 0.3, ease: "easeOut" } },
        { y: 0, scaleY: 1, scaleX: 1, transition: { duration: 0.28, ease: "easeIn" } },
        { scaleY: [1, 0.8, 1.06, 1], scaleX: [1, 1.15, 0.97, 1], transition: { duration: 0.35 } },
      );
    },
    rulle: () => {
      say(t("Rulle, rulle …"));
      return move(
        { x: [0, -30 * u()], rotate: [0, -360], transition: { duration: 0.6, ease: "easeInOut" } },
        { x: [-30 * u(), 0], rotate: [-360, 0], transition: { duration: 0.6, ease: "easeInOut" } },
      );
    },
    overrasket: () => {
      say(t("Oi! Der var du!"));
      changeMood("surprised", 1300);
      spawn("float", 1, { char: "!", color: STAR });
      return move({ y: [0, -14 * u(), 0], x: [0, 0, -3, 3, -3, 3, 0], transition: { duration: 0.6 } });
    },
    spesial: () => special[pet.species](),
  };

  function dizzy() {
    say(t("Alt snurrer …"), 3000);
    changeMood("dizzy", 3000);
    return move({ rotate: [0, -12, 10, -8, 6, -3, 0], x: [0, -4, 4, -3, 2, 0], transition: { duration: 1.6, ease: "easeInOut" } });
  }

  function party() {
    say(t("Fest! Du er best!"), 3000);
    changeMood("happy", 3000);
    spawn("confetti", 28);
    later(() => spawn("burst", 8, { char: "★", color: STAR }), 250);
    return move({ y: [0, -24 * u(), 0, -24 * u(), 0], rotate: [0, -360, -360, 0, 0], transition: { duration: 1.3, ease: "easeInOut" } });
  }

  function wake() {
    say(t("Oi! Jeg sov ikke, altså."));
    changeMood("surprised", 1200);
    spawn("float", 1, { char: "!", color: STAR });
    void move({ y: [0, -20 * u(), 0], scaleY: [1, 1.1, 0.92, 1], transition: { duration: 0.5 } });
  }

  function nextTrick(): Trick {
    if (!greeted.current) {
      greeted.current = true;
      return "hopp";
    }
    if (deck.current.length === 0) deck.current = shuffle(DECK);
    return deck.current.pop()!;
  }

  function poke() {
    scheduleSleep();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (moodRef.current === "sleepy") return wake();

    const now = Date.now();
    combo.current = now - lastClick.current < 900 ? combo.current + 1 : 1;
    lastClick.current = now;

    if (reduce) {
      say(nextLine());
      return;
    }
    if (combo.current === DIZZY_AT) return void dizzy();
    if (combo.current >= PARTY_AT) {
      combo.current = 0;
      return void party();
    }
    // Midt i et triks gir raske trykk bare flere hjerter.
    if (busy.current) {
      spawn("float", 2, { char: "♥", color: HEART });
      return;
    }
    void tricks[nextTrick()]();
  }

  /* ------------------------------------------------------------------------ */
  /*  Klapping (hold inne)                                                    */
  /* ------------------------------------------------------------------------ */

  function startHold(e: React.PointerEvent) {
    if (e.button !== 0) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setPetting(true);
      changeMood("love");
      say(pet.species === "katt" ? t("Purrrr …") : t("Mmm, mer klapping!"), 60_000);
      spawn("float", 2, { char: "♥", color: HEART });
      pettingTimer.current = setInterval(() => spawn("float", 1, { char: "♥", color: HEART }), 260);
    }, PET_HOLD_MS);
  }

  function endHold(e: React.PointerEvent) {
    clearTimeout(holdTimer.current);
    if (!petting) return;
    // Slippes pekeren utenfor dyret, kommer det ikke noe klikk som skal ignoreres.
    if (e.type !== "pointerup") suppressClick.current = false;
    clearInterval(pettingTimer.current);
    setPetting(false);
    changeMood("happy", 1500);
    say(t("Takk! Det var deilig."));
    scheduleSleep();
  }

  return (
    <div className={`relative ${className}`} style={size ? { width: size, height: size } : undefined}>
      <AnimatePresence>
        {bubble && (
          <motion.p
            key={bubble}
            role="status"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="glass-strong pointer-events-none absolute bottom-[92%] right-1/2 z-20 w-max max-w-52 translate-x-1/2 rounded-2xl rounded-br-md px-3 py-1.5 text-[13px] font-medium text-fg shadow-lg"
          >
            {bubble}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Hjerter, noter, stjerner, konfetti og Zzz. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
        <AnimatePresence>
          {particles.map((p) => (
            <ParticleView key={p.id} p={p} />
          ))}
        </AnimatePresence>
      </div>

      {/* Stjerner som går i ring over hodet når dyret er svimmelt. */}
      {mood === "dizzy" && !reduce && <DizzyStars />}

      <motion.button
        ref={ref}
        type="button"
        onClick={poke}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onContextMenu={(e) => petting && e.preventDefault()}
        onMouseEnter={scheduleSleep}
        aria-label={t("Hils på {name}", { name })}
        title={name}
        whileHover={reduce || petting ? undefined : { rotate: -4, scale: 1.04 }}
        style={{ originY: 1, WebkitTouchCallout: "none", touchAction: "manipulation" }}
        className="block size-full cursor-pointer select-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea"
      >
        <motion.div className="size-full" animate={body} style={{ originY: 0.92 }}>
          <motion.div
            className="size-full"
            animate={reduce ? undefined : petting ? { scaleX: [1, 1.05, 1], scaleY: [1, 0.94, 1] } : { y: [0, -2.5, 0] }}
            transition={petting ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <PetSvg pet={pet} look={look} blink={blink} wag={!reduce} breathe={!reduce} mood={mood} />
          </motion.div>
        </motion.div>
      </motion.button>
    </div>
  );
}

function ParticleView({ p }: { p: Particle }) {
  const common = "absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 select-none font-bold leading-none";
  if (p.kind === "confetti") {
    return (
      <motion.span
        className="absolute left-1/2 top-[40%] block h-2.5 w-1.5 rounded-[2px]"
        style={{ backgroundColor: p.color }}
        initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        animate={{ x: p.x, y: [0, p.y, p.y + 90], rotate: p.rotate, opacity: [1, 1, 0] }}
        transition={{ duration: 1.6, delay: p.delay, ease: ["easeOut", "easeIn"], times: [0, 0.35, 1] }}
      />
    );
  }
  if (p.kind === "burst") {
    return (
      <motion.span
        className={common}
        style={{ color: p.color, fontSize: `${p.size}rem` }}
        initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: [0.3, 1.1, 0.6], rotate: p.rotate }}
        transition={{ duration: 0.85, delay: p.delay, ease: "easeOut" }}
      >
        {p.char}
      </motion.span>
    );
  }
  if (p.kind === "zzz") {
    return (
      <motion.span
        className="absolute left-1/2 top-[30%] select-none font-bold italic leading-none"
        style={{ color: p.color, fontSize: `${0.75 * p.size}rem` }}
        initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: 1 }}
        transition={{ duration: 2.2, delay: p.delay, ease: "easeOut" }}
      >
        {p.char}
      </motion.span>
    );
  }
  return (
    <motion.span
      className={common}
      style={{ color: p.color, fontSize: `${1.05 * p.size}rem` }}
      initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
      animate={{ opacity: [0, 1, 0], y: p.y, x: p.x, scale: 1, rotate: p.rotate }}
      transition={{ duration: 1.2, delay: p.delay, ease: "easeOut" }}
    >
      {p.char}
    </motion.span>
  );
}

// Tre stjerner i en flat ellipse over hodet. Stjernene foran er større enn de bak.
function DizzyStars() {
  const steps = 16;
  const path = Array.from({ length: steps + 1 }, (_, i) => (i / steps) * Math.PI * 2);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-[4%] z-20 h-[22%]">
      {[0, 1, 2].map((i) => {
        const offset = (i * Math.PI * 2) / 3;
        return (
          <motion.span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-sm leading-none text-[#ffd43b]"
            animate={{
              left: path.map((a) => `${50 + Math.cos(a + offset) * 50}%`),
              top: path.map((a) => `${50 + Math.sin(a + offset) * 50}%`),
              scale: path.map((a) => 0.75 + 0.35 * Math.sin(a + offset)),
            }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          >
            ★
          </motion.span>
        );
      })}
    </div>
  );
}
