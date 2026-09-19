// Brukernavn brukes i profil-URL-en (/@brukernavn), så de holdes til små
// bokstaver, tall og - _ . (samme tegn som GitHub tillater, pluss _ og .).

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 39;

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.-]*[a-z0-9])?$/;

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
  "register",
  "registrer",
  "settings",
  "sok",
  "search",
  "support",
  "undefined",
  "vis",
]);

export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username) &&
    !/[-_.]{2}/.test(username) &&
    !RESERVED_USERNAMES.has(username)
  );
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
