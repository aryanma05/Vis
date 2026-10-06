"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Download, ShieldCheck } from "lucide-react";
import { renderSVG } from "uqr";
import CodeSlots, { type CodeStatus } from "@/components/auth/CodeSlots";
import { useT } from "@/components/LocaleProvider";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { labelClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Step = "password" | "scan" | "codes";
type Purpose = "enable" | "disable" | "codes";

function BackupCodes({ codes }: { codes: string[] }) {
  const t = useT();
  const text = codes.join("\n");
  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-ink-2 p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Kopiert"))}>
          <Copy className="size-4" /> {t("Kopier")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([`${t("Reservekoder for Vis")}\n\n${text}\n`], { type: "text/plain" }));
            a.download = t("vis-reservekoder.txt");
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          <Download className="size-4" /> {t("Last ned")}
        </Button>
      </div>
      <p className="mt-3 text-xs text-mist">{t("Hver kode kan brukes én gang hvis du mister telefonen. Ta vare på dem et trygt sted.")}</p>
    </div>
  );
}

// To-trinns innlogging: slå på med en app for engangskoder, få reservekoder, eller slå av.
export default function TwoFactorSettings({ enabled, hasPassword }: { enabled: boolean; hasPassword: boolean }) {
  const router = useRouter();
  const t = useT();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<CodeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setPurpose(null);
    setStep("password");
    setPassword("");
    setError(null);
    setStatus("idle");
    router.refresh();
  };

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    if (purpose === "enable") {
      const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
      setPending(false);
      if (error) return setError(authErrorMessage(error));
      if (data.method !== "totp") return setError(t("Noe gikk galt. Prøv igjen."));
      setUri(data.totpURI);
      setCodes(data.backupCodes);
      setStep("scan");
    } else if (purpose === "disable") {
      const { error } = await authClient.twoFactor.disable({ password });
      setPending(false);
      if (error) return setError(authErrorMessage(error));
      toast.success("To-trinns innlogging er slått av");
      close();
    } else {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
      setPending(false);
      if (error) return setError(authErrorMessage(error));
      setCodes(data.backupCodes);
      setStep("codes");
    }
  }

  async function verify(code: string) {
    setPending(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error) {
      setStatus("error");
      setError(authErrorMessage(error));
      return;
    }
    setStatus("success");
    setError(null);
    setStep("codes");
  }

  const secret = uri ? new URL(uri).searchParams.get("secret") : null;

  if (!hasPassword) {
    return (
      <p className="max-w-lg text-sm text-mist">
        {t("Du logger inn med GitHub eller Google, som har sin egen to-trinns innlogging. Slå det på der. Vil du ha passord på Vis også, bruk «Glemt passordet?» på innloggingssiden.")}
      </p>
    );
  }

  return (
    <div className="max-w-lg">
      {enabled ? (
        <div className="rounded-[18px] glass-card p-4">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-5 text-success" /> {t("To-trinns innlogging er på")}
          </p>
          <p className="mt-1 text-sm text-mist">{t("Du trenger koden fra appen når du logger inn på en ny enhet.")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPurpose("codes")}>
              {t("Lag nye reservekoder")}
            </Button>
            <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setPurpose("disable")}>
              {t("Slå av")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-mist">
            {t("Med to-trinns innlogging trenger man både passordet og en kode fra telefonen din. Da er kontoen trygg selv om passordet lekker.")}
          </p>
          <Button size="sm" className="mt-4" onClick={() => setPurpose("enable")}>
            {t("Slå på to-trinns innlogging")}
          </Button>
        </div>
      )}

      <Dialog
        open={purpose !== null}
        onClose={close}
        title={t(purpose === "enable" ? "Slå på to-trinns innlogging" : purpose === "disable" ? "Slå av to-trinns innlogging" : "Nye reservekoder")}
        description={step === "password" ? t("Bekreft med passordet ditt.") : undefined}
      >
        {step === "password" && (
          <form onSubmit={submitPassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="tofa-passord" className={labelClass}>
                {t("Passord")}
              </label>
              <PasswordInput id="tofa-passord" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
            </div>
            {error && <p className="text-sm text-danger">{t(error)}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                {t("Avbryt")}
              </Button>
              <Button type="submit" size="sm" loading={pending} disabled={!password}>
                {t("Fortsett")}
              </Button>
            </div>
          </form>
        )}

        {step === "scan" && (
          <div className="mt-5">
            <p className="text-sm text-mist">{t("1. Skann koden med en app for engangskoder (Google Authenticator, Microsoft Authenticator, 1Password …).")}</p>
            <div className="mx-auto mt-4 w-48 rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: renderSVG(uri, { border: 2, ecc: "M" }) }} />
            {secret && (
              <p className="mt-3 break-all text-center font-mono text-xs text-mist">
                {t("Eller skriv inn:")} <span className="select-all text-fg">{secret}</span>
              </p>
            )}
            <p className="mt-6 text-sm text-mist">{t("2. Skriv inn koden appen viser.")}</p>
            <div className="mt-3">
              <CodeSlots autoFocus status={status} disabled={pending} slotSize={44} gap={8} radius={12} onComplete={verify} onChange={() => status === "error" && setStatus("idle")} ariaLabel={t("Kode fra appen")} />
            </div>
            {error && <p className="mt-3 text-sm text-danger">{t(error)}</p>}
          </div>
        )}

        {step === "codes" && (
          <div className="mt-5">
            {purpose === "enable" && (
              <p className="mb-4 flex items-center gap-2 text-sm font-medium text-success">
                <Check className="size-4" /> {t("To-trinns innlogging er på")}
              </p>
            )}
            <BackupCodes codes={codes} />
            <div className="mt-5 flex justify-end">
              <Button size="sm" onClick={close}>
                {t("Ferdig")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
