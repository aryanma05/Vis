"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resendEmailCodeAction } from "@/app/actions/auth";
import VerifyEmailCode from "@/components/auth/VerifyEmailCode";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { emailError } from "@/lib/email";

// Ber om en ny kode og lar brukeren skrive den inn her.
export default function ResendVerification({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    const problem = emailError(trimmed);
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const result = await resendEmailCodeAction(trimmed);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSentTo(trimmed);
  }

  if (sentTo) {
    return (
      <VerifyEmailCode
        identifier={sentTo}
        email={sentTo}
        devHint={devHint}
        initialCooldown={45}
        onVerified={() => {
          router.push("/velkommen");
          router.refresh();
        }}
        onBack={() => setSentTo(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          E-post
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={pending} className="w-full">
        Send ny kode
      </Button>
    </form>
  );
}
