"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import CodeSlots, { type CodeStatus } from "@/components/auth/CodeSlots";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { emailError } from "@/lib/email";

type Step = "email" | "code" | "password";

// Nytt passord i tre steg: e-post, sekssifret kode, nytt passord. Etterpå logges man inn.
export default function ForgotPasswordForm({ devHint }: { devHint: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState(52);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSlot(Math.max(34, Math.min(56, Math.floor((el.clientWidth - 50) / 6))));
    measure();
    const o = new ResizeObserver(measure);
    o.observe(el);
    return () => o.disconnect();
  }, [step]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = email.trim();
    const problem = emailError(trimmed);
    if (problem) return setError(problem);
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: trimmed });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setStep("code");
    setStatus("idle");
    setCooldown(45);
  }

  async function checkCode(value: string) {
    setPending(true);
    setError(null);
    const { data, error } = await authClient.emailOtp.checkVerificationOtp({ email: email.trim(), type: "forget-password", otp: value });
    setPending(false);
    if (error || !data?.success) {
      setStatus("error");
      return setError(authErrorMessage(error ?? { code: "INVALID_OTP", status: 400 }));
    }
    setCode(value);
    setStatus("success");
    setTimeout(() => setStep("password"), 700);
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError("Passordet må ha minst 8 tegn.");
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: code, password });
    if (error) {
      setPending(false);
      return setError(authErrorMessage(error));
    }
    const signedIn = await authClient.signIn.email({ email: email.trim(), password });
    const username = (signedIn.data?.user as { username?: string } | undefined)?.username;
    router.push(username ? `/@${username}` : "/logg-inn");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} noValidate className="space-y-5">
        <div>
          <label htmlFor="email" className={labelClass}>
            E-posten du registrerte deg med
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="navn@eksempel.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={pending} className="w-full" size="lg">
          Send kode
        </Button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <div className="animate-[rise_300ms_var(--ease-out-expo)]">
        <p className="leading-7 text-mist">
          Hvis <span className="font-medium text-fg">{email.trim()}</span> har en konto, har vi sendt en sekssifret kode dit.
        </p>
        <div ref={boxRef} className="mt-6">
          <CodeSlots
            autoFocus
            status={status}
            disabled={pending}
            slotSize={slot}
            gap={10}
            radius={Math.round(slot * 0.27)}
            onChange={() => status === "error" && setStatus("idle")}
            onComplete={checkCode}
          />
        </div>
        <div className="mt-4 min-h-6 text-sm" aria-live="polite">
          {pending && <p className="text-mist">Sjekker koden …</p>}
          {error && !pending && <p className="text-danger">{error}</p>}
        </div>
        {devHint && (
          <p className="mt-2 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-[13px] text-mist">
            Utviklingsmodus: koden står i terminalen der <code className="font-mono">npm run dev</code> kjører.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={() => sendCode()}
            className="font-medium text-ice hover:underline disabled:cursor-not-allowed disabled:text-mist/60 disabled:no-underline"
          >
            {cooldown > 0 ? `Send ny kode om ${cooldown} s` : "Send ny kode"}
          </button>
          <button type="button" onClick={() => setStep("email")} className="text-mist hover:text-fg">
            Bruk en annen e-post
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={savePassword} noValidate className="animate-[rise_300ms_var(--ease-out-expo)] space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <KeyRound className="size-4 shrink-0" aria-hidden="true" />
        Koden stemmer. Velg et nytt passord.
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Nytt passord
        </label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Minst 8 tegn"
          maxLength={128}
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={pending} className="w-full" size="lg">
        Lagre og logg inn
      </Button>
      <p className="text-center text-[13px] text-mist">Du blir logget ut på alle andre enheter.</p>
    </form>
  );
}
