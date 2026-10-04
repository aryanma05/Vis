"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, twoFactorClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Innloggingsskjemaet sender selv videre til /logg-inn/to-trinn når det trengs.
  plugins: [usernameClient(), emailOTPClient(), adminClient(), twoFactorClient({ onTwoFactorRedirect: () => {} })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
