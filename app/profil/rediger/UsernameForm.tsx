"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { usernameError } from "@/lib/username";
import { Section } from "@/components/form";
import UsernameField, { useUsernameCheck } from "@/components/UsernameField";
import { ui } from "@/components/ui";

// Egen form, fordi brukernavnet endres via Better Auth og ikke profil-actionen.
export default function UsernameForm({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const check = useUsernameCheck(value, { current });

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = usernameError(value);
    if (problem) return setError(problem);
    if (check.status === "taken") return;

    setPending(true);
    setError(null);
    try {
      // displayUsername beholder store bokstaver, username lagres med små.
      const { error } = await authClient.updateUser({ username: value, displayUsername: value });
      if (error) return setError(authErrorMessage(error));
      setSaved(value);
      router.refresh();
    } catch {
      setError(authErrorMessage({}));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Section
        title="Brukernavn"
        description="Adressen til profilen din. Bytter du, slutter gamle lenker til profilen å virke."
      >
        <div className="max-w-md">
          <UsernameField
            value={value}
            check={check}
            error={error}
            onChange={(next) => {
              setValue(next);
              setError(null);
              setSaved(null);
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending || value === current || !value} className={`${ui.secondary} py-2.5`}>
              {pending ? "Lagrer…" : "Bytt brukernavn"}
            </button>
            {saved && <p className="text-sm text-ice">✓ Profilen din ligger nå på vis.no/@{saved}</p>}
          </div>
        </div>
      </Section>
    </form>
  );
}
