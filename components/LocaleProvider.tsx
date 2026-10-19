"use client";

import { createContext, startTransition, useCallback, useContext, useLayoutEffect, useMemo, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, localeCookie, makeT, type Locale, type T } from "@/lib/i18n";

// Språket teksten på siden er skrevet på nå. Egen kontekst, så alt som viser tekst (useT) ikke
// tegnes på nytt når man bare klikker på et språk, men først når den nye teksten er her.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

type ChoiceValue = {
  // Språket som er valgt. Skiller seg fra locale mens siden hentes på det nye språket.
  chosen: Locale;
  setLocale: (next: Locale) => void;
};

const ChoiceContext = createContext<ChoiceValue>({ chosen: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  // Valget vises med en gang (f.eks. i innstillingene), mens teksten bytter først når
  // serveren har sendt siden på det nye språket. Da bytter alt samtidig, uten å laste
  // siden på nytt, og skjemaer og rulleposisjon blir som de var.
  const [chosen, setChosen] = useOptimistic(locale);

  // Demper innholdet fra klikket til den nye teksten er på plass (se #innhold i app/globals.css).
  // Layout-effekt, så dempingen løftes i samme tegning som den nye teksten kommer.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-sprakbytte", chosen !== locale);
  }, [chosen, locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === chosen) return;
      document.cookie = localeCookie(next, window.location.protocol === "https:");
      startTransition(() => {
        setChosen(next);
        router.refresh();
      });
    },
    [chosen, router, setChosen],
  );

  const choice = useMemo(() => ({ chosen, setLocale }), [chosen, setLocale]);
  return (
    <LocaleContext.Provider value={locale}>
      <ChoiceContext.Provider value={choice}>{children}</ChoiceContext.Provider>
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);

// Til språkvelgerne: valgt språk, og en funksjon som bytter mykt.
export function useChangeLocale() {
  const locale = useContext(LocaleContext);
  const { chosen, setLocale } = useContext(ChoiceContext);
  return { chosen, setLocale, switching: chosen !== locale };
}

export function useT(): T {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
