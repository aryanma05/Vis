import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, makeT, type Locale } from "@/lib/i18n";

// Språket for denne forespørselen: valgt i bunnteksten (informasjonskapsel), ellers nettleserens språk.
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export async function getT() {
  return makeT(await getLocale());
}
