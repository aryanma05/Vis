"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, CircleAlert, Trash2 } from "lucide-react";
import { resendEmailCodeAction } from "@/app/actions/auth";
import { setNotificationPrefsAction } from "@/app/actions/notifications";
import VerifyEmailCode from "@/components/auth/VerifyEmailCode";
import PasswordInput from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/field";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

export function EmailStatus({ email, verified, canSend, devHint }: { email: string; verified: boolean; canSend: boolean; devHint: boolean }) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    const result = await resendEmailCodeAction(email);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setVerifying(true);
  }

  return (
    <div>
      <p className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{email}</span>
        {verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
            <BadgeCheck className="size-3.5" /> Bekreftet
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-medium text-warn">
            <CircleAlert className="size-3.5" /> Ikke bekreftet
          </span>
        )}
      </p>
      {!verified && canSend && !verifying && (
        <Button size="sm" variant="secondary" className="mt-4" onClick={start} loading={pending}>
          Send kode for å bekrefte
        </Button>
      )}
      {verifying && (
        <div className="mt-6 max-w-sm rounded-3xl border border-line p-5">
          <VerifyEmailCode
            identifier={email}
            email={email}
            devHint={devHint}
            initialCooldown={45}
            onVerified={() => {
              setVerifying(false);
              toast.success("E-posten er bekreftet");
              router.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next.length < 8) return setError("Det nye passordet må ha minst 8 tegn.");
    setPending(true);
    setError(null);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setCurrent("");
    setNext("");
    toast.success("Passordet er byttet", { description: "Du er logget ut på alle andre enheter." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <div>
        <label htmlFor="current-password" className={labelClass}>
          Nåværende passord
        </label>
        <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label htmlFor="new-password" className={labelClass}>
          Nytt passord
        </label>
        <PasswordInput id="new-password" autoComplete="new-password" placeholder="Minst 8 tegn" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={!current || !next}>
          Bytt passord
        </Button>
      </div>
    </form>
  );
}

type Prefs = { comment: boolean; reply: boolean; mention: boolean; follow: boolean };

export function NotificationSettings({ initial, emailEnabled }: { initial: Prefs; emailEnabled: boolean }) {
  const [prefs, setPrefs] = useState(initial);

  async function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const result = await setNotificationPrefsAction(next);
    if (!result.ok) {
      setPrefs(prefs);
      toast.error(result.error);
      return;
    }
    toast.success("Lagret");
  }

  const rows: { key: keyof Prefs; label: string; description: string }[] = [
    { key: "comment", label: "Kommentarer på prosjektene mine", description: "Når noen skriver en kommentar på et av prosjektene dine." },
    { key: "reply", label: "Svar på kommentarene mine", description: "Når noen svarer deg i en tråd." },
    { key: "mention", label: "Når noen nevner meg", description: "Når noen skriver @brukernavnet ditt i en kommentar." },
    { key: "follow", label: "Nye følgere", description: "Når noen begynner å følge deg." },
  ];

  return (
    <div className="max-w-lg space-y-5">
      {!emailEnabled && (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-mist">
          E-post er ikke satt opp på serveren ennå, så du får bare varsler her inne.
        </p>
      )}
      {rows.map((r) => (
        <Switch key={r.key} checked={prefs[r.key]} onChange={(v) => update(r.key, v)} label={r.label} description={r.description} />
      ))}
      <p className="text-xs text-mist/70">Varslene under klokka i menyen kommer alltid, uansett hva du velger her.</p>
    </div>
  );
}

const CONFIRM_WORD = "slett";

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm.trim().toLowerCase() !== CONFIRM_WORD) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser(hasPassword ? { password } : {});
    if (error) {
      setPending(false);
      return setError(authErrorMessage(error));
    }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Slett kontoen min …
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4 rounded-3xl border border-danger/30 bg-danger/[0.06] p-5">
      <p className="text-sm text-fg">
        Dette kan ikke angres. Alt du har lagt ut på Vis forsvinner, også bildene. Vil du ha en kopi, last ned dataene dine
        først.
      </p>
      <div>
        <label htmlFor="confirm-delete" className={labelClass}>
          Skriv «{CONFIRM_WORD}» for å bekrefte
        </label>
        <input id="confirm-delete" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      </div>
      {hasPassword && (
        <div>
          <label htmlFor="delete-password" className={labelClass}>
            Passordet ditt
          </label>
          <PasswordInput id="delete-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="danger" loading={pending} disabled={confirm.trim().toLowerCase() !== CONFIRM_WORD || (hasPassword && !password)}>
          Slett kontoen for godt
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}
