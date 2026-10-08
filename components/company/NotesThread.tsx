"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AtSign, Trash2 } from "lucide-react";
import { addNoteAction, deleteNoteAction } from "@/app/actions/notes";
import Avatar from "@/components/Avatar";
import { useLocale } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useRun } from "@/components/company/useRun";
import { timeAgo } from "@/lib/format";

type Note = { id: string; body: string; createdAt: Date | string; name: string | null; username: string | null; image: string | null; canDelete: boolean };

// Notattråden på søkersiden. Skriv @brukernavn for å varsle en kollega.
export default function NotesThread({ applicationId, notes, members, canWrite }: { applicationId: string; notes: Note[]; members: { username: string; name: string }[]; canWrite: boolean }) {
  const { pending, run, t } = useRun();
  const locale = useLocale();
  const reduce = useReduceMotion();
  const [body, setBody] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  // Forslag når siste ord begynner med @.
  const partial = /@([a-z0-9_-]*)$/i.exec(body)?.[1]?.toLowerCase();
  const suggestions = partial !== undefined ? members.filter((m) => m.username.startsWith(partial) || m.name.toLowerCase().includes(partial)).slice(0, 5) : [];

  const submit = () =>
    run(async () => {
      const result = await addNoteAction(applicationId, body);
      if (result.ok) {
        setBody("");
        setWarnings(result.data.warnings);
        if (result.data.warnings.length === 0) toast.success(t("Notatet er lagret"));
      }
      return result;
    });

  return (
    <div>
      {notes.length === 0 ? (
        <p className="text-sm text-mist">{t("Ingen notater ennå. Skriv hva dere tenker, og nevn en kollega med @.")}</p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.li key={n.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} className="flex gap-3">
                <Avatar name={n.name ?? "?"} image={n.image} size={28} />
                <div className="min-w-0 flex-1 rounded-[14px] bg-fill px-3 py-2">
                  <p className="flex items-center gap-2 text-xs text-mist">
                    <span className="font-semibold text-fg">{n.name ?? t("Tidligere medlem")}</span>
                    <span suppressHydrationWarning>{timeAgo(n.createdAt, locale)}</span>
                    {n.canDelete && (
                      <button type="button" disabled={pending} onClick={() => run(() => deleteNoteAction(n.id))} aria-label={t("Slett notatet")} className="ml-auto rounded-full p-1 hover:bg-fill-2 hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm">{n.body}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {canWrite && (
        <form
          className="relative mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) submit();
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t("Skriv et notat …")}
            aria-label={t("Nytt notat")}
            className="w-full resize-y rounded-[14px] bg-fill px-3 py-2 text-sm outline-none inset-ring inset-ring-line focus:ring-2 focus:ring-sea/50"
          />
          {suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[14px] glass-strong shadow-lg">
              {suggestions.map((m) => (
                <li key={m.username}>
                  <button type="button" onClick={() => setBody((b) => b.replace(/@[a-z0-9_-]*$/i, `@${m.username} `))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fill">
                    <AtSign className="size-3.5 text-mist" /> {m.name} <span className="text-mist">@{m.username}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {warnings.length > 0 && (
            <p className="mt-2 rounded-[12px] bg-warn/10 px-3 py-2 text-xs text-warn">
              {t("Notatet ble lagret, men nevner {terms}. Slikt skal ikke vektlegges i en ansettelse (likestillings- og diskrimineringsloven).", { terms: warnings.join(", ") })}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-mist">{t("Kandidaten kan be om innsyn i notater.")}</p>
            <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
              {t("Lagre notat")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
