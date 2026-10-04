"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ListPlus, Mail, Trash2, UserMinus } from "lucide-react";
import {
  addCompanyMemberAction,
  contactCandidateAction,
  createTalentListAction,
  deleteJobAction,
  deleteTalentListAction,
  removeCompanyMemberAction,
  setJobStatusAction,
  setTalentListMemberAction,
} from "@/app/actions/companies";
import { Button, buttonClass } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass, textareaClass } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { CONTACT_REASON_LABELS, CONTACT_REASONS, type ContactReason } from "@/lib/constants";

type Result = { ok: true } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result | { ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error((result as { error: string }).error);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

export function JobActions({ jobId, status }: { jobId: string; status: "draft" | "published" | "closed" }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button size="xs" onClick={() => run(() => setJobStatusAction(jobId, "published"), "Stillingen er publisert")} loading={pending}>
          Publiser
        </Button>
      )}
      {status === "published" && (
        <Button size="xs" variant="secondary" onClick={() => run(() => setJobStatusAction(jobId, "closed"), "Stillingen er lukket")} loading={pending}>
          Lukk
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        className="hover:text-danger"
        onClick={() => window.confirm("Slette stillingen?") && run(() => deleteJobAction(jobId), "Slettet")}
        aria-label="Slett stillingen"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function AddToList({ userId, lists, memberOf }: { userId: string; lists: { id: string; name: string }[]; memberOf: string[] }) {
  const { run } = useRun();
  if (lists.length === 0) return null;
  return (
    <Menu
      label="Legg i liste"
      align="end"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className={buttonClass({ variant: "secondary", size: "xs" })}>
          <ListPlus className="size-3.5" /> Liste
        </button>
      )}
    >
      <MenuLabel>Legg i liste</MenuLabel>
      {lists.map((l) => {
        const on = memberOf.includes(l.id);
        return (
          <MenuItem key={l.id} onSelect={() => run(() => setTalentListMemberAction(l.id, userId, !on), on ? "Fjernet fra listen" : `Lagt i «${l.name}»`)} hint={on ? <Check className="size-4 text-sea" /> : undefined}>
            {l.name}
          </MenuItem>
        );
      })}
    </Menu>
  );
}

export function ContactCandidate({ companyId, userId, name }: { companyId: string; userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContactReason>("jobb");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];
  return (
    <>
      <Button size="xs" variant="secondary" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" /> Kontakt
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Kontakt ${first}`} description="Meldingen sendes som varsel og e-post. Svaret kommer til e-posten din.">
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {CONTACT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => setReason(r)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${reason === r ? "bg-primary text-on-primary" : "glass-chip"}`}
              >
                {CONTACT_REASON_LABELS[r]}
              </button>
            ))}
          </div>
          <textarea className={`${textareaClass} mt-4 min-h-32`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder={`Hei ${first}! …`} aria-label="Melding" />
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              loading={pending}
              disabled={message.trim().length < 20}
              onClick={() =>
                start(async () => {
                  const result = await contactCandidateAction(companyId, userId, { reason, message });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setOpen(false);
                  setMessage("");
                  toast.success(`Meldingen er sendt til ${first}`);
                })
              }
            >
              Send
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function NewTalentList({ companyId }: { companyId: string }) {
  const [name, setName] = useState("");
  const { pending, run } = useRun();
  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        run(() => createTalentListAction(companyId, name), "Listen er laget");
        setName("");
      }}
    >
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ny liste, f.eks. «Sommerjobb 2027»" maxLength={80} aria-label="Navn på listen" />
      <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
        Lag
      </Button>
    </form>
  );
}

export function TalentListTools({ listId, userId }: { listId: string; userId?: string }) {
  const { pending, run } = useRun();
  if (userId) {
    return (
      <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => run(() => setTalentListMemberAction(listId, userId, false))} aria-label="Fjern fra listen">
        <UserMinus className="size-3.5" />
      </Button>
    );
  }
  return (
    <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => window.confirm("Slette listen?") && run(() => deleteTalentListAction(listId), "Listen er slettet")}>
      <Trash2 className="size-3.5" /> Slett listen
    </Button>
  );
}

export function AddMember({ companyId }: { companyId: string }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const { pending, run } = useRun();
  return (
    <form
      className="flex max-w-xl flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!username.trim()) return;
        run(() => addCompanyMemberAction(companyId, username, role), "Lagt til");
        setUsername("");
      }}
    >
      <input className={`${inputClass} min-w-48 flex-1`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@brukernavn" aria-label="Brukernavn" autoCapitalize="none" />
      <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className={`${inputClass} w-auto`} aria-label="Rolle">
        <option value="member">Medlem</option>
        <option value="admin">Administrator</option>
      </select>
      <Button type="submit" size="sm" loading={pending} disabled={!username.trim()}>
        Legg til
      </Button>
    </form>
  );
}

export function RemoveMember({ companyId, userId }: { companyId: string; userId: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => run(() => removeCompanyMemberAction(companyId, userId), "Fjernet")} aria-label="Fjern">
      <UserMinus className="size-3.5" />
    </Button>
  );
}
