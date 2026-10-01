"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const COLLAPSED = 520;
// Er det bare litt igjen, vises alt med en gang. Ingen gidder å klikke for tre linjer.
const SLACK = 1.35;

type State = "collapsed" | "expanding" | "expanded" | "short";

// Lange beskrivelser vises bare delvis, med en myk overgang nederst og en knapp for
// å lese resten. Teksten åpner seg også av seg selv når man tabber inn i den skjulte
// delen, eller når en lenke peker til en overskrift lenger ned.
export default function ReadMore({ children, minutes }: { children: React.ReactNode; minutes: number }) {
  const id = useId();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("collapsed");
  const [height, setHeight] = useState<number | null>(null);

  const expand = useCallback(() => {
    const full = inner.current?.scrollHeight ?? 0;
    setHeight(full);
    setState("expanding");
  }, []);

  // Måler innholdet, også på nytt når bilder lastes og teksten blir høyere.
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      setState((current) => {
        if (current === "expanded" || current === "expanding") return current;
        return el.scrollHeight <= COLLAPSED * SLACK ? "short" : "collapsed";
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // #overskrift i adressen: åpne teksten så nettleseren kan hoppe dit.
  useEffect(() => {
    const open = () => {
      let target: HTMLElement | null = null;
      try {
        target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
      } catch {}
      if (target && inner.current?.contains(target)) {
        expand();
        requestAnimationFrame(() => target.scrollIntoView());
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [expand]);

  const collapse = () => {
    const el = outer.current;
    if (!el) return;
    // Fra full høyde til lukket, og la toppen av teksten være synlig etterpå.
    setHeight(el.scrollHeight);
    setState("expanding");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setHeight(COLLAPSED);
        setState("collapsed");
        const top = el.getBoundingClientRect().top;
        if (top < 0) window.scrollBy({ top: top - 96, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }),
    );
  };

  const clipped = state === "collapsed" || state === "expanding";
  const maxHeight = state === "short" || state === "expanded" ? undefined : state === "collapsed" ? COLLAPSED : (height ?? undefined);

  return (
    <div>
      <div
        ref={outer}
        id={id}
        onFocusCapture={(event) => {
          if (state !== "collapsed" || !outer.current) return;
          const box = (event.target as HTMLElement).getBoundingClientRect();
          if (box.bottom > outer.current.getBoundingClientRect().top + COLLAPSED - 80) expand();
        }}
        onTransitionEnd={(event) => {
          if (event.target === outer.current && state === "expanding") setState("expanded");
        }}
        style={{ maxHeight }}
        className={`readmore relative transition-[max-height] duration-700 ease-[var(--ease-out-expo)] print:!max-h-none ${clipped ? "overflow-hidden" : ""}`}
      >
        <div ref={inner}>{children}</div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink via-ink/85 to-transparent transition-opacity duration-500 print:hidden ${
            state === "collapsed" ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {state !== "short" && (
        <div className={`relative flex items-center gap-4 print:hidden ${state === "collapsed" ? "-mt-6" : "mt-8"}`}>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
          <button
            type="button"
            aria-expanded={!clipped}
            aria-controls={id}
            onClick={state === "collapsed" ? expand : collapse}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg shadow-[0_10px_30px_-14px_rgb(0_0_0/0.6)] transition hover:border-ice/50 hover:text-ice"
          >
            {state === "collapsed" ? (
              <>
                Les mer
                <span className="font-normal text-mist group-hover:text-ice/80">· {minutes} min</span>
                <ChevronDown className="size-4 transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden="true" />
              </>
            ) : (
              <>
                Vis mindre
                <ChevronUp className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden="true" />
              </>
            )}
          </button>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
      )}
      <noscript>
        <style>{".readmore{max-height:none!important;overflow:visible!important}"}</style>
      </noscript>
    </div>
  );
}
