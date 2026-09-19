import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "@/lib/auth";

// Brukernavn settes alltid når kontoen opprettes (se lib/auth.ts).
export type CurrentUser = Session["user"] & { username: string };

// Én oppslag per request, uansett hvor mange komponenter som spør.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session?.user.username) return null;
  return { ...session.user, username: session.user.username };
}

// For sider som krever innlogging.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn");
  return user;
}

// For Server Actions: kaster i stedet for å redirecte, så kalleren får en feil.
export async function requireUserForAction() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("Du må være logget inn.");
    this.name = "AuthError";
  }
}
