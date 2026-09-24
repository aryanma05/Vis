"use client";

import { useState } from "react";
import { buttonClass, Spinner } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Provider = "github" | "google";

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[18px]">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-[18px] fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// mode "signin": logg inn / registrer med GitHub eller Google.
// mode "link": koble kontoen til den man er innlogget med (for repo-import).
export function OAuthButton({
  provider,
  mode = "signin",
  callbackURL = "/",
  label,
}: {
  provider: Provider;
  mode?: "signin" | "link";
  callbackURL?: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const name = provider === "google" ? "Google" : "GitHub";

  async function onClick() {
    setPending(true);
    setError(null);
    const result =
      mode === "link"
        ? await authClient.linkSocial({ provider, callbackURL })
        : await authClient.signIn.social({ provider, callbackURL });
    if (result?.error) {
      setError(authErrorMessage(result.error));
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onClick} disabled={pending} className={buttonClass({ variant: "secondary", className: "w-full" })}>
        {pending ? <Spinner /> : <ProviderIcon provider={provider} />}
        {pending ? `Sender deg til ${name} …` : (label ?? `Fortsett med ${name}`)}
      </button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export default function GithubButton(props: { mode?: "signin" | "link"; callbackURL?: string; label?: string }) {
  return <OAuthButton provider="github" {...props} />;
}

// Innlogging med de tjenestene som er satt opp, pluss en skillelinje mot e-post-skjemaet.
export function SocialLogins({
  github,
  google,
  callbackURL,
  divider = "eller med e-post",
}: {
  github: boolean;
  google: boolean;
  callbackURL: string;
  divider?: string;
}) {
  if (!github && !google) return null;
  return (
    <div className="group-has-[[data-verify-step]]:hidden">
      <div className="grid gap-2.5">
        {google && <OAuthButton provider="google" callbackURL={callbackURL} />}
        {github && <OAuthButton provider="github" callbackURL={callbackURL} />}
      </div>
      <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-mist/60">
        <span className="h-px flex-1 bg-line" />
        {divider}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
