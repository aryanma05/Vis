"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useLocale, useT } from "@/components/LocaleProvider";

const MONTHS = {
  nb: ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const THIS_YEAR = new Date().getFullYear();
const MIN_YEAR = 1960;
const MAX_YEAR = THIS_YEAR + 5;
// Årsvisningen viser tolv år om gangen.
const PAGE = 12;

const cell =
  "flex h-10 items-center justify-center rounded-xl text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-sea/60 disabled:pointer-events-none disabled:opacity-30";
const arrow =
  "flex size-9 items-center justify-center rounded-full text-mist transition hover:bg-fill hover:text-fg disabled:pointer-events-none disabled:opacity-30";

// Velg måned og år i et lite glasskort, som resten av appen. Verdien er "ÅÅÅÅ-MM",
// "ÅÅÅÅ" (bare år) eller "" (ikke satt). Trykk på årstallet øverst for å hoppe mellom år.
export default function MonthYear({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useT();
  const months = MONTHS[useLocale()];
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">("months");
  const [year = "", month = ""] = value ? value.split("-") : [];
  const [shownYear, setShownYear] = useState(Number(year) || THIS_YEAR);
  const pageStart = Math.max(MIN_YEAR, Math.min(MAX_YEAR - PAGE + 1, shownYear - (shownYear % PAGE)));
  const shown = year ? (month ? `${months[Number(month) - 1]} ${year}` : year) : null;

  function toggle() {
    if (!open) {
      setShownYear(Number(year) || THIS_YEAR);
      setView("months");
    }
    setOpen((v) => !v);
  }

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Lukk ved klikk utenfor eller Esc, og flytt fokus til valgt (eller denne) måned.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Ikke lukk dialogen rundt (f.eks. bilderedigeringen), bare velgeren.
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-focus=true]")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={shown ? `${label}: ${shown}` : label}
        className={`inline-flex h-11 min-w-36 items-center gap-2.5 rounded-[14px] bg-fill px-3.5 text-[15px] inset-ring inset-ring-line inset-shadow-[0_1px_2px_rgb(0_0_0/0.1)] transition hover:bg-fill-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/50 disabled:cursor-not-allowed disabled:opacity-40 ${
          open ? "bg-fill-2 ring-2 ring-sea/50" : ""
        }`}
      >
        <CalendarDays className="size-4 shrink-0 text-mist" aria-hidden="true" />
        <span className={shown ? "text-fg" : "text-mist/70"}>{shown ?? t("Velg måned")}</span>
      </button>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("Fjern datoen")}
          title={t("Fjern datoen")}
          className="flex size-8 items-center justify-center rounded-full text-mist transition hover:bg-fill hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className="glass-strong absolute left-0 top-full z-50 mt-2 w-72 origin-top-left animate-[rise_180ms_var(--ease-out-expo)] rounded-[22px] p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShownYear((y) => Math.max(MIN_YEAR, (view === "years" ? pageStart : y) - (view === "years" ? PAGE : 1)))}
              disabled={(view === "years" ? pageStart : shownYear) <= MIN_YEAR}
              aria-label={view === "years" ? t("Tidligere år") : t("Forrige år")}
              className={arrow}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView((v) => (v === "months" ? "years" : "months"))}
              aria-label={view === "months" ? t("Velg år") : t("Tilbake til månedene")}
              className="rounded-full px-3 py-1.5 text-[15px] font-semibold tabular-nums text-fg transition hover:bg-fill"
            >
              {view === "months" ? shownYear : `${pageStart}–${Math.min(pageStart + PAGE - 1, MAX_YEAR)}`}
            </button>
            <button
              type="button"
              onClick={() => setShownYear((y) => Math.min(MAX_YEAR, (view === "years" ? pageStart : y) + (view === "years" ? PAGE : 1)))}
              disabled={(view === "years" ? pageStart + PAGE - 1 : shownYear) >= MAX_YEAR}
              aria-label={view === "years" ? t("Senere år") : t("Neste år")}
              className={arrow}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {view === "months" ? (
            <>
              <div className="grid grid-cols-4 gap-1">
                {months.map((name, i) => {
                  const mm = String(i + 1).padStart(2, "0");
                  const selected = Number(year) === shownYear && month === mm;
                  const now = shownYear === THIS_YEAR && i === new Date().getMonth();
                  return (
                    <button
                      key={mm}
                      type="button"
                      data-focus={selected || (!month && now)}
                      aria-pressed={selected}
                      onClick={() => pick(`${shownYear}-${mm}`)}
                      className={`${cell} ${selected ? "bg-primary text-on-primary" : now ? "text-ice hover:bg-fill" : "text-fg hover:bg-fill"}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => pick(String(shownYear))}
                aria-pressed={value === String(shownYear)}
                className={`mt-2 w-full rounded-xl py-2 text-[13px] font-medium transition ${
                  value === String(shownYear) ? "bg-fill-2 text-fg" : "text-mist hover:bg-fill hover:text-fg"
                }`}
              >
                {t("Bare {year}, uten måned", { year: shownYear })}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: PAGE }, (_, i) => pageStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  disabled={y > MAX_YEAR}
                  data-focus={y === shownYear}
                  aria-pressed={String(y) === year}
                  onClick={() => {
                    setShownYear(y);
                    setView("months");
                  }}
                  className={`${cell} tabular-nums ${String(y) === year ? "bg-primary text-on-primary" : y === shownYear ? "bg-fill-2 text-fg" : "text-fg hover:bg-fill"}`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
