"use client";

import { useState } from "react";
import CheckEmail from "@/components/CheckEmail";
import { ui } from "@/components/ui";
import { emailError } from "@/lib/email";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export default function ResendVerification() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    const problem = emailError(trimmed);
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const { error } = await authClient.sendVerificationEmail({ email: trimmed, callbackURL: "/epost-bekreftet" });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setSentTo(trimmed);
  }

  if (sentTo) return <CheckEmail email={sentTo} />;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
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
        {pending ? "Sender…" : "Send ny lenke"}
      </button>
    </form>
  );
}
