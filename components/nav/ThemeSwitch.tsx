"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Moon, MoonStar, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { useT } from "@/components/LocaleProvider";

const THEMES: { name: Theme; label: string; Icon: typeof Moon }[] = [
  { name: "midnight", label: "Midnatt", Icon: MoonStar },
  { name: "dark", label: "Mørk", Icon: Moon },
  { name: "light", label: "Lys", Icon: Sun },
];

const STEP = 100 / THEMES.length;

// Kanten som leder flyr av gårde, kanten bak henger etter. Da strekker markøren seg
// som en strikk mellom valgene og trekker seg sammen når den lander.
const LEAD = { type: "spring", stiffness: 620, damping: 34, mass: 0.6 } as const;
const TRAIL = { type: "spring", stiffness: 210, damping: 15, mass: 0.9 } as const;

// Tema-velgeren: bare ikoner, med en markør som oppfører seg som gummi.
export default function ThemeSwitch() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const index = Math.max(0, THEMES.findIndex((t) => t.name === theme));
  const previous = useRef(index);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  // Venstre og høyre kant av markøren, i prosent av bredden.
  const left = useMotionValue(index * STEP);
  const right = useMotionValue(100 - (index + 1) * STEP);
  // Jo lenger den strekkes, jo tynnere blir den.
  const squash = useTransform([left, right], ([l, r]: number[]) => {
    const stretch = Math.max(0, 100 - l - r - STEP) / STEP;
    return 1 - Math.min(stretch, 1.5) * 0.14;
  });
  const leftPct = useMotionTemplate`${left}%`;
  const rightPct = useMotionTemplate`${right}%`;

  useEffect(() => {
    const from = previous.current;
    previous.current = index;
    if (from === index) return;
    const toLeft = index * STEP;
    const toRight = 100 - (index + 1) * STEP;
    if (reduce) {
      left.set(toLeft);
      right.set(toRight);
      return;
    }
    const forward = index > from;
    const a = animate(left, toLeft, forward ? TRAIL : LEAD);
    const b = animate(right, toRight, forward ? LEAD : TRAIL);
    return () => {
      a.stop();
      b.stop();
    };
  }, [index, left, right, reduce]);

  const choose = (next: number) => {
    setTheme(THEMES[next].name);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t("Fargetema")}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        choose((index + delta + THEMES.length) % THEMES.length);
      }}
      className="glass-chip rounded-full p-1"
    >
      <div className="relative grid grid-cols-3">
        <motion.span
          aria-hidden="true"
          className="glass-thumb absolute inset-y-0 rounded-full"
          style={{ left: leftPct, right: rightPct, scaleY: squash }}
        />
        {THEMES.map(({ name, label, Icon }, i) => {
          const active = i === index;
          return (
            <motion.button
              key={name}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(label)}
              title={t(label)}
              tabIndex={active ? 0 : -1}
              onClick={() => choose(i)}
              whileTap={reduce ? undefined : { scale: 0.86 }}
              className={`relative z-10 flex h-8 items-center justify-center rounded-full transition-colors duration-300 ${
                active ? "text-fg" : "text-mist hover:text-fg"
              }`}
            >
              <motion.span
                key={active ? "on" : "off"}
                initial={reduce || !active ? false : { scale: 0.55, rotate: -35 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 13 }}
                className="flex"
              >
                <Icon className="size-[17px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
