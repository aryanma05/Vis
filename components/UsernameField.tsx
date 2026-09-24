"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { usernameAlternatives, usernameError } from "@/lib/username";
import { FieldError, Hint, labelClass } from "@/components/ui/field";

export type UsernameStatus = "idle" | "checking" | "free" | "taken" | "invalid" | "error" | "current";

type Result = { value: string; status: UsernameStatus; problem?: string; suggestions?: string[] };

async function isAvailable(username: string) {
  const { data, error } = await authClient.isUsernameAvailable({ username });
  if (error || !data) throw error ?? new Error("Tomt svar");
  return data.available;
}

// Sjekker brukernavnet mens man skriver (litt forsinket, så vi ikke spør for hvert tegn).
// `current` er brukernavnet man har nå, når man endrer det i innstillingene.
export function useUsernameCheck(value: string, { current, name = "" }: { current?: string; name?: string } = {}) {
  const [result, setResult] = useState<Result | null>(null);
  const nameRef = useRef(name);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const problem = usernameError(value);
      if (problem) return setResult({ value, status: "invalid", problem });
      if (current && value.toLowerCase() === current.toLowerCase()) return setResult({ value, status: "current" });
      try {
        if (await isAvailable(value)) {
          if (!cancelled) setResult({ value, status: "free" });
          return;
        }
        const candidates = usernameAlternatives(value, nameRef.current);
        const checked = await Promise.all(candidates.map((c) => isAvailable(c).then((ok) => (ok ? c : null), () => null)));
        const suggestions = checked.filter((c): c is string => c !== null).slice(0, 3);
        if (!cancelled) setResult({ value, status: "taken", suggestions });
      } catch {
        if (!cancelled) setResult({ value, status: "error" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, current]);

  if (!value) return { status: "idle" as const };
  if (result?.value !== value) return { status: "checking" as const };
  return result;
}

export default function UsernameField({
  value,
  onChange,
  check,
  error,
  hint = "Lenken til profilen din. Bokstaver a–z, tall og - _ .",
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  check: { status: UsernameStatus; problem?: string; suggestions?: string[] };
  // Feil fra serveren etter innsending, vises i stedet for statusen.
  error?: React.ReactNode;
  hint?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const invalid = Boolean(error) || check.status === "invalid" || check.status === "taken";

  let message: React.ReactNode = <Hint>{hint}</Hint>;
  if (error) message = <FieldError>{error}</FieldError>;
  else if (check.status === "checking") message = <Hint>Sjekker om det er ledig …</Hint>;
  else if (check.status === "free") message = <p className="mt-1.5 text-[13px] font-medium text-success">✓ vis.no/@{value} er ledig</p>;
  else if (check.status === "current") message = <Hint>Dette er brukernavnet ditt nå.</Hint>;
  else if (check.status === "invalid") message = <FieldError>{check.problem}</FieldError>;
  else if (check.status === "error") {
    message = <Hint>Fikk ikke sjekket om navnet er ledig akkurat nå. Du kan prøve likevel.</Hint>;
  } else if (check.status === "taken") {
    message = (
      <div className="mt-1.5 text-[13px]">
        <p className="text-danger">@{value} er tatt.</p>
        {check.suggestions && check.suggestions.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-mist">
            Ledige:
            {check.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-fg transition hover:border-ice hover:text-ice"
              >
                {s}
              </button>
            ))}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="handle" className={labelClass}>
        Brukernavn
      </label>
      <div
        className={`flex items-center rounded-xl border bg-ink-2/50 transition focus-within:ring-4 ${
          invalid ? "border-danger/70 focus-within:ring-danger/10" : "border-line hover:border-mist/35 focus-within:border-ice/70 focus-within:ring-ice/10"
        }`}
      >
        <span className="select-none pl-4 text-[15px] text-mist/80">vis.no/@</span>
        <input
          ref={inputRef}
          id="handle"
          // Ikke "username": da fyller nettleseren og passordhåndtereren inn e-posten her.
          name="handle"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={39}
          value={value}
          aria-invalid={invalid}
          aria-describedby="handle-status"
          onChange={(e) => onChange(e.target.value.replace(/\s/g, "").replace(/^@/, ""))}
          className="w-full min-w-0 bg-transparent py-2.5 pr-4 text-[15px] text-fg outline-none"
        />
      </div>
      <div id="handle-status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
