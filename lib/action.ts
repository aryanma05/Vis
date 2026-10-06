import "server-only";

import type { z } from "zod";
import { recordError } from "@/lib/errors";
import { makeT, translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { log } from "@/lib/log";
import { AuthError } from "@/lib/session";
import { fail, ok, UserFacingError, type ActionResult } from "@/lib/result";
import { fieldErrors } from "@/lib/validation";

// Kjører en Server Action og gjør kjente feil om til meldinger skjemaet kan vise, på
// brukerens språk. Uventede feil logges på serveren og vises som en generell melding.
export async function runAction<T>(fn: () => Promise<T>, name = "action"): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    const locale = await getLocale();
    if (error instanceof UserFacingError) return fail(translate(locale, error.text, error.vars));
    if (error instanceof AuthError) return fail(translate(locale, error.message));
    log.error(name, { error });
    recordError({ source: "action", event: name, error });
    return fail(translate(locale, "Noe gikk galt. Prøv igjen."));
  }
}

// Svar når skjemaet ikke validerer: en samlet melding og feilene per felt.
export async function invalidInput(error: z.ZodError, form: "skjema" | "cv" = "skjema"): Promise<ActionResult<never>> {
  const locale = await getLocale();
  const t = makeT(locale);
  return fail(form === "cv" ? t("Sjekk feltene i CV-en.") : t("Sjekk feltene i skjemaet."), fieldErrors(error, locale));
}
