"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { ui } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("neste");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    setPending(true);
    setError(null);

    // Både e-post og brukernavn fungerer.
    const { data, error } = identifier.includes("@")
      ? await authClient.signIn.email({ email: identifier, password })
      : await authClient.signIn.username({ username: identifier.toLowerCase(), password });

    if (error) {
      setError(authErrorMessage(error));
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
        <input id="identifier" name="identifier" type="text" required autoComplete="username" className={ui.input} />
      </div>

      <div>
        <label htmlFor="password" className={ui.label}>
          Passord
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={ui.input} />
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <button type="submit" disabled={pending} className={`${ui.primary} mt-2 w-full`}>
        {pending ? "Logger inn…" : "Logg inn"}
      </button>
    </form>
  );
}
