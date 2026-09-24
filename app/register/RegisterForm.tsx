"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VerifyEmailCode from "@/components/auth/VerifyEmailCode";
import PasswordInput from "@/components/PasswordInput";
import UsernameField, { useUsernameCheck } from "@/components/UsernameField";
import { Button } from "@/components/ui/button";
import { FieldError, Hint, inputClass, labelClass } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authError, type AuthField } from "@/lib/auth-errors";
import { emailError, emailSuggestion } from "@/lib/email";
import { toUsernameBase, usernameError } from "@/lib/username";

type Errors = Partial<Record<AuthField, React.ReactNode>>;

// Hvor sterkt passordet er, grovt anslått (lengde og variasjon).
function passwordStrength(pw: string) {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[A-ZÆØÅ]/.test(pw) && /[a-zæøå]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9æøåÆØÅ]/.test(pw)) score++;
  return Math.min(score, 4);
}
const STRENGTH = ["For kort", "Svakt", "Greit", "Bra", "Sterkt"];

export default function RegisterForm({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [suggestedEmail, setSuggestedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Satt når kontoen er laget og e-posten må bekreftes med kode.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const check = useUsernameCheck(username, { name });

  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearError = (field: AuthField) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  const strength = passwordStrength(password);

  function showErrors(next: Errors) {
    setErrors(next);
    const fields = [
      [next.name, nameRef],
      [next.username, usernameRef],
      [next.email, emailRef],
      [next.password, passwordRef],
    ] as const;
    fields.find(([error]) => error)?.[1].current?.focus();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    const next: Errors = {};
    if (!name.trim()) next.name = "Skriv inn navnet ditt.";
    const usernameProblem = username ? usernameError(username) : null;
    if (usernameProblem) next.username = usernameProblem;
    const emailProblem = emailError(trimmedEmail);
    if (emailProblem) {
      next.email = emailProblem;
      setSuggestedEmail(emailSuggestion(trimmedEmail));
    }
    if (password.length < 8) next.password = "Passordet må ha minst 8 tegn.";
    if (Object.keys(next).length > 0) return showErrors(next);
    // Forslagene under feltet viser allerede hva som er ledig.
    if (check.status === "taken") return usernameRef.current?.focus();

    setPending(true);
    setErrors({});
    try {
      const { data, error } = await authClient.signUp.email({
        name: name.trim(),
        email: trimmedEmail,
        password,
        // Tomt felt: serveren lager et brukernavn (se lib/auth.ts).
        ...(username ? { username, displayUsername: username } : {}),
      });

      if (error) {
        const info = authError(error);
        if (info.code === "USER_ALREADY_EXISTS" || info.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          showErrors({
            email: (
              <>
                {info.message}{" "}
                <Link href="/logg-inn" className="font-medium text-fg underline">
                  Logg inn i stedet
                </Link>
              </>
            ),
          });
        } else if (info.field) {
          showErrors({ [info.field]: info.message });
        } else {
          setFormError(info.message);
        }
        setPending(false);
        return;
      }

      // Uten innlogging (token) må e-posten bekreftes med koden først.
      if (!data?.token) {
        setSentTo(trimmedEmail);
        setPending(false);
        return;
      }

      router.push("/velkommen");
      router.refresh();
    } catch {
      setFormError(authError({}).message);
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <VerifyEmailCode
        identifier={sentTo}
        email={sentTo}
        devHint={devHint}
        onVerified={() => {
          router.push("/velkommen");
          router.refresh();
        }}
        onBack={() => setSentTo(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="name" className={labelClass}>
          Navn
        </label>
        <input
          ref={nameRef}
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Fornavn Etternavn"
          maxLength={100}
          value={name}
          aria-invalid={Boolean(errors.name)}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
            if (!usernameTouched) setUsername(e.target.value.trim() ? toUsernameBase(e.target.value) : "");
          }}
          className={inputClass}
        />
        {errors.name && <FieldError>{errors.name}</FieldError>}
      </div>

      <UsernameField
        inputRef={usernameRef}
        value={username}
        check={check}
        error={errors.username}
        hint={username ? undefined : "Står feltet tomt, lager vi et brukernavn til deg."}
        onChange={(value) => {
          setUsernameTouched(true);
          setUsername(value);
          clearError("username");
        }}
      />

      <div>
        <label htmlFor="email" className={labelClass}>
          E-post
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="navn@eksempel.no"
          value={email}
          aria-invalid={Boolean(errors.email)}
          onChange={(e) => {
            setEmail(e.target.value);
            setSuggestedEmail(null);
            clearError("email");
          }}
          onBlur={() => setSuggestedEmail(emailSuggestion(email.trim()))}
          className={inputClass}
        />
        {errors.email && <FieldError>{errors.email}</FieldError>}
        {suggestedEmail && (
          <p className="mt-1.5 text-sm text-mist">
            Mente du{" "}
            <button
              type="button"
              onClick={() => {
                setEmail(suggestedEmail);
                setSuggestedEmail(null);
                clearError("email");
              }}
              className="font-medium text-ice underline"
            >
              {suggestedEmail}
            </button>
            ?
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Passord
        </label>
        <PasswordInput
          inputRef={passwordRef}
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="Minst 8 tegn"
          maxLength={128}
          value={password}
          invalid={Boolean(errors.password)}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError("password");
          }}
        />
        {errors.password ? (
          <FieldError>{errors.password}</FieldError>
        ) : password.length > 0 ? (
          <div className="mt-2 flex items-center gap-3" aria-live="polite">
            <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition ${
                    i <= strength ? (strength <= 1 ? "bg-danger" : strength === 2 ? "bg-warn" : "bg-success") : "bg-line"
                  }`}
                />
              ))}
            </div>
            <span className="w-16 text-right text-xs text-mist">
              {password.length < 8 ? `${8 - password.length} tegn til` : STRENGTH[strength]}
            </span>
          </div>
        ) : null}
      </div>

      {formError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="w-full" size="lg">
        {pending ? "Oppretter profilen …" : "Lag profilen min"}
      </Button>

      <Hint className="text-center leading-5">
        Navnet, brukernavnet og det du legger ut er offentlig. E-posten vises aldri. Ved å lage en profil godtar du{" "}
        <Link href="/vilkar" className="underline underline-offset-2 hover:text-fg">
          vilkårene
        </Link>{" "}
        og{" "}
        <Link href="/retningslinjer" className="underline underline-offset-2 hover:text-fg">
          retningslinjene
        </Link>
        .
      </Hint>
    </form>
  );
}
