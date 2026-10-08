// Regler rundt innlogging og admin som ikke trenger databasen, så de kan testes for seg.
// Brukes av lib/auth.ts (hooks.before), lib/admin.ts og app/api/auth/[...all]/route.ts.

import { createHash } from "node:crypto";

// Better Auth sine admin-endepunkter (/api/auth/admin/…) gir full kontroll over andre
// kontoer: logge inn som dem, sette nytt passord, endre rolle, slette og liste alle e-poster.
// Appen modererer selv i lib/admin.ts og bruker dem aldri, så de er stengt.
// `path` er stien slik Better Auth ser den, uten /api/auth foran.
export function isBlockedAuthPath(path: string) {
  return /^\/admin(\/|$)/i.test(path);
}

// Feltene skjemaene faktisk sender. Alt annet (f.eks. `image`, eller felt fra plugins)
// avvises, så ingen kan sette noe appen ellers validerer selv (lib/validation.ts).
const ALLOWED_FIELDS: Record<string, ReadonlySet<string>> = {
  "/sign-up/email": new Set(["name", "email", "password", "username", "displayUsername", "callbackURL", "rememberMe"]),
  // Bare brukernavnet endres via Better Auth (UsernameForm). Navn og bilde endres i lib/profiles.ts.
  "/update-user": new Set(["username", "displayUsername"]),
};

export const NAME_MAX_LENGTH = 100;

// Feilmelding (norsk mal) hvis forespørselen inneholder noe den ikke skal, ellers null.
export function checkAuthBody(path: string, body: unknown): string | null {
  const allowed = ALLOWED_FIELDS[path];
  if (!allowed) return null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Ugyldig forespørsel.";
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !allowed.has(key))) return "Ugyldig forespørsel.";

  if (path === "/sign-up/email") {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) return "Skriv inn navnet ditt.";
    if (name.length > NAME_MAX_LENGTH) return "Navnet kan ha maks 100 tegn.";
  }

  // Visningsnavnet er brukernavnet med store bokstaver, ikke et fritt felt.
  if ("displayUsername" in data) {
    const display = typeof data.displayUsername === "string" ? data.displayUsername : "";
    const username = typeof data.username === "string" ? data.username : "";
    if (!username || display.toLowerCase() !== username.toLowerCase()) return "Ugyldig forespørsel.";
  }
  return null;
}

// Grenser per konto, i tillegg til grensene per IP-adresse i lib/auth.ts. IP-adressen kan
// skiftes (eller forfalskes bak noen proxyer), men da treffer man fortsatt grensen for kontoen.
export type AuthThrottle = { rule: "loginAccount" | "authEmail"; key: string };

const LOGIN_PATHS: Record<string, "email" | "username"> = {
  "/sign-in/email": "email",
  "/sign-in/username": "username",
};

// Alt som sender en e-post til en adresse.
const EMAIL_PATHS = new Set([
  "/send-verification-email",
  "/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
]);

// Adressen lagres ikke i klartekst i rate_bucket.
export const identifierKey = (value: string) =>
  createHash("sha256").update(value.trim().replace(/^@/, "").toLowerCase()).digest("hex").slice(0, 32);

export function authThrottleFor(path: string, body: unknown): AuthThrottle | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const field = LOGIN_PATHS[path] ?? (EMAIL_PATHS.has(path) ? "email" : null);
  const value = field ? data[field] : null;
  if (typeof value !== "string" || !value.trim()) return null;
  return { rule: LOGIN_PATHS[path] ? "loginAccount" : "authEmail", key: identifierKey(value) };
}

// Admin: rollen «admin» i databasen, eller en bekreftet e-post som står i ADMIN_EMAILS.
// Uten kravet om bekreftet e-post kunne hvem som helst registrere seg med en admin-adresse
// som ikke har konto ennå (særlig hvis e-postbekreftelse er av).
export type AdminCandidate = {
  role?: string | null;
  email?: string | null;
  emailVerified?: boolean | null;
  twoFactorEnabled?: boolean | null;
};

export function isAdminUser(u: AdminCandidate | null | undefined, adminEmails: ReadonlySet<string>) {
  if (!u) return false;
  if (u.role === "admin") return true;
  return Boolean(u.emailVerified && u.email && adminEmails.has(u.email.toLowerCase()));
}

// I produksjon må admin ha to-trinns innlogging før de kan moderere eller se skjult innhold.
export function adminNeeds2fa(u: AdminCandidate | null | undefined, env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" && !u?.twoFactorEnabled;
}
