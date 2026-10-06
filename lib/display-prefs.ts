// Visningsvalg som gjelder denne nettleseren: mindre bevegelse, tettere flater og mer
// kontrast. De speiler innstillingene i operativsystemet (prefers-reduced-motion osv.),
// og er noe slått på der, gjelder det uansett. Valget lagres i localStorage og settes
// som data-attributter på <html> (data-motion="reduce" osv.), som app/globals.css leser.
// Ingen "use client": layouten trenger konstantene til skriptet som kjører før siden tegnes.

export const DISPLAY_PREFS = {
  motion: { storage: "vis-motion", attribute: "motion", value: "reduce", media: "(prefers-reduced-motion: reduce)" },
  transparency: { storage: "vis-transparency", attribute: "transparency", value: "reduce", media: "(prefers-reduced-transparency: reduce)" },
  contrast: { storage: "vis-contrast", attribute: "contrast", value: "more", media: "(prefers-contrast: more)" },
} as const;

export type DisplayPref = keyof typeof DISPLAY_PREFS;

// Setter attributtene fra localStorage. Kjøres før siden tegnes, så den ikke blinker.
export const displayPrefsScript = `try{var d=document.documentElement;${JSON.stringify(
  Object.values(DISPLAY_PREFS).map((p) => [p.storage, p.attribute, p.value]),
)}.forEach(function(p){if(localStorage.getItem(p[0])===p[2])d.dataset[p[1]]=p[2]})}catch(e){}`;

// For kode som ruller eller animerer selv (utenom framer-motion og CSS).
export function prefersReducedMotion() {
  const { attribute, value, media } = DISPLAY_PREFS.motion;
  return document.documentElement.dataset[attribute] === value || window.matchMedia(media).matches;
}
