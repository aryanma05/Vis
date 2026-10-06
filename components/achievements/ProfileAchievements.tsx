"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Check } from "lucide-react";
import AchievementBadge from "@/components/achievements/AchievementBadge";
import { useLocale, useT } from "@/components/LocaleProvider";
import Dialog from "@/components/ui/dialog";
import { ACHIEVEMENT_BY_KEY, ACHIEVEMENTS, goalText, TIER_COLORS, TIER_NAMES, type AchievementState } from "@/lib/achievement-defs";
import { dateLocale } from "@/lib/i18n";

const SHOWCASE = 6;
const EASE = [0.16, 1, 0.3, 1] as const;

// De beste merkene først: høyest nivå, så de nyeste.
function ranked(states: AchievementState[]) {
  return states.filter((s) => s.tier > 0).sort((a, b) => b.tier - a.tier || (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
}

// Merkene på profilen: noen av dem på visittkortet, og alle i et vindu når man trykker.
export default function ProfileAchievements({ achievements, isOwner }: { achievements: AchievementState[]; isOwner: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const earned = ranked(achievements);
  if (earned.length === 0 && !isOwner) return null;

  // Får alle plass, vises alle; ellers fem og en «+N»-knapp, så raden ikke brytes.
  const shown = earned.length <= SHOWCASE ? earned : earned.slice(0, SHOWCASE - 1);
  const more = earned.length - shown.length;

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="caption">{t("Prestasjoner")}</h2>
        <button type="button" onClick={() => setOpen(earned[0]?.key ?? ACHIEVEMENTS[0].key)} className="text-xs text-mist transition hover:text-fg">
          {earned.length > 0 ? t("Se alle") : t("Se hvordan")}
        </button>
      </div>
      {earned.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {shown.map((s, i) => {
            const def = ACHIEVEMENT_BY_KEY.get(s.key)!;
            return (
              <li key={s.key}>
                <motion.button
                  type="button"
                  onClick={() => setOpen(s.key)}
                  aria-label={t(def.name)}
                  title={t(def.name)}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 420, damping: 24 }}
                  whileHover={{ scale: 1.1, rotate: -6 }}
                  whileTap={{ scale: 0.94 }}
                  className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  <AchievementBadge def={def} tier={s.tier} size={46} />
                </motion.button>
              </li>
            );
          })}
          {more > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setOpen(earned[shown.length].key)}
                className="flex size-[46px] items-center justify-center rounded-full glass-chip text-sm font-semibold text-mist transition hover:text-fg"
                aria-label={t("Se alle")}
              >
                +{more}
              </button>
            </li>
          )}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(ACHIEVEMENTS[0].key)}
          className="mt-3 flex w-full items-center gap-3 rounded-[18px] glass-card p-3 text-left transition hover:bg-card-hover"
        >
          <AchievementBadge def={ACHIEVEMENTS[0]} tier={0} size={40} />
          <span className="text-sm text-mist">{t("Lås opp ditt første merke ved å publisere et prosjekt.")}</span>
        </button>
      )}

      <AchievementsDialog
        open={open !== null}
        selected={open ?? ACHIEVEMENTS[0].key}
        onSelect={setOpen}
        onClose={() => setOpen(null)}
        achievements={achievements}
        isOwner={isOwner}
      />
    </section>
  );
}

