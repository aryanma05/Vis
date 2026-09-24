"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

// Små beskjeder nede i hjørnet («Lagret», «Lenken er kopiert»). Kan kalles fra
// hvilken som helst klientkomponent: toast.success("Lagret").

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; message: string; description?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function push(kind: Kind, message: string, options: { description?: string; duration?: number } = {}) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, kind, message, description: options.description }];
  emit();
  const duration = options.duration ?? (kind === "error" ? 6000 : 3500);
  setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = Object.assign((message: string, options?: { description?: string }) => push("info", message, options), {
  success: (message: string, options?: { description?: string }) => push("success", message, options),
  error: (message: string, options?: { description?: string }) => push("error", message, options),
  info: (message: string, options?: { description?: string }) => push("info", message, options),
  dismiss,
});

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const EMPTY: Toast[] = [];

const ICONS = { success: CheckCircle2, error: TriangleAlert, info: Info };
const TONE = { success: "text-success", error: "text-danger", info: "text-ice" };

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  // Unngå at servergjengivelsen og første klientgjengivelse er ulike.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-[90] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
    >
      {list.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm animate-[toast-in_260ms_var(--ease-out-expo)] items-start gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 text-sm shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] backdrop-blur-xl"
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${TONE[t.kind]}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-fg">{t.message}</p>
              {t.description && <p className="mt-0.5 text-mist">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Lukk"
              className="-mr-1 rounded-md p-1 text-mist transition hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
