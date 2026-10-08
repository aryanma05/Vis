"use client";

import { useState } from "react";
import { AlertTriangle, Check, Download, ListPlus, PencilLine, StickyNote, Trash2, UserMinus } from "lucide-react";
import { createTalentListAction, deleteTalentListAction, setTalentListMemberAction, setTalentListNoteAction } from "@/app/actions/talent";
import { useRun } from "@/components/company/useRun";
import { Button, buttonClass } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass, textareaClass } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { findSensitiveTerms } from "@/lib/fair-hiring";

export function AddToList({ userId, lists, memberOf }: { userId: string; lists: { id: string; name: string }[]; memberOf: string[] }) {
  const { run, t } = useRun();
  if (lists.length === 0) return null;
  return (
    <Menu
      label={t("Legg i liste")}
      align="end"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={open} className={buttonClass({ variant: "secondary", size: "xs" })}>
          <ListPlus className="size-3.5" /> {t("Liste")}
          {memberOf.length > 0 && <span className="rounded-full bg-sea/15 px-1.5 text-[11px] font-semibold tabular-nums text-sea">{memberOf.length}</span>}
        </button>
      )}
    >
      <MenuLabel>{t("Legg i liste")}</MenuLabel>
      {lists.map((l) => {
        const on = memberOf.includes(l.id);
        return (
          <MenuItem key={l.id} onSelect={() => run(() => setTalentListMemberAction(l.id, userId, !on), on ? t("Fjernet fra listen") : t("Lagt i «{name}»", { name: l.name }))} hint={on ? <Check className="size-4 text-sea" /> : undefined}>
            {l.name}
          </MenuItem>
        );
      })}
    </Menu>
  );
}

export function NewTalentList({ companyId }: { companyId: string }) {
  const [name, setName] = useState("");
  const { pending, run, t } = useRun();
  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        run(() => createTalentListAction(companyId, name), t("Listen er laget"));
        setName("");
      }}
    >
      <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Ny liste, f.eks. «Sommerjobb 2027»")} maxLength={80} aria-label={t("Navn på listen")} />
      <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
        {t("Lag")}
      </Button>
    </form>
  );
}

// Fjern en kandidat fra listen, eller slett hele listen (med bekreftelse).
export function TalentListTools({ listId, userId, name }: { listId: string; userId?: string; name?: string }) {
  const { pending, run, t } = useRun();
  const [open, setOpen] = useState(false);
  if (userId) {
    return (
      <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => run(() => setTalentListMemberAction(listId, userId, false), t("Fjernet fra listen"))} aria-label={t("Fjern fra listen")}>
        <UserMinus className="size-3.5" />
      </Button>
    );
  }
  return (
    <>
      <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> {t("Slett listen")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title={t("Slette listen?")} description={name ? t("«{name}» og notatene i den slettes for godt. Kandidatene får ikke beskjed.", { name }) : undefined}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            onClick={() => {
              setOpen(false);
              run(() => deleteTalentListAction(listId), t("Listen er slettet"));
            }}
          >
            {t("Slett listen")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

// Notat om en kandidat i listen. Kandidaten kan be om innsyn, så det minnes om det, og om ord
// som tyder på noe loven ikke tillater å vurdere (bare en advarsel).
export function ListNote({ listId, userId, note, editable }: { listId: string; userId: string; note: string | null; editable: boolean }) {
  const { pending, run, t } = useRun();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const sensitive = findSensitiveTerms(text);

  if (!editing) {
    if (!note && !editable) return null;
    return (
      <div className="mt-1.5 flex items-start gap-1.5 text-[13px]">
        <StickyNote className={`mt-0.5 size-3.5 shrink-0 ${note ? "text-warn" : "text-mist"}`} />
        {note && <p className="min-w-0 whitespace-pre-line text-fg/85">{note}</p>}
        {editable && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-1 text-mist hover:text-fg">
            {note ? <PencilLine className="size-3.5" aria-label={t("Rediger notatet")} /> : t("Legg til notat")}
          </button>
        )}
      </div>
    );
  }
  return (
    <form
      className="mt-2 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        setEditing(false);
        run(() => setTalentListNoteAction(listId, userId, text), text.trim() ? t("Notatet er lagret") : t("Notatet er fjernet"));
      }}
    >
      <textarea
        className={`${textareaClass} min-h-20 text-sm`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        autoFocus
        aria-label={t("Notat")}
        placeholder={t("F.eks. «Sterk på React, passer sommerjobben»")}
      />
      {sensitive.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warn">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {t("Notatet nevner {terms}. Vurder bare det som er relevant for jobben (likestillings- og diskrimineringsloven).", { terms: sensitive.join(", ") })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mist">{t("Kandidaten kan be om innsyn. Skriv som om de leser det.")}</p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setText(note ?? "");
              setEditing(false);
            }}
          >
            {t("Avbryt")}
          </Button>
          <Button type="submit" size="xs" loading={pending}>
            {t("Lagre")}
          </Button>
        </div>
      </div>
    </form>
  );
}

// «Last ned»: spør om notatene skal med, og minner om at fila må slettes etter bruk.
// Lastes ned med fetch, så en grense eller manglende tilgang vises som en melding.
export function ExportList({ listId, name, count }: { listId: string; name: string; count: number }) {
  const { t } = useRun();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/bedrift/liste/${listId}/csv${notes ? "?notater=1" : ""}`);
      if (!res.ok) return void toast.error((await res.text()) || t("Noe gikk galt."));
      const url = URL.createObjectURL(await res.blob());
      const file = `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "kandidater"}.csv`;
      Object.assign(document.createElement("a"), { href: url, download: file }).click();
      URL.revokeObjectURL(url);
      setOpen(false);
      toast.success("Lista er lastet ned", { description: "Slett fila når dere er ferdige." });
    } catch {
      toast.error(t("Noe gikk galt."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={count === 0}>
        <Download className="size-4" /> {t("Last ned (Excel/CSV)")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title={t("Last ned «{name}»", { name })} description={t("{n} kandidater, uten e-postadresser.", { n: count })}>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[14px] bg-fill p-3.5 text-sm">
          <input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} className="mt-0.5 size-4 accent-[var(--sea)]" />
          <span>
            <span className="block font-medium">{t("Ta med notatene")}</span>
            <span className="mt-0.5 block text-[13px] text-mist">{t("Bare hvis dere trenger dem utenfor Vis.")}</span>
          </span>
        </label>
        <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-warn/10 p-3.5 text-[13px] leading-5 text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t("Fila inneholder personopplysninger. Del den bare med dem som ansetter, og slett den når dere er ferdige (vilkår § 6). Nedlastingen logges.")}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button size="sm" loading={busy} onClick={download}>
            <Download className="size-4" /> {t("Last ned")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
