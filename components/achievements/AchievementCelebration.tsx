"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { markAchievementsSeenAction } from "@/app/actions/profile";
import AchievementBadge from "@/components/achievements/AchievementBadge";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { ACHIEVEMENT_BY_KEY, TIER_NAMES, type AchievementState } from "@/lib/achievement-defs";

const CONFETTI_COLORS = ["#ffd166", "#ff9fb5", "#8ccbff", "#9fe0a8", "#b9a6ff", "#ffc27a"];

// «Tilfeldig», men det samme hver gang (0–1).
const noise = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Små biter som skytes ut fra midten og faller ned.
const PIECES = Array.from({ length: 34 }, (_, i) => {
  const angle = (i / 34) * Math.PI * 2 + noise(i) * 0.4;
  const force = 120 + noise(i + 50) * 140;
  return {
    x: Math.cos(angle) * force, 
    y: Math.sin(angle) * force * 0.7 - 60,
    rotate: noise(i + 100) * 720 - 360,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 5 + noise(i + 150) * 5,
    h: 8 + noise(i + 200) * 6,
    delay: noise(i + 250) * 0.12,
  };
});

function Confetti() {
  const pieces = PIECES;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-24">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-[2px]"
          style={{ width: p.w, height: p.h, background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 260], rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: 1.8, delay: p.delay, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}

// Vises for eieren når profilen har merker som er låst opp siden sist.
export default function AchievementCelebration({ achievements }: { achievements: AchievementState[] }) {
  const t = useT();
  const reduce = useReduceMotion();
  const fresh = achievements.filter((s) => s.tier > 0 && !s.seen);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (fresh.length === 0) return;
    const timer = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(timer);
  }, [fresh.length]);

  if (fresh.length === 0) return null;

  const close = () => {
    setOpen(false);
    void markAchievementsSeenAction();
  };

  const title = fresh.length === 1 ? t("Ny prestasjon!") : t("{n} nye prestasjoner!", { n: fresh.length });
  const only = fresh.length === 1 ? ACHIEVEMENT_BY_KEY.get(fresh[0].key)! : null;

  return (
    <Dialog open={open} onClose={close} title={title} size="sm">
      <div className="relative">
        {open && !reduce && <Confetti />}
        <ul className="flex flex-wrap justify-center gap-4 py-4">
          {fresh.slice(0, 9).map((s, i) => {
            const def = ACHIEVEMENT_BY_KEY.get(s.key)!;
            return (
              <motion.li
                key={s.key}
                className="flex w-24 flex-col items-center gap-2 text-center"
                initial={{ opacity: 0, scale: reduce ? 1 : 0.3, rotate: reduce ? 0 : -25 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 320, damping: 14 }}
              >
                <AchievementBadge def={def} tier={s.tier} size={fresh.length === 1 ? 112 : 64} />
                <span className="text-[13px] font-medium leading-tight text-fg">
                  {t(def.name)}
                  {s.tier >= 2 && <span className="block text-[11px] font-normal text-mist">{t(TIER_NAMES[s.tier - 1])}</span>}
                </span>
              </motion.li>
            );
          })}
        </ul>
        {only && <p className="text-center text-sm text-mist">{t(only.about)}</p>}
        <div className="mt-5 flex justify-center">
          <Button onClick={close}>{t("Så gøy!")}</Button>
        </div>
      </div>
    </Dialog>
  );
}
