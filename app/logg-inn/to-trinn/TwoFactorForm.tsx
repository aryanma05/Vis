"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CodeSlots, { type CodeStatus } from "@/components/auth/CodeSlots";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { authError } from "@/lib/auth-errors";
import { safeInternalPath } from "@/lib/safe-path";

// Andre steg i innloggingen når to-trinns er slått på: kode fra appen, eller en reservekode.
export default function TwoFactorForm() {
  const router = useRouter();
  const t = useT();
  const next = useSearchParams().get("neste");
  const safeNext = safeInternalPath(next);
  const [mode, setMode] = useState<"app" | "backup">("app");
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [trust, setTrust] = useState(true);
  const [backup, setBackup] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState(52);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSlot(Math.max(34, Math.min(56, Math.floor((el.clientWidth - 50) / 6))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function finish(result: { data: unknown; error: unknown }) {
    setPending(false);
    if (result.error) {
      setStatus("error");
      setError(authError(result.error as { code?: string; message?: string }, "login").message || t("Feil kode. Prøv igjen."));
      return;
    }
    setStatus("success");
    const username = (result.data as { user?: { username?: string } } | null)?.user?.username;
    router.push(safeNext ?? (username ? `/@${username}` : "/"));
    router.refresh();
  }

  async function verifyApp(code: string) {
    setPending(true);
    setError(null);
    await finish(await authClient.twoFactor.verifyTotp({ code, trustDevice: trust }));
  }

  async function verifyBackup(event: React.FormEvent) {
    event.preventDefault();
    if (!backup.trim()) return;
    setPending(true);
    setError(null);
    await finish(await authClient.twoFactor.verifyBackupCode({ code: backup.trim(), trustDevice: trust }));
  }

  return (
    <div className="space-y-6">
      {mode === "app" ? (
        <div ref={boxRef}>
          <CodeSlots
            autoFocus
            status={status}
            disabled={pending}
            slotSize={slot}
            gap={10}
            radius={Math.round(slot * 0.27)}
            onChange={() => status === "error" && setStatus("idle")}
            onComplete={verifyApp}
            ariaLabel={t("Sekssifret kode fra appen")}
          />
        </div>
      ) : (
        <form onSubmit={verifyBackup} className="space-y-4">
          <div>
            <label htmlFor="reservekode" className={labelClass}>
              {t("Reservekode")}
            </label>
            <input
              id="reservekode"
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              className={`${inputClass} font-mono`}
              placeholder="xxxxx-xxxxx"
            />
          </div>
          <Button type="submit" loading={pending} className="w-full">
            {t("Logg inn")}
          </Button>
        </form>
      )}

      <label className="flex items-center gap-2 text-sm text-mist">
        <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4 accent-[var(--sea)]" />
        {t("Husk denne enheten i 30 dager")}
      </label>

      {error && <p className="text-sm text-danger">{t(error)}</p>}

      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" className="text-mist hover:text-fg" onClick={() => setMode(mode === "app" ? "backup" : "app")}>
          {mode === "app" ? t("Har du ikke telefonen? Bruk en reservekode") : t("Bruk koden fra appen")}
        </button>
        <Link href="/logg-inn" className="text-mist hover:text-fg">
          {t("Avbryt")}
        </Link>
      </div>
    </div>
  );
}
