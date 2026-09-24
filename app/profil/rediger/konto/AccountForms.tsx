"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { ui } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={`mt-3 text-sm ${message.ok ? "text-emerald-300" : "text-red-400"}`}>
      {message.text}
    </p>
  );
}

export function EmailStatus({ email, verified, canSend }: { email: string; verified: boolean; canSend: boolean }) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/epost-bekreftet" });
    setPending(false);
    setMessage(error ? { ok: false, text: authErrorMessage(error) } : { ok: true, text: `Lenke sendt til ${email}.` });
  }

  return (
    <div>
      <p className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{email}</span>
        {verified ? (
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">Bekreftet</span>
        ) : (
          <span className="rounded-full bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">Ikke bekreftet</span>
        )}
      </p>
      {!verified && canSend && (
        <button type="button" onClick={send} disabled={pending} className="mt-3 text-sm font-medium text-ice hover:underline disabled:opacity-60">
          {pending ? "Sender…" : "Send bekreftelseslenke"}
        </button>
      )}
      <Feedback message={message} />
    </div>
  );
}

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next.length < 8) return setMessage({ ok: false, text: "Det nye passordet må ha minst 8 tegn." });
    setPending(true);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setPending(false);
    if (error) return setMessage({ ok: false, text: authErrorMessage(error) });
    setCurrent("");
    setNext("");
    setMessage({ ok: true, text: "Passordet er byttet." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-md gap-4">
      <div>
        <label htmlFor="current-password" className={ui.label}>
          Nåværende passord
        </label>
        <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label htmlFor="new-password" className={ui.label}>
          Nytt passord
        </label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="Minst 8 tegn"
          maxLength={128}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div>
        <button type="submit" disabled={pending || !current || !next} className={ui.secondary}>
          {pending ? "Lagrer…" : "Bytt passord"}
        </button>
        <Feedback message={message} />
      </div>
    </form>
  );
}

const CONFIRM_WORD = "slett";

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm.trim().toLowerCase() !== CONFIRM_WORD) return;
    setPending(true);
    setMessage(null);
    const { error } = await authClient.deleteUser(hasPassword ? { password } : {});
    if (error) {
      setPending(false);
      return setMessage({ ok: false, text: authErrorMessage(error) });
    }
    router.push("/");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={ui.danger}>
        Slett kontoen min…
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-sm text-fg">
        Dette kan ikke angres. Alt du har lagt ut på Vis forsvinner, også bildene. Vil du ha en kopi, last ned dataene
        dine først.
      </p>
      <div>
        <label htmlFor="confirm-delete" className={ui.label}>
          Skriv «{CONFIRM_WORD}» for å bekrefte
        </label>
        <input
          id="confirm-delete"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={ui.input}
        />
      </div>
      {hasPassword && (
        <div>
          <label htmlFor="delete-password" className={ui.label}>
            Passordet ditt
          </label>
          <PasswordInput id="delete-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || confirm.trim().toLowerCase() !== CONFIRM_WORD || (hasPassword && !password)}
          className="rounded-lg bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Sletter…" : "Slett kontoen for godt"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ui.secondary}>
          Avbryt
        </button>
      </div>
      <Feedback message={message} />
    </form>
  );
}
