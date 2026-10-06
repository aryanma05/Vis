"use client";

import { addTransitionType, createContext, startTransition, useCallback, useContext, useMemo, useOptimistic, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, localeCookie, makeT, type Locale, type T } from "@/lib/i18n";

// Overgangstypen som får siden til å tone mykt over til det nye språket (se
// LocaleTransition under og ::view-transition-* i app/globals.css).
export const LOCALE_TRANSITION = "sprakbytte";

type LocaleContextValue = {
  // Språket teksten på siden er skrevet på nå.
  locale: Locale;
  // Språket som er valgt. Skiller seg fra locale mens siden hentes på det nye språket.
  chosen: Locale;
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({ locale: DEFAULT_LOCALE, chosen: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  // Valget vises med en gang (f.eks. i innstillingene), mens teksten bytter først når
  // serveren har sendt siden på det nye språket. Da bytter alt samtidig, uten å laste
  // siden på nytt, og skjemaer og rulleposisjon blir som de var.
  const [chosen, setChosen] = useOptimistic(locale);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === chosen) return;
      document.cookie = localeCookie(next, window.location.protocol === "https:");
      startTransition(() => {
        addTransitionType(LOCALE_TRANSITION);
        setChosen(next);
        router.refresh();
      });
    },
    [chosen, router, setChosen],
  );

  const value = useMemo(() => ({ locale, chosen, setLocale }), [locale, chosen, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

// Toner innholdet over til det nye språket. Bare språkbytte animeres her; vanlig
// navigering og oppdateringer bytter som før.
export function LocaleTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition update={{ [LOCALE_TRANSITION]: LOCALE_TRANSITION, default: "none" }} default="none">
      {children}
    </ViewTransition>
  );
}

export const useLocale = () => useContext(LocaleContext).locale;

// Til språkvelgerne: valgt språk, og en funksjon som bytter mykt.
export function useChangeLocale() {
  const { locale, chosen, setLocale } = useContext(LocaleContext);
  return { chosen, setLocale, switching: chosen !== locale };
}

export function useT(): T {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
