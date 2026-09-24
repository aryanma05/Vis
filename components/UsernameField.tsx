"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { usernameAlternatives, usernameError } from "@/lib/username";
import { ui } from "@/components/ui";

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

  let message: React.ReactNode = <p className={ui.hint}>{hint}</p>;
  if (error) message = <p className={ui.fieldError}>{error}</p>;
  else if (check.status === "checking") message = <p className={ui.hint}>Sjekker om det er ledig …</p>;
  else if (check.status === "free") message = <p className="mt-1 text-sm text-ice">✓ vis.no/@{value} er ledig</p>;
  else if (check.status === "current") message = <p className={ui.hint}>Dette er brukernavnet ditt nå.</p>;
  else if (check.status === "invalid") message = <p className={ui.fieldError}>{check.problem}</p>;
  else if (check.status === "error") {
    message = <p className={ui.hint}>Fikk ikke sjekket om navnet er ledig akkurat nå. Du kan prøve likevel.</p>;
  } else if (check.status === "taken") {
    message = (
      <div className="mt-1 text-sm">
        <p className="text-red-400">@{value} er tatt.</p>
        {check.suggestions && check.suggestions.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-mist">
            Ledige:
            {check.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-fg transition hover:border-ice"
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
      <label htmlFor="handle" className={ui.label}>
        Brukernavn
      </label>
      <div
        className={`flex items-center rounded-lg border bg-ink focus-within:ring-2 ${
          invalid ? "border-red-500/60 focus-within:ring-red-500/20" : "border-line focus-within:border-ice focus-within:ring-ice/20"
        }`}
      >
        <span className="select-none pl-4 text-mist">vis.no/@</span>
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
          className="w-full min-w-0 bg-transparent py-3 pr-4 text-fg outline-none"
        />
      </div>
      <div id="handle-status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
