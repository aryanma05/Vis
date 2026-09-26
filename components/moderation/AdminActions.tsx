"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, Check, RotateCcw, Trash2, X } from "lucide-react";
import {
  adminDeleteCommentAction,
  banUserAction,
  removeProjectAction,
  resolveReportAction,
  restoreProjectAction,
  unbanUserAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass, selectClass, textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

type Result = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt.");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export function RemoveProjectButton({ projectId, removed }: { projectId: string; removed: boolean }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Brudd på retningslinjene.");
  if (removed) {
    return (
      <Button size="xs" variant="secondary" loading={pending} onClick={() => run(() => restoreProjectAction(projectId), "Prosjektet er gjenopprettet")}>
        <RotateCcw className="size-3.5" /> Gjenopprett
      </Button>
    );
  }
  return (
    <>
      <Button size="xs" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" /> Fjern prosjektet
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Fjern prosjektet" description="Prosjektet skjules for alle unntatt eieren, som ser begrunnelsen." size="sm">
        <label className="block text-sm font-medium">
          Begrunnelse
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${textareaClass} mt-2`} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button variant="danger" loading={pending} onClick={() => run(() => removeProjectAction(projectId, reason), "Prosjektet er fjernet", () => setOpen(false))}>
            Fjern
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      size="xs"
      variant="danger"
      loading={pending}
      onClick={() => {
        if (confirm("Slette kommentaren for godt?")) run(() => adminDeleteCommentAction(commentId), "Kommentaren er slettet");
      }}
    >
      <Trash2 className="size-3.5" /> Slett kommentaren
    </Button>
  );
}

export function BanButton({ userId, banned, name }: { userId: string; banned: boolean; name: string }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Brudd på retningslinjene.");
  const [days, setDays] = useState("7");
  if (banned) {
    return (
      <Button size="xs" variant="secondary" loading={pending} onClick={() => run(() => unbanUserAction(userId), `${name} kan logge inn igjen`)}>
        <RotateCcw className="size-3.5" /> Åpne kontoen
      </Button>
    );
  }
  return (
    <>
      <Button size="xs" variant="danger" onClick={() => setOpen(true)}>
        <Ban className="size-3.5" /> Steng kontoen
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Steng kontoen til ${name}`} description="Personen logges ut overalt, og profilen, prosjektene og kommentarene skjules." size="sm">
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Hvor lenge
            <select value={days} onChange={(e) => setDays(e.target.value)} className={`${selectClass} mt-2`}>
              <option value="1">1 dag</option>
              <option value="7">7 dager</option>
              <option value="30">30 dager</option>
              <option value="0">Til den åpnes igjen</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Begrunnelse
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${inputClass} mt-2`} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => run(() => banUserAction(userId, reason, Number(days) || null), `Kontoen til ${name} er stengt`, () => setOpen(false))}
          >
            Steng
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function ResolveButtons({ reportId }: { reportId: string }) {
  const { pending, run } = useRun();
  return (
    <div className="flex gap-2">
      <Button size="xs" variant="secondary" disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "resolved", "Håndtert"), "Markert som løst")}>
        <Check className="size-3.5" /> Løst
      </Button>
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => resolveReportAction(reportId, "dismissed", "Ikke brudd"), "Rapporten er avvist")}>
        <X className="size-3.5" /> Avvis
      </Button>
    </div>
  );
}
