"use client";

import Link from "next/link";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { ui } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setError("Passordet må ha minst 8 tegn.");
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="mt-6 space-y-4">
        <p className="text-mist">Passordet er endret, og du er logget ut på alle andre enheter.</p>
        <Link href="/logg-inn" className={`${ui.primary} inline-block`}>
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className={ui.label}>
          Nytt passord
        </label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Minst 8 tegn"
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${ui.primary} w-full`}>
        {pending ? "Lagrer…" : "Lagre nytt passord"}
      </button>
    </form>
  );
}
