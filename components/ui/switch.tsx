"use client";

import type { ReactNode } from "react";

export default function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start justify-between gap-6 rounded-xl text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] leading-5 text-mist">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition ${
          checked ? "border-primary bg-primary" : "border-line bg-ink-2"
        }`}
      >
        <span
          className={`absolute top-0.5 size-[18px] rounded-full shadow-sm transition-all duration-200 ease-[var(--ease-spring)] ${
            checked ? "left-[22px] bg-on-primary" : "left-0.5 bg-mist/70"
          }`}
        />
      </span>
    </button>
  );
}
