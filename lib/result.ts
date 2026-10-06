import { translate, type Vars } from "@/lib/i18n";

// Felles returtype for Server Actions, så skjemaer kan vise feil uten try/catch.
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// Feil som er trygge å vise brukeren. Alle andre feil logges og erstattes
// med en generell melding. Teksten er norsk med {variabler}, som t(); runAction
// (lib/action.ts) oversetter den til brukerens språk. message er den norske teksten.
export class UserFacingError extends Error {
  readonly text: string;
  readonly vars?: Vars;

  constructor(text: string, vars?: Vars) {
    super(translate("nb", text, vars));
    this.name = "UserFacingError";
    this.text = text;
    this.vars = vars;
  }
}
