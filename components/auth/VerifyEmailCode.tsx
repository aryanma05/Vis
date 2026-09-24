"use client";

import { useEffect, useRef, useState } from "react";
import { MailCheck } from "lucide-react";
import { resendEmailCodeAction, verifyEmailCodeAction } from "@/app/actions/auth";
import CodeSlots, { type CodeStatus } from "@/components/auth/CodeSlots";

// Plassen koderaden får: seks ruter som krymper på smale skjermer.
function useSlotSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ slot: 52, gap: 10 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const gap = width < 340 ? 6 : width < 400 ? 8 : 10;
      const slot = Math.max(34, Math.min(56, Math.floor((width - gap * 5) / 6)));
      setSize({ slot, gap });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

// «Skriv inn koden vi sendte deg». Brukes etter registrering, ved innlogging med
// ubekreftet e-post, og på kontosiden.
export default function VerifyEmailCode({
  identifier,
  email,
  onVerified,
  onBack,
  devHint = false,
  initialCooldown = 30,
}: {
  identifier: string;
  email?: string | null;
  onVerified: (username: string | null) => void;
  onBack?: () => void;
  devHint?: boolean;
  initialCooldown?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { slot, gap } = useSlotSize(boxRef);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(code: string) {
    setChecking(true);
    setMessage(null);
    const result = await verifyEmailCodeAction(identifier, code);
    setChecking(false);
    if (!result.ok) {
      setStatus("error");
      setMessage({ ok: false, text: result.error });
      return;
    }
    setStatus("success");
    setTimeout(() => onVerified(result.data?.username ?? null), 750);
  }

  async function resend() {
    setMessage(null);
    const result = await resendEmailCodeAction(identifier);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    setCooldown(60);
    setStatus("idle");
    setMessage({ ok: true, text: "Ny kode er sendt. Den forrige virker ikke lenger." });
  }

  return (
    <div data-verify-step className="animate-[rise_300ms_var(--ease-out-expo)]">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-ice">
        <MailCheck className="size-5" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-[2.5rem] md:leading-[1.05]">Sjekk e-posten din</h1>
      <p className="mt-2 leading-7 text-mist">
        Vi har sendt en sekssifret kode til{" "}
        {email ? <span className="font-medium text-fg">{email}</span> : "e-postadressen på kontoen din"}. Skriv den inn for å
        bekrefte at adressen er din.
      </p>

      <div ref={boxRef} className="mt-7 w-full">
        <CodeSlots
          autoFocus
          status={status}
          disabled={checking}
          slotSize={slot}
          gap={gap}
          radius={Math.round(slot * 0.27)}
          onChange={() => {
            if (status === "error") setStatus("idle");
          }}
          onComplete={submit}
          ariaLabel="Sekssifret kode fra e-posten"
        />
      </div>

      <div className="mt-4 min-h-6 text-sm" aria-live="polite">
        {checking && <p className="text-mist">Sjekker koden …</p>}
        {status === "success" && <p className="font-medium text-success">E-posten er bekreftet! Logger deg inn …</p>}
        {message && !checking && <p className={message.ok ? "text-success" : "text-danger"}>{message.text}</p>}
      </div>

      {devHint && (
        <p className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-[13px] leading-5 text-mist">
          Utviklingsmodus: e-post er ikke satt opp, så koden står i terminalen der <code className="font-mono">npm run dev</code> kjører.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || status === "success"}
          className="font-medium text-ice underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-mist/60 disabled:no-underline"
        >
          {cooldown > 0 ? `Send ny kode om ${cooldown} s` : "Send ny kode"}
        </button>
        {onBack && (
          <button type="button" onClick={onBack} className="text-mist transition hover:text-fg">
            Bruk en annen e-post
          </button>
        )}
      </div>
      <p className="mt-4 text-[13px] leading-5 text-mist/75">Finner du den ikke? Se i søppelpost eller «Kampanjer». Koden virker i 10 minutter.</p>
    </div>
  );
}
