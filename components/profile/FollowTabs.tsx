"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { useT } from "@/components/LocaleProvider";
import { Tabs } from "@/components/ui/tabs";

type Mode = "folgere" | "folger";

const EASE = [0.16, 1, 0.3, 1] as const;

// Begge listene er allerede lastet, så byttet skjer i nettleseren uten ny side: markøren
// glir mellom fanene, og listen glir inn fra den siden fanen ligger på. Adressen byttes
// også, så en ny innlasting eller en delt lenke åpner riktig fane.
export default function FollowTabs({
  username,
  initial,
  counts,
  titles,
  followers,
  following,
}: {
  username: string;
  initial: Mode;
  counts: { followers: number; following: number };
  // Fanetittelen i nettleseren for hver fane (samme som sidene har i metadataen).
  titles: Record<Mode, string>;
  followers: ReactNode;
  following: ReactNode;
}) {
  const t = useT();
  const reduce = useReduceMotion();
  const [mode, setMode] = useState<Mode>(initial);
  const [direction, setDirection] = useState(0);

  function select(key: string) {
    const next = key as Mode;
    if (next === mode) return;
    setDirection(next === "folger" ? 1 : -1);
    setMode(next);
    window.history.replaceState(null, "", `/@${username}/${next}`);
    document.title = `${titles[next]} · Vis`;
  }

  const shift = reduce ? 0 : 36;

  return (
    <>
      <h1 className="relative mt-4 text-3xl font-bold tracking-tight md:text-5xl">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={mode}
            className="block"
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -10 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {mode === "folgere" ? t("Følgere") : t("Følger")}
          </motion.span>
        </AnimatePresence>
      </h1>

      <div className="mt-8">
        <Tabs
          label={t("Følgere og følger")}
          active={mode}
          onSelect={select}
          items={[
            { key: "folgere", label: t("Følgere"), count: counts.followers },
            { key: "folger", label: t("Følger"), count: counts.following },
          ]}
        />
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={mode}
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * shift }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -shift }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.34, ease: EASE }}
          >
            {mode === "folgere" ? followers : following}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
