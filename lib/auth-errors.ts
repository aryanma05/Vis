// Norske meldinger for feilkodene fra Better Auth, og hvilket skjemafelt feilen hører til.

export type AuthField = "name" | "username" | "email" | "password";
export type AuthErrorInfo = { message: string; field?: AuthField; code?: string };
type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

const ERRORS: Record<string, { message: string; field?: AuthField }> = {
  USER_ALREADY_EXISTS: { field: "email", message: "Det finnes allerede en konto med denne e-posten." },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: { field: "email", message: "Det finnes allerede en konto med denne e-posten." },
  INVALID_EMAIL: { field: "email", message: "E-postadressen ser ikke riktig ut." },
  INVALID_EMAIL_OR_PASSWORD: { message: "Feil e-post eller passord." },
  INVALID_USERNAME_OR_PASSWORD: { message: "Feil brukernavn eller passord." },
  INVALID_PASSWORD: { field: "password", message: "Feil passord." },
  PASSWORD_TOO_SHORT: { field: "password", message: "Passordet må ha minst 8 tegn." },
  PASSWORD_TOO_LONG: { field: "password", message: "Passordet kan ha maks 128 tegn." },
  USERNAME_IS_ALREADY_TAKEN: { field: "username", message: "Brukernavnet er tatt. Prøv et annet." },
  USERNAME_TOO_SHORT: { field: "username", message: "Brukernavnet må ha minst 2 tegn." },
  USERNAME_TOO_LONG: { field: "username", message: "Brukernavnet kan ha maks 39 tegn." },
  INVALID_USERNAME: { field: "username", message: "Brukernavnet kan bare ha bokstaver (a–z), tall og - _ ." },
  INVALID_DISPLAY_USERNAME: { field: "username", message: "Brukernavnet kan bare ha bokstaver (a–z), tall og - _ ." },
  FAILED_TO_CREATE_USER: { message: "Kontoen kunne ikke opprettes. Prøv igjen om litt." },
  // Adressen i nettleseren stemmer ikke med BETTER_AUTH_URL på serveren.
  INVALID_ORIGIN: { message: "Innlogging er feilkonfigurert på serveren (BETTER_AUTH_URL). Si fra til oss." },
  MISSING_OR_NULL_ORIGIN: { message: "Innlogging er feilkonfigurert på serveren (BETTER_AUTH_URL). Si fra til oss." },
  EMAIL_NOT_VERIFIED: { message: "Du må bekrefte e-posten din før du logger inn. Vi har sendt deg en ny kode." },
  EMAIL_ALREADY_VERIFIED: { message: "E-posten er allerede bekreftet. Du kan logge inn." },
  INVALID_TOKEN: { message: "Lenken eller koden er ugyldig eller allerede brukt. Be om en ny." },
  TOKEN_EXPIRED: { message: "Lenken har gått ut. Be om en ny." },
  SESSION_EXPIRED: { message: "Av sikkerhetshensyn må du logge inn på nytt før du gjør dette." },
  CREDENTIAL_ACCOUNT_NOT_FOUND: { field: "password", message: "Kontoen din har ikke passord (du logger inn med GitHub)." },
  SOCIAL_ACCOUNT_ALREADY_LINKED: { message: "Denne kontoen er allerede koblet til en annen Vis-konto." },
  LINKED_ACCOUNT_ALREADY_EXISTS: { message: "Kontoen er allerede koblet til Vis-kontoen din." },
  // Sekssifrede koder (emailOTP).
  INVALID_OTP: { message: "Koden stemmer ikke. Sjekk sifrene og prøv igjen." },
  OTP_EXPIRED: { message: "Koden har gått ut. Be om en ny." },
  TOO_MANY_ATTEMPTS: { message: "For mange feil forsøk. Be om en ny kode." },
  USER_NOT_FOUND: { message: "Fant ingen konto med den e-posten." },
  BANNED_USER: { message: "Kontoen din er stengt av en moderator. Ta kontakt hvis du mener det er feil." },
};

// Better Auth gir VALIDATION_ERROR med meldinger som "[body.email] Invalid email address".
function validationError(message = ""): AuthErrorInfo | null {
  const field = message.match(/\[body\.(\w+)\]/)?.[1];
  if (field === "email") return { field, message: "E-postadressen ser ikke riktig ut. Sjekk at den har med f.eks. .com." };
  if (field === "password") return { field, message: "Passordet må ha mellom 8 og 128 tegn." };
  if (field === "name") return { field, message: "Skriv inn navnet ditt." };
  if (field === "username") return { field, message: "Brukernavnet er ugyldig." };
  return null;
}

// context "login": alle brukernavn-feil betyr for brukeren det samme, feil brukernavn eller passord.
export function authError(error: AuthErrorLike, context?: "login"): AuthErrorInfo {
  if (!error) return { message: "Noe gikk galt. Prøv igjen." };
  if (error.status === 429) {
    return { message: "For mange forsøk på kort tid. Vent et minutt og prøv igjen.", code: "RATE_LIMITED" };
  }
  if (!error.status && !error.code) {
    return { message: "Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.", code: "NETWORK" };
  }
  if (context === "login" && (error.code?.startsWith("USERNAME_") || error.code === "INVALID_USERNAME")) {
    return { message: "Feil brukernavn eller passord.", code: error.code };
  }

  const known = error.code === "VALIDATION_ERROR" ? validationError(error.message) : error.code && ERRORS[error.code];
  if (known) return { ...known, code: error.code };

  // Ukjent feil: logg den, så den er lett å finne i konsollen.
  console.error("[auth]", error);
  return { message: "Noe gikk galt. Prøv igjen.", code: error.code };
}

export function authErrorMessage(error: AuthErrorLike, context?: "login") {
  return authError(error, context).message;
}
