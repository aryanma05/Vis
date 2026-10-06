import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, makeT, type Locale } from "@/lib/i18n";

// Språket for denne forespørselen: valgt i innstillingene (informasjonskapsel), ellers norsk.
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(chosen) ? chosen : DEFAULT_LOCALE;
});

export async function getT() {
  return makeT(await getLocale());
}
