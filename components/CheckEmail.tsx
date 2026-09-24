"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

// «Sjekk e-posten din» etter registrering, med mulighet til å sende lenken på nytt.
export default function CheckEmail({ email, callbackURL = "/epost-bekreftet" }: { email: string; callbackURL?: string }) {
  const [cooldown, setCooldown] = useState(30);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setCooldown(60);
    setMessage(null);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL });
    setMessage(error ? { ok: false, text: authErrorMessage(error) } : { ok: true, text: "Ny lenke sendt." });
  }

  return (
    <div className="mt-8 text-center" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ice/10 text-2xl text-ice" aria-hidden="true">
        ✉
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Sjekk e-posten din</h2>
      <p className="mt-3 text-mist">
        Vi har sendt en lenke til <span className="font-medium text-fg">{email}</span>. Trykk på den for å bekrefte
        adressen, så er kontoen klar.
      </p>
      <p className="mt-2 text-sm text-mist/80">Finner du den ikke? Se i søppelpost eller «Kampanjer».</p>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="mt-6 text-sm font-medium text-ice hover:underline disabled:cursor-not-allowed disabled:text-mist/60 disabled:no-underline"
      >
        {cooldown > 0 ? `Send på nytt om ${cooldown} s` : "Send lenken på nytt"}
      </button>
      {message && <p className={`mt-2 text-sm ${message.ok ? "text-emerald-300" : "text-red-400"}`}>{message.text}</p>}
    </div>
  );
}
