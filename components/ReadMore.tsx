"use client";

import { useEffect, useRef, useState } from "react";

// Viser starten av en lang tekst, med «Les mer» for resten. Bildene skal få
// oppmerksomheten på prosjektsiden, ikke teksten.
export default function ReadMore({ children, label = "Les mer" }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 8);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div ref={ref} className={`relative ${open ? "" : "max-h-48 overflow-hidden"}`}>
        {children}
        {!open && overflows && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
        )}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 text-sm font-medium text-ice hover:underline"
        >
          {open ? "Vis mindre" : label}
        </button>
      )}
    </div>
  );
}
