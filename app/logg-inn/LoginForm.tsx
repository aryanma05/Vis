"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/LocaleProvider";
import VerifyEmailCode from "@/components/auth/VerifyEmailCode";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authError } from "@/lib/auth-errors";
import { RESET_EMAIL_KEY } from "@/lib/email";
import { safeInternalPath } from "@/lib/safe-path";

// Feil som betyr «feil passord»: da er det naturlig å tilby nytt passord.
const WRONG_PASSWORD = new Set(["INVALID_EMAIL_OR_PASSWORD", "INVALID_USERNAME_OR_PASSWORD", "INVALID_PASSWORD"]);

// Tar med e-posten til «Glemt passordet?», så man slipper å skrive den igjen.
// (sessionStorage, ikke adressen, så e-posten ikke havner i historikk og logger.)
function rememberEmailForReset(form: HTMLFormElement | null) {
  const value = String(new FormData(form ?? undefined).get("identifier") ?? "").trim();
  try {
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) sessionStorage.setItem(RESET_EMAIL_KEY, value);
  } catch {}
}

export default function LoginForm({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const t = useT();
  const next = useSearchParams().get("neste");
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<{ message: string; wrongPassword: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  // Satt når e-posten ikke er bekreftet: da sendes en kode, og man skriver den inn her.
  const [verify, setVerify] = useState<{ identifier: string; email: string | null } | null>(null);

  // Bare interne stier, så lenken ikke kan sende brukeren til en annen side.
  const safeNext = safeInternalPath(next);
  const done = (username: string | null) => {
    router.push(safeNext ?? (username ? `/@${username}` : "/"));
    router.refresh();
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get("identifier")).trim();
    const password = String(form.get("password"));
    if (!identifier || !password) return setError({ message: "Fyll inn e-post eller brukernavn og passord.", wrongPassword: false });
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
      setError({ message: info.message, wrongPassword: WRONG_PASSWORD.has(info.code ?? "") || info.code?.startsWith("USERNAME_") === true });
      return;
    }

    // To-trinns innlogging er på: koden fra appen skrives inn på neste side.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/logg-inn/to-trinn${safeNext ? `?neste=${encodeURIComponent(safeNext)}` : ""}`);
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
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="identifier" className={labelClass}>
          {t("E-post eller brukernavn")}
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
          placeholder={t("navn@eksempel.no")}
          className={inputClass}
        />
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            {t("Passord")}
          </label>
          <Link href="/glemt-passord" onClick={() => rememberEmailForReset(formRef.current)} className="text-sm text-mist transition hover:text-fg">
            {t("Glemt passordet?")}
          </Link>
        </div>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p>{t(error.message)}</p>
          {error.wrongPassword && (
            <Link
              href="/glemt-passord"
              onClick={() => rememberEmailForReset(formRef.current)}
              className="mt-1.5 inline-block font-semibold text-fg underline-offset-4 hover:underline"
            >
              {t("Glemt passordet? Lag et nytt på et minutt →")}
            </Link>
          )}
        </div>
      )}

      <Button type="submit" loading={pending} className="w-full" size="lg">
        {t(pending ? "Logger inn …" : "Logg inn")}
      </Button>
    </form>
  );
}
