"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import VerifyEmailCode from "@/components/auth/VerifyEmailCode";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authError } from "@/lib/auth-errors";

export default function LoginForm({ canResetPassword, devHint }: { canResetPassword: boolean; devHint: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get("neste");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Satt når e-posten ikke er bekreftet: da sendes en kode, og man skriver den inn her.
  const [verify, setVerify] = useState<{ identifier: string; email: string | null } | null>(null);

  // Bare interne stier, så lenken ikke kan sende brukeren til en annen side.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  const done = (username: string | null) => {
    router.push(safeNext ?? (username ? `/@${username}` : "/"));
    router.refresh();
  };

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
      const info = authError(error, "login");
      setPending(false);
      if (info.code === "EMAIL_NOT_VERIFIED") {
        setVerify({ identifier, email: isEmail ? identifier : null });
        return;
      }
      setError(info.message);
      return;
    }

    done((data?.user as { username?: string } | undefined)?.username ?? null);
  }

  if (verify) {
    return (
      <VerifyEmailCode
        identifier={verify.identifier}
        email={verify.email}
        devHint={devHint}
        onVerified={done}
        onBack={() => setVerify(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="identifier" className={labelClass}>
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
          placeholder="navn@eksempel.no"
          className={inputClass}
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            Passord
          </label>
          {canResetPassword && (
            <Link href="/glemt-passord" className="text-sm text-mist transition hover:text-fg">
              Glemt passordet?
            </Link>
          )}
        </div>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full" size="lg">
        {pending ? "Logger inn …" : "Logg inn"}
      </Button>
    </form>
  );
}
