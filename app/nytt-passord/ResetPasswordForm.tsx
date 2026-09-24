"use client";

import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { Button, ButtonLink } from "@/components/ui/button";
import { labelClass } from "@/components/ui/field";
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
      <div role="status" className="space-y-5">
        <p className="text-mist">Passordet er endret, og du er logget ut på alle andre enheter.</p>
        <ButtonLink href="/logg-inn">Logg inn</ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="password" className={labelClass}>
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
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={pending} className="w-full" size="lg">
        Lagre nytt passord
      </Button>
    </form>
  );
}
