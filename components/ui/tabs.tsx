"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";

export type TabItem = { key: string; label: ReactNode; href?: string; count?: number | null };

// Faner som en segmentert kontroll (som i iOS): en kapsel der markøren glir mellom
// valgene. Med href blir de lenker (URL-styrt), ellers knapper som kaller onSelect.
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
  const pad = size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm";

  return (
    <nav aria-label={label} className={`no-scrollbar max-w-full overflow-x-auto ${className}`}>
      <div className="glass-chip inline-flex gap-0.5 rounded-full p-1">
        {items.map((item) => {
          const isActive = item.key === active;
          const inner = (
            <>
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="glass-thumb absolute inset-0 rounded-full"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {item.label}
                {item.count != null && <span className="text-xs tabular-nums text-mist">{item.count}</span>}
              </span>
            </>
          );
          const cls = `relative flex shrink-0 items-center whitespace-nowrap rounded-full font-medium transition-colors ${pad} ${
            isActive ? "text-fg" : "text-mist hover:text-fg"
          }`;
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
      </div>
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
    <div role="radiogroup" aria-label={label} className="glass-chip inline-flex rounded-full p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full font-medium transition-colors ${size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${
              on ? "text-fg" : "text-mist hover:text-fg"
            }`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="glass-thumb absolute inset-0 rounded-full"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
