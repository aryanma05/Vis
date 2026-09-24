"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";

export type TabItem = { key: string; label: ReactNode; href?: string; count?: number | null };

// Faner med en strek som glir mellom valgene. Med href blir de lenker (URL-styrt),
// ellers knapper som kaller onSelect.
export function Tabs({
  items,
  active,
  onSelect,
  className = "",
  label,
  size = "md",
}: {
  items: TabItem[];
  active: string;
  onSelect?: (key: string) => void;
  className?: string;
  label: string;
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  const pad = size === "sm" ? "pb-3 text-sm" : "pb-4 text-[15px]";

  return (
    <nav aria-label={label} className={`no-scrollbar flex gap-7 overflow-x-auto ${className}`}>
      {items.map((item) => {
        const isActive = item.key === active;
        const inner = (
          <>
            <span className="flex items-center gap-2">
              {item.label}
              {item.count != null && (
                <span className={`font-mono text-[11px] ${isActive ? "text-mist" : "text-mist/55"}`}>{item.count}</span>
              )}
            </span>
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-fg"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </>
        );
        const cls = `relative shrink-0 font-medium transition ${pad} ${isActive ? "text-fg" : "text-mist hover:text-fg"}`;
        return item.href ? (
          <Link key={item.key} href={item.href} scroll={false} aria-current={isActive ? "page" : undefined} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={item.key} type="button" onClick={() => onSelect?.(item.key)} aria-pressed={isActive} className={cls}>
            {inner}
          </button>
        );
      })}
    </nav>
  );
}

// Segmentert valg (to-fire alternativer), f.eks. mal-valg eller synlighet.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const layoutId = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-ink-2/50 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative rounded-lg font-medium transition ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
              on ? "text-on-primary" : "text-mist hover:text-fg"
            }`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
