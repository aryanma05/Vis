// Brukernavn brukes i profil-URL-en (/@brukernavn). Tillatte tegn er bokstaver a–z
// (store og små), tall og - _ . (samme tegn som GitHub tillater, pluss _ og .).
// Better Auth lagrer `username` med små bokstaver, så URL-en og sjekken for om navnet
// er ledig ikke skiller på store og små. Skrivemåten brukeren valgte ("ArinK") ligger
// i `displayUsername` og vises på profilen.

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 39;

const USERNAME_CHARS = /^[a-zA-Z0-9_.-]+$/;
const STARTS_AND_ENDS_OK = /^[a-zA-Z0-9](?:.*[a-zA-Z0-9])?$/;

// Navn som kan kollidere med sider i appen eller forvirre brukere.
const RESERVED_USERNAMES = new Set([
  "about",
  "admin",
  "api",
  "app",
  "auth",
  "hjelp",
  "help",
  "innstillinger",
  "logg-inn",
  "login",
  "logout",
  "me",
  "meg",
  "moderator",
  "ny",
  "new",
  "null",
  "om",
  "profil",
  "prosjekt",
  "prosjekter",
  "rediger",
  "register",
  "registrer",
  "settings",
  "sok",
  "search",
  "support",
  "undefined",
  "varsler",
  "vis",
]);

// Forklarer hva som er galt med brukernavnet, eller null hvis det er gyldig.
export function usernameError(username: string): string | null {
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Brukernavnet må ha minst ${USERNAME_MIN_LENGTH} tegn.`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Brukernavnet kan ha maks ${USERNAME_MAX_LENGTH} tegn.`;
  }
  if (/[æøå]/i.test(username)) return "Brukernavnet kan ikke ha æ, ø eller å.";
  if (!USERNAME_CHARS.test(username)) {
    return "Brukernavnet kan bare ha bokstaver (a–z), tall og - _ .";
  }
  if (!STARTS_AND_ENDS_OK.test(username)) {
    return "Brukernavnet må starte og slutte med en bokstav eller et tall.";
  }
  if (/[-_.]{2}/.test(username)) return "Brukernavnet kan ikke ha to av - _ . etter hverandre.";
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return "Det brukernavnet er reservert. Velg et annet.";
  }
  return null;
}

export function isValidUsername(username: string): boolean {
  return usernameError(username) === null;
}

// Brukernavnet slik brukeren skrev det, hvis det passer med det lagrede. (Ved
// GitHub-registrering kan brukernavnet ha fått et tall på slutten, og da gjelder ikke
// GitHub-skrivemåten.)
export function shownUsername(u: { username: string; displayUsername?: string | null }): string {
  return u.displayUsername && u.displayUsername.toLowerCase() === u.username
    ? u.displayUsername
    : u.username;
}

// Lager et gyldig utgangspunkt for et brukernavn fra f.eks. GitHub-login,
// e-post eller fullt navn. "Åse Øvrebø" -> "ase-ovrebo".
export function toUsernameBase(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/[-_.]{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH - 5)
    .replace(/[-_.]+$/g, "");

  if (base.length < USERNAME_MIN_LENGTH || RESERVED_USERNAMES.has(base)) {
    return `bruker-${base}`.replace(/-$/, "");
  }
  return base;
}
