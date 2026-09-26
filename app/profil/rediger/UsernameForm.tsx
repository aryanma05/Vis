"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UsernameField, { useUsernameCheck } from "@/components/UsernameField";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { usernameError } from "@/lib/username";

// Egen form, fordi brukernavnet endres via Better Auth og ikke profil-actionen.
export default function UsernameForm({ current }: { current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
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
      toast.success(`Profilen din ligger nå på vis.no/@${value}`);
      router.push(`/profil/rediger`);
      router.refresh();
    } catch {
      setError(authErrorMessage({}));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Section title="Profiladresse" description="Brukernavnet ditt. Bytter du, slutter gamle lenker til profilen å virke.">
        <div className="max-w-md">
          <UsernameField
            value={value}
            check={check}
            error={error}
            onChange={(next) => {
              setValue(next);
              setError(null);
            }}
          />
          <Button type="submit" variant="secondary" size="sm" className="mt-4" loading={pending} disabled={value === current || !value}>
            Bytt brukernavn
          </Button>
        </div>
      </Section>
    </form>
  );
}
