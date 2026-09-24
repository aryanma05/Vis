"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import PasswordInput from "@/components/PasswordInput";
import { ui } from "@/components/ui";

export default function LoginForm({ canResetPassword }: { canResetPassword: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get("neste");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    if (!identifier || !password) return setError("Fyll inn e-post eller brukernavn og passord.");
    setPending(true);
    setError(null);

    // Både e-post og brukernavn (også med @ foran) fungerer.
    const isEmail = /^[^@\s]+@[^@\s]+$/.test(identifier);
    let result;
    try {
      result = isEmail
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier.replace(/^@/, "").toLowerCase(), password });
    } catch {
      result = { data: null, error: {} };
    }
    const { data, error } = result;

    if (error) {
      setError(authErrorMessage(error, "login"));
      setPending(false);
      return;
    }

    const username = (data?.user as { username?: string } | undefined)?.username;
    // Bare interne stier, så lenken ikke kan sende brukeren til en annen side.
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
    router.push(safeNext ?? (username ? `/@${username}` : "/"));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="identifier" className={ui.label}>
          E-post eller brukernavn
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={ui.input}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className={ui.label}>
            Passord
          </label>
          {canResetPassword && (
            <Link href="/glemt-passord" className="text-sm text-mist hover:text-fg hover:underline">
              Glemt passordet?
            </Link>
          )}
        </div>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
      </div>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${ui.primary} mt-2 w-full`}>
        {pending ? "Logger inn…" : "Logg inn"}
      </button>
    </form>
  );
}
