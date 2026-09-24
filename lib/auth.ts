import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP, username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteAllFilesOfUser } from "@/lib/account";
import { canSendEmail, resetPasswordEmail, sendEmail, verificationCodeEmail } from "@/lib/mailer";
import {
  isValidUsername,
  toUsernameBase,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/username";

const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Koden i e-posten virker så lenge.
export const EMAIL_CODE_MINUTES = 10;

// E-poster som automatisk får admin-rollen (kommaseparert). Admin kan se rapporter
// og moderere innhold på /admin.
export const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

async function isUsernameTaken(candidate: string) {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, candidate))
    .limit(1);
  return Boolean(row);
}

// Brukes når noen registrerer seg uten å velge brukernavn selv (f.eks. via
// GitHub). Prøver "base", deretter "base-1234" osv.
async function findAvailableUsername(base: string) {
  if (!(await isUsernameTaken(base))) return base;
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}-${suffix}`;
    if (!(await isUsernameTaken(candidate))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

// Alle adressene appen selv kjører på. Står BETTER_AUTH_URL litt feil (f.eks. med / på
// slutten, eller en annen Render-adresse enn den man åpner), avviser Better Auth ellers
// alle innlogginger og registreringer med INVALID_ORIGIN.
const ownOrigins = [process.env.BETTER_AUTH_URL, process.env.RENDER_EXTERNAL_URL, vercelUrl].flatMap((url) => {
  try {
    return url ? [new URL(url).origin] : [];
  } catch {
    return [];
  }
});

export const auth = betterAuth({
  appName: "Vis",
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.RENDER_EXTERNAL_URL ?? vercelUrl,
  trustedOrigins: ownOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    // Man må bekrefte e-posten (med en sekssifret kode) før man kan logge inn, så ingen
    // kan lage kontoer i andres navn. Slås bare på når vi faktisk kan sende e-post (se
    // lib/mailer.ts). Da svarer registreringen også likt uansett om e-posten finnes fra
    // før, så ingen kan sjekke hvem som har konto.
    requireEmailVerification: canSendEmail,
    // Eldre lenker for nytt passord (appen bruker nå kode, se emailOTP under).
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user.email, user.name, url));
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    // Nytt passord logger ut alle andre enheter.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Selve e-posten (med koden) sendes av emailOTP-pluginen under.
    sendOnSignUp: canSendEmail,
    // Prøver man å logge inn uten å ha bekreftet, sendes en ny kode.
    sendOnSignIn: canSendEmail,
    autoSignInAfterVerification: true,
  },
  user: {
    deleteUser: {
      enabled: true,
      // Alt annet (profil, prosjekter, CV, kommentarer, filer i databasen) slettes
      // automatisk sammen med brukeren (ON DELETE CASCADE).
      beforeDelete: async (user) => {
        await deleteAllFilesOfUser(user.id);
      },
    },
  },
  socialProviders: {
    ...(githubConfigured
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            // Brukernavnet settes i databaseHooks under, så et opptatt
            // GitHub-navn ikke stopper registreringen.
            mapProfileToUser: (profile) => ({ displayUsername: profile.login }),
          },
        }
      : {}),
    ...(googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account" as const,
          },
        }
      : {}),
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // GitHub-kontoen kan ha en annen e-post enn Vis-kontoen når man kobler
      // til GitHub i etterkant. Gjelder bare eksplisitt kobling mens man er innlogget.
      allowDifferentEmails: true,
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    // Standarden er 3 forsøk per 10 sekunder, som er lite når man retter feil i
    // skjemaet og sender på nytt. Klient-IP-en hentes i app/api/auth/[...all]/route.ts.
    customRules: {
      "/sign-up/email": { window: 60, max: 10 },
      "/sign-in/*": { window: 60, max: 10 },
      // Hver av disse sender en e-post, så de holdes lavt.
      "/send-verification-email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
      "/email-otp/send-verification-otp": { window: 60, max: 3 },
      "/email-otp/request-password-reset": { window: 60, max: 3 },
      "/email-otp/check-verification-otp": { window: 60, max: 10 },
      "/email-otp/verify-email": { window: 60, max: 10 },
      "/email-otp/reset-password": { window: 60, max: 10 },
      "/delete-user": { window: 60, max: 5 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(data) {
          const role = adminEmails.has(data.email.toLowerCase()) ? { role: "admin" } : {};
          if (data.username) return { data: { ...data, ...role } };
          const source =
            (data.displayUsername as string | undefined) ||
            data.email.split("@")[0] ||
            data.name;
          const generated = await findAvailableUsername(toUsernameBase(source));
          return {
            data: {
              ...data,
              ...role,
              username: generated,
              displayUsername: data.displayUsername ?? generated,
            },
          };
        },
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: USERNAME_MIN_LENGTH,
      maxUsernameLength: USERNAME_MAX_LENGTH,
      usernameValidator: isValidUsername,
      validationOrder: { username: "post-normalization" },
    }),
    // Sekssifrede koder på e-post, både for å bekrefte adressen og for nytt passord.
    emailOTP({
      otpLength: 6,
      expiresIn: EMAIL_CODE_MINUTES * 60,
      allowedAttempts: 5,
      storeOTP: "hashed",
      disableSignUp: true,
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        await sendEmail(verificationCodeEmail(email, otp, type, EMAIL_CODE_MINUTES));
      },
    }),
    // Roller og utestenging. Selve modereringen skjer i lib/admin.ts.
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      bannedUserMessage: "Kontoen din er stengt av en moderator.",
    }),
    // Må være sist, slik at cookies settes riktig fra Server Actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export const isGithubConfigured = githubConfigured;
export const isGoogleConfigured = googleConfigured;
export const isEmailEnabled = canSendEmail;
