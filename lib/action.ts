import "server-only";

import { AuthError } from "@/lib/session";
import { fail, ok, UserFacingError, type ActionResult } from "@/lib/result";

// Kjører en Server Action og gjør kjente feil om til meldinger skjemaet kan vise.
// Uventede feil logges på serveren og vises som en generell melding.
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof UserFacingError || error instanceof AuthError) return fail(error.message);
    console.error("[action]", error);
    return fail("Noe gikk galt. Prøv igjen.");
  }
}
