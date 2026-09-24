// Norske meldinger for feilkodene fra Better Auth.
const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Det finnes allerede en konto med denne e-posten.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Det finnes allerede en konto med denne e-posten.",
  INVALID_EMAIL: "Ugyldig e-postadresse.",
  INVALID_EMAIL_OR_PASSWORD: "Feil e-post eller passord.",
  INVALID_USERNAME_OR_PASSWORD: "Feil brukernavn eller passord.",
  INVALID_PASSWORD: "Feil passord.",
  PASSWORD_TOO_SHORT: "Passordet må ha minst 8 tegn.",
  PASSWORD_TOO_LONG: "Passordet er for langt.",
  USERNAME_IS_ALREADY_TAKEN: "Brukernavnet er tatt. Prøv et annet.",
  USERNAME_TOO_SHORT: "Brukernavnet er for kort.",
  USERNAME_TOO_LONG: "Brukernavnet er for langt (maks 39 tegn).",
  INVALID_USERNAME: "Brukernavnet er ugyldig. Bruk bokstaver (a–z), tall og - _ .",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "Denne GitHub-kontoen er allerede koblet til en annen Vis-konto.",
  LINKED_ACCOUNT_ALREADY_EXISTS: "GitHub er allerede koblet til kontoen din.",
};

export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!error) return "Noe gikk galt. Prøv igjen.";
  if (error.status === 429) return "For mange forsøk. Vent litt og prøv igjen.";
  return (error.code && MESSAGES[error.code]) || "Noe gikk galt. Prøv igjen.";
}
