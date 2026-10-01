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
        className={`relative mt-0.5 inline-flex h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-success" : "bg-fill-2"
        }`}
      >
        <span
          className={`absolute top-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] transition-all duration-300 ease-[var(--ease-spring)] ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
