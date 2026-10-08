"use client";

import { useState } from "react";
import { Check, ListPlus, Trash2, UserMinus } from "lucide-react";
import { createTalentListAction, deleteTalentListAction, setTalentListMemberAction } from "@/app/actions/talent";
import { useRun } from "@/components/company/useRun";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";

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

export function TalentListTools({ listId, userId }: { listId: string; userId?: string }) {
  const { pending, run, t } = useRun();
  if (userId) {
    return (
      <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => run(() => setTalentListMemberAction(listId, userId, false))} aria-label={t("Fjern fra listen")}>
        <UserMinus className="size-3.5" />
      </Button>
    );
  }
  return (
    <Button size="xs" variant="ghost" className="hover:text-danger" loading={pending} onClick={() => window.confirm(t("Slette listen?")) && run(() => deleteTalentListAction(listId), t("Listen er slettet"))}>
      <Trash2 className="size-3.5" /> {t("Slett listen")}
    </Button>
  );
}
