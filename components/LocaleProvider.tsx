"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type T } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("nb");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

export function useT(): T {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}
