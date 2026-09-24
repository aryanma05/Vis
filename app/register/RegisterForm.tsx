"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authError, type AuthField } from "@/lib/auth-errors";
import { emailError, emailSuggestion } from "@/lib/email";
import { toUsernameBase, usernameError } from "@/lib/username";
import CheckEmail from "@/components/CheckEmail";
import PasswordInput from "@/components/PasswordInput";
import UsernameField, { useUsernameCheck } from "@/components/UsernameField";
import { ui } from "@/components/ui";

type Errors = Partial<Record<AuthField, React.ReactNode>>;

export default function RegisterForm() {
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
  // Satt når kontoen er laget og e-posten må bekreftes før man kan logge inn.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const check = useUsernameCheck(username, { name });

  const nameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearError = (field: AuthField) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

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
        ...(username ? { username } : {}),
        // Hit kommer man etter å ha trykket på lenken i e-posten.
        callbackURL: "/epost-bekreftet",
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

      // Uten innlogging (token) må e-posten bekreftes først.
      if (!data?.token) {
        setSentTo(trimmedEmail);
        setPending(false);
        return;
      }

      const created = (data?.user as { username?: string } | undefined)?.username;
      router.push(created ? `/@${created}` : "/");
      router.refresh();
    } catch {
      setFormError(authError({}).message);
      setPending(false);
    }
  }

  if (sentTo) return <CheckEmail email={sentTo} />;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className={ui.label}>
          Navn
        </label>
        <input
          ref={nameRef}
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Ditt navn"
          maxLength={100}
          value={name}
          aria-invalid={Boolean(errors.name)}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
            if (!usernameTouched) setUsername(e.target.value.trim() ? toUsernameBase(e.target.value) : "");
          }}
          className={`${ui.input} ${errors.name ? "border-red-500/60" : ""}`}
        />
        {errors.name && <p className={ui.fieldError}>{errors.name}</p>}
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
        <label htmlFor="email" className={ui.label}>
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
          className={`${ui.input} ${errors.email ? "border-red-500/60" : ""}`}
        />
        {errors.email && <p className={ui.fieldError}>{errors.email}</p>}
        {suggestedEmail && (
          <p className="mt-1 text-sm text-mist">
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
        <label htmlFor="password" className={ui.label}>
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
          <p className={ui.fieldError}>{errors.password}</p>
        ) : (
          password.length > 0 &&
          password.length < 8 && <p className={ui.hint}>{8 - password.length} tegn til.</p>
        )}
      </div>

      {formError && (
        <p role="alert" className={ui.error}>
          {formError}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${ui.primary} mt-2 w-full`}>
        {pending ? "Oppretter konto…" : "Opprett konto"}
      </button>

      <p className="text-center text-xs leading-5 text-mist/80">
        Navnet, brukernavnet og det du legger ut er offentlig. E-posten din vises aldri.{" "}
        <Link href="/personvern" className="underline underline-offset-2 hover:text-fg">
          Slik tar vi vare på dataene dine
        </Link>
        .
      </p>
    </form>
  );
}
