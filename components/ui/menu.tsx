"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

// Enkel nedtrekksmeny: klikk for å åpne, piltaster for å flytte, Esc eller klikk utenfor lukker.

const MenuContext = createContext<{ close: () => void } | null>(null);

export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  label,
  className = "",
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  side?: "bottom" | "top" | "right";
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const position =
    side === "right"
      ? `left-full ml-3 ${align === "end" ? "bottom-0 origin-bottom-left" : "top-0"}`
      : `${side === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${align === "end" ? "right-0" : "left-0"}`;

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v), id })}
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          className={`absolute z-50 min-w-56 origin-top animate-[rise_160ms_var(--ease-out-expo)] overflow-hidden rounded-2xl border border-line bg-surface/95 p-1.5 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.55)] backdrop-blur-xl ${position} ${className}`}
        >
          <MenuContext.Provider value={{ close }}>{children}</MenuContext.Provider>
        </div>
      )}
    </div>
  );
}

const itemClass =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-fg outline-none transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

export function MenuItem({
  children,
  onSelect,
  href,
  icon,
  danger,
  hint,
}: {
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  icon?: ReactNode;
  danger?: boolean;
  hint?: ReactNode;
}) {
  const ctx = useContext(MenuContext);
  const className = `${itemClass} ${danger ? "text-danger hover:bg-danger/10 focus-visible:bg-danger/10" : ""}`;
  const content = (
    <>
      {icon && <span className={`shrink-0 ${danger ? "" : "text-mist"}`}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-mist/70">{hint}</span>}
    </>
  );
  if (href) {
    return (
      <Link role="menuitem" href={href} onClick={() => ctx?.close()} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        ctx?.close();
        onSelect?.();
      }}
      className={className}
    >
      {content}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-2 label-mono">{children}</div>;
}
