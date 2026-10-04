"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { addProjectUpdateAction, deleteProjectUpdateAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/components/LocaleProvider";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";

type Update = { id: string; body: string; createdAt: string };

const MAX = 2000;

// Oppdateringer på prosjektet («Versjon 2 er ute»), nyeste først. Eieren skriver nye her.
export default function ProjectUpdates({ projectId, updates, isOwner }: { projectId: string; updates: Update[]; isOwner: boolean }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(false);
  const [pending, start] = useTransition();

  if (!isOwner && updates.length === 0) return null;

  const post = () =>
    start(async () => {
      const result = await addProjectUpdateAction(projectId, body);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      setWriting(false);
      toast.success(t("Oppdateringen er publisert"));
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      if (!window.confirm(t("Slette oppdateringen?"))) return;
      const result = await deleteProjectUpdateAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });

  return (
    <section aria-labelledby="oppdateringer">
      <div className="flex items-center justify-between gap-4">
        <h2 id="oppdateringer" className="caption">
          {t("Oppdateringer")}
        </h2>
        {isOwner && !writing && (
          <Button size="xs" variant="secondary" onClick={() => setWriting(true)}>
            {t("Skriv en oppdatering")}
          </Button>
        )}
      </div>

      {isOwner && writing && (
        <div className="mt-4">
          <label htmlFor="ny-oppdatering" className="sr-only">
            {t("Hva er nytt?")}
          </label>
          <textarea
            id="ny-oppdatering"
            className={`${textareaClass} min-h-24`}
            value={body}
            maxLength={MAX}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("Hva er nytt? F.eks. «Lagt til mørk modus og eksport til PDF.»")}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setWriting(false)}>
              {t("Avbryt")}
            </Button>
            <Button size="sm" onClick={post} loading={pending} disabled={body.trim().length < 3}>
              {t("Publiser")}
            </Button>
          </div>
        </div>
      )}

      {updates.length > 0 ? (
        <ol className="mt-5 space-y-5 border-l border-line pl-5">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-sea ring-4 ring-ink" aria-hidden="true" />
              <p className="flex items-center gap-3 text-xs text-mist">
                <time dateTime={u.createdAt}>{formatDate(u.createdAt, locale)}</time>
                {isOwner && (
                  <button type="button" onClick={() => remove(u.id)} className="inline-flex items-center gap-1 hover:text-danger" aria-label={t("Slett oppdateringen")}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[15px] leading-7 text-fg/90">{u.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        isOwner && !writing && <p className="mt-3 text-sm text-mist">{t("Fortell hva som er nytt når du jobber videre med prosjektet. Det viser at det lever.")}</p>
      )}
    </section>
  );
}
