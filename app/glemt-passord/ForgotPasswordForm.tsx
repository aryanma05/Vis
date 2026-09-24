"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { emailError } from "@/lib/email";
import { ui } from "@/components/ui";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    const problem = emailError(trimmed);
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email: trimmed, redirectTo: "/nytt-passord" });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setSent(true);
  }

  // Svaret er det samme uansett om e-posten har en konto, så ingen kan finne ut hvem som er registrert.
  if (sent) {
    return (
      <p role="status" className="mt-6 rounded-lg border border-line bg-ink px-4 py-3 text-mist">
        Hvis <span className="font-medium text-fg">{email.trim()}</span> har en konto hos oss, har vi sendt en lenke
        for å lage nytt passord. Lenken virker i én time.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <p className="text-mist">Skriv inn e-posten du registrerte deg med, så sender vi en lenke.</p>
      <div>
        <label htmlFor="email" className={ui.label}>
          E-post
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={ui.input}
        />
      </div>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.primary} w-full`}>
        {pending ? "Sender…" : "Send lenke"}
      </button>
    </form>
  );
}
