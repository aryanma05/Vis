"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MotionConfig, useReducedMotionConfig } from "framer-motion";
import { DISPLAY_PREFS, type DisplayPref } from "@/lib/display-prefs";

const CHANGE_EVENT = "vis-display-change";

function apply(name: DisplayPref, on: boolean) {
  const { attribute, value } = DISPLAY_PREFS[name];
  if (on) document.documentElement.dataset[attribute] = value;
  else delete document.documentElement.dataset[attribute];
}

function subscribe(onChange: () => void) {
  // Endret i en annen fane: hent valget derfra.
  const onStorage = (event: StorageEvent) => {
    const name = (Object.keys(DISPLAY_PREFS) as DisplayPref[]).find((n) => DISPLAY_PREFS[n].storage === event.key);
    if (!name) return;
    apply(name, event.newValue === DISPLAY_PREFS[name].value);
    onChange();
  };
  const queries = Object.values(DISPLAY_PREFS).map((p) => window.matchMedia(p.media));
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    queries.forEach((q) => q.removeEventListener("change", onChange));
  };
}

// Ett visningsvalg: om det er på, og om det er slått på i operativsystemet (da kan det
// ikke slås av her).
export function useDisplayPref(name: DisplayPref) {
  const { attribute, value, media, storage } = DISPLAY_PREFS[name];
  const chosen = useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset[attribute] === value,
    () => false,
  );
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(media).matches,
    () => false,
  );
  const set = useCallback(
    (on: boolean) => {
      apply(name, on);
      try {
        if (on) window.localStorage.setItem(storage, value);
        else window.localStorage.removeItem(storage);
      } catch {
        // Privat nettleservindu: valget gjelder bare for denne økten.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [name, storage, value],
  );
  return { on: chosen || system, system, set };
}

// Lar «Reduser bevegelse» i innstillingene styre alle framer-motion-animasjoner, i
// tillegg til innstillingen i operativsystemet.
export function MotionPrefs({ children }: { children: React.ReactNode }) {
  const { on } = useDisplayPref("motion");
  return <MotionConfig reducedMotion={on ? "always" : "user"}>{children}</MotionConfig>;
}

// Som useReducedMotion fra framer-motion, men tar også hensyn til innstillingene.
export function useReduceMotion() {
  return useReducedMotionConfig() ?? false;
}
