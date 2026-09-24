import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  isValidUsername,
  toUsernameBase,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/username";

const githubConfigured = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
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

export const auth = betterAuth({
  appName: "Vis",
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
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
  },
  socialProviders: githubConfigured
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          // Brukernavnet settes i databaseHooks under, så et opptatt
          // GitHub-navn ikke stopper registreringen.
          mapProfileToUser: (profile) => ({ displayUsername: profile.login }),
        },
      }
    : undefined,
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
  },
  databaseHooks: {
    user: {
      create: {
        async before(data) {
          if (data.username) return;
          const source =
            (data.displayUsername as string | undefined) ||
            data.email.split("@")[0] ||
            data.name;
          const generated = await findAvailableUsername(toUsernameBase(source));
          return {
            data: {
              ...data,
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
    // Må være sist, slik at cookies settes riktig fra Server Actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export const isGithubConfigured = githubConfigured;
