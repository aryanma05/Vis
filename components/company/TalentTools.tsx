"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { Bell, BellOff, Bookmark, Columns3, X } from "lucide-react";
import { createSavedSearchAction, deleteSavedSearchAction, setSavedSearchNotifyAction } from "@/app/actions/talent";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { SavedSearchFilters } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Lagrede søk                                                               */
/* -------------------------------------------------------------------------- */

export function SaveSearchButton({ companyId, filters, suggestion }: { companyId: string; filters: SavedSearchFilters; suggestion: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestion);
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Bookmark className="size-4" /> {t("Lagre søket")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title={t("Lagre søket")} description={t("Dere ser hvor mange nye som passer, og får e-post når nye kandidater dukker opp.")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const result = await createSavedSearchAction(companyId, name, filters);
              if (!result.ok) return void toast.error(result.error);
              toast.success(t("Søket er lagret"), { description: t("Dere får e-post når nye kandidater passer.") });
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label={t("Navn på søket")} autoFocus />
          <div className="mt-4 flex justify-end">
            <Button type="submit" loading={pending}>
              {t("Lagre")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function SavedSearchChip({ id, name, href, fresh, notify, active }: { id: string; name: string; href: string; fresh: number; notify: boolean; active: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error ?? t("Noe gikk galt."));
      if (done) toast.success(done);
      router.refresh();
    });
  return (
    <li className={`inline-flex items-center gap-1 rounded-full py-1 pl-3.5 pr-1 text-sm ${active ? "bg-primary text-on-primary" : "glass-chip"}`}>
      <Link href={href} className="font-medium">
        {name}
      </Link>
      {fresh > 0 && <span className={`rounded-full px-1.5 text-xs font-semibold ${active ? "bg-on-primary/20" : "bg-success/15 text-success"}`}>{t("{n} nye", { n: fresh })}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setSavedSearchNotifyAction(id, !notify), notify ? t("Varsler er av for søket") : t("Dere får e-post om nye kandidater"))}
        aria-label={notify ? t("Slå av e-postvarsel") : t("Slå på e-postvarsel")}
        title={notify ? t("E-postvarsel er på") : t("E-postvarsel er av")}
        className="flex size-7 items-center justify-center rounded-full opacity-70 hover:opacity-100"
      >
        {notify ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirm(true)}
        aria-label={t("Slett {name}", { name })}
        className="flex size-7 items-center justify-center rounded-full opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
      <Dialog open={confirm} onClose={() => setConfirm(false)} size="sm" title={t("Slette «{name}»?", { name })} description={t("Dere får ikke lenger e-post om nye kandidater som passer søket.")}>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
            {t("Avbryt")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={pending}
            onClick={() => {
              setConfirm(false);
              run(() => deleteSavedSearchAction(id), t("Søket er slettet"));
            }}
          >
            {t("Slett")}
          </Button>
        </div>
      </Dialog>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sammenligning fra kandidatsøket                                           */
/* -------------------------------------------------------------------------- */

const CompareContext = createContext<{ picked: string[]; toggle: (id: string) => void } | null>(null);
const MAX = 4;

export function CompareProvider({ base, children }: { base: string; children: ReactNode }) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length >= MAX ? l : [...l, id]));
  return (
    <CompareContext.Provider value={{ picked, toggle }}>
      {children}
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 md:bottom-8">
          <div className="glass-strong flex items-center gap-3 rounded-full py-2 pl-5 pr-2 shadow-xl">
            <span className="text-sm">{t("{n} valgt", { n: picked.length })}</span>
            <button type="button" onClick={() => setPicked([])} className="text-sm text-mist hover:text-fg">
              {t("Nullstill")}
            </button>
            <ButtonLink href={`${base}/sammenlign?folk=${picked.join(",")}`} size="sm">
              <Columns3 className="size-4" /> {t("Sammenlign")}
            </ButtonLink>
          </div>
        </div>
      )}
    </CompareContext.Provider>
  );
}

export function CompareToggle({ userId }: { userId: string }) {
  const t = useT();
  const ctx = useContext(CompareContext);
  if (!ctx) return null;
  const on = ctx.picked.includes(userId);
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mist">
      <input type="checkbox" checked={on} onChange={() => ctx.toggle(userId)} disabled={!on && ctx.picked.length >= MAX} className="accent-[var(--sea)]" /> {t("Sammenlign")}
    </label>
  );
}
