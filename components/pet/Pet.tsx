"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { useT } from "@/components/LocaleProvider";
import PetSvg from "@/components/pet/PetSvg";
import { PET_SPECIES, type PetConfig } from "@/lib/profile-style";

const PHRASES = ["Har du sett prosjektene her?", "Klapp meg igjen!", "Jeg passer på profilen.", "Psst … følg {owner}!"];

type Heart = { id: number; x: number; rotate: number };

// Kjæledyret på profilen: puster, blunker, følger musepekeren med øynene og hopper,
// sender hjerter og sier noe når man trykker på det.
// Størrelsen settes med `size` (piksler) eller med klasser i `className`.
export default function Pet({ pet, owner, size, className = "" }: { pet: PetConfig; owner?: string; size?: number; className?: string }) {
  const t = useT();
  const reduce = useReduceMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const controls = useAnimationControls();
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const clicks = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  function poke() {
    const n = clicks.current++;
    const greeting = pet.name ? t("Hei! Jeg er {name}.", { name: pet.name }) : t("Hei!");
    const lines = [greeting, t(PET_SPECIES[pet.species].sound), ...PHRASES.filter((p) => owner || !p.includes("{owner}")).map((p) => t(p, { owner: owner ?? "" }))];
    setBubble(lines[n % lines.length]);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 2600);

    if (reduce) return;
    void controls.start({ y: [0, -16, 0, -4, 0], scaleY: [1, 0.92, 1.06, 0.98, 1], transition: { duration: 0.6, ease: "easeOut" } });
    const id = Date.now();
    setHearts((h) => [...h.slice(-6), { id, x: (Math.random() - 0.5) * 50, rotate: (Math.random() - 0.5) * 40 }]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1200);
  }

  const label = pet.name || t(PET_SPECIES[pet.species].label);

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
            className="glass-strong absolute bottom-[92%] right-1/2 z-20 w-max max-w-52 translate-x-1/2 rounded-2xl rounded-br-md px-3 py-1.5 text-[13px] font-medium text-fg shadow-lg"
          >
            {bubble}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hearts.map((h) => (
          <motion.span
            key={h.id}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/4 z-10 text-lg text-[#ff6b8b]"
            initial={{ opacity: 0, y: 0, x: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], y: -54, x: h.x, scale: 1, rotate: h.rotate }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          >
            ♥
          </motion.span>
        ))}
      </AnimatePresence>

      <motion.button
        ref={ref}
        type="button"
        onClick={poke}
        aria-label={t("Hils på {name}", { name: label })}
        title={label}
        animate={controls}
        whileHover={reduce ? undefined : { rotate: -4, scale: 1.04 }}
        style={{ originY: 1 }}
        className="block size-full cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea"
      >
        <motion.div
          className="size-full"
          animate={reduce ? undefined : { y: [0, -2.5, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <PetSvg pet={pet} look={look} blink={blink} wag={!reduce} breathe={!reduce} />
        </motion.div>
      </motion.button>
    </div>
  );
}