function AchievementsDialog({
  open,
  selected,
  onSelect,
  onClose,
  achievements,
  isOwner,
}: {
  open: boolean;
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  achievements: AchievementState[];
  isOwner: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const reduce = useReduceMotion();
  const byKey = new Map(achievements.map((s) => [s.key, s]));
  const earned = ranked(achievements);
  // Andre ser bare merkene som er låst opp; eieren ser alle, med fremdrift.
  const locked = isOwner ? ACHIEVEMENTS.filter((d) => (byKey.get(d.key)?.tier ?? 0) === 0).map((d) => byKey.get(d.key)!) : [];
  const list = [...earned, ...locked];

  const def = ACHIEVEMENT_BY_KEY.get(selected) ?? ACHIEVEMENTS[0];
  const state = byKey.get(def.key);
  const tier = state?.tier ?? 0;
  const maxed = tier >= def.tiers.length;
  const next = goalText(def, tier + 1);
  const value = state?.value ?? null;
  const date = state?.unlockedAt
    ? new Date(state.unlockedAt).toLocaleDateString(dateLocale(locale), { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Prestasjoner")}
      description={t("{n} av {total} låst opp", { n: earned.length, total: ACHIEVEMENTS.length })}
      size="lg"
    >
      {/* Det valgte merket. */}
      <div className="relative overflow-hidden rounded-[22px] bg-fill p-5 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle, ${def.colors[0]}, transparent 70%)` }}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={def.key}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left"
          >
            <motion.div
              initial={{ scale: reduce ? 1 : 0.5, rotate: reduce ? 0 : -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 16 }}
              className="shrink-0"
            >
              <AchievementBadge def={def} tier={tier} size={104} />
            </motion.div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold tracking-tight text-fg">{t(def.name)}</p>
              <p className="mt-0.5 text-sm text-mist">
                {tier === 0
                  ? t("Ikke låst opp ennå")
                  : tier >= 2
                    ? `${t(TIER_NAMES[tier - 1])} · ×${tier}${date ? ` · ${date}` : ""}`
                    : date
                      ? t("Låst opp {date}", { date })
                      : t("Låst opp")}
              </p>
              <p className={`mt-3 text-[15px] leading-6 ${tier > 0 ? "text-fg/90" : "text-mist"}`}>{t(def.about)}</p>
              <p className="mt-3 text-sm text-mist">
                {maxed ? (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <Check className="size-4" /> {def.tiers.length > 1 ? t("Høyeste nivå nådd") : t("Låst opp")}
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-fg">{tier === 0 ? t("Slik låser du det opp:") : t("Neste nivå:")}</span>{" "}
                    {t(next.text, { n: next.n.toLocaleString(dateLocale(locale)) })}
                  </>
                )}
              </p>

              {/* Fremdrift (bare eieren ser tallene). */}
              {isOwner && !maxed && value !== null && next.n > 1 && (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-fill-2">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${def.colors[0]}, ${def.colors[1]})` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (value / next.n) * 100)}%` }}
                      transition={{ duration: 0.6, ease: EASE }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs tabular-nums text-mist">
                    {t("{value} av {target}", { value: Math.min(value, next.n).toLocaleString(dateLocale(locale)), target: next.n.toLocaleString(dateLocale(locale)) })}
                  </p>
                </div>
              )}

              {/* Nivåstigen. */}
              {def.tiers.length > 1 && (
                <ol className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {def.tiers.map((threshold, i) => {
                    const reached = tier > i;
                    return (
                      <li
                        key={threshold}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${reached ? "text-[#1b1406]" : "bg-fill-2 text-mist"}`}
                        style={reached ? { background: i === 0 ? def.colors[0] : TIER_COLORS[i] } : undefined}
                        title={i === 0 ? undefined : t(TIER_NAMES[i])}
                      >
                        {i > 0 && <span className="font-bold">×{i + 1}</span>}
                        {threshold.toLocaleString(dateLocale(locale))}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Alle merkene. */}
      <ul className="mt-5 grid max-h-[38vh] grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto px-1 py-2 sm:grid-cols-6">
        {list.map((s) => {
          const d = ACHIEVEMENT_BY_KEY.get(s.key)!;
          const on = d.key === def.key;
          return (
            <li key={d.key}>
              <button
                type="button"
                onClick={() => onSelect(d.key)}
                aria-pressed={on}
                className={`group flex w-full flex-col items-center gap-1.5 rounded-2xl p-1.5 transition ${on ? "bg-fill-2" : "hover:bg-fill"}`}
              >
                <span className="transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
                  <AchievementBadge def={d} tier={s.tier} size={48} />
                </span>
                <span className={`line-clamp-2 text-center text-[11px] leading-tight ${s.tier > 0 ? "text-fg" : "text-mist"}`}>{t(d.name)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
