"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BarChart3, Eye, EyeOff, PenLine, Pin, PinOff, Trash2 } from "lucide-react";
import { deleteProjectAction, setProjectPinnedAction, setProjectStatusAction } from "@/app/actions/projects";
import Dialog from "@/components/ui/dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// Verktøylinjen eieren ser på sitt eget prosjekt.
export default function ProjectOwnerActions({
  projectId,
  status,
  pinned,
  removed,
  username,
}: {
  projectId: string;
  status: "draft" | "published";
  pinned: boolean;
  removed: boolean;
  username: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? "Noe gikk galt.");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Prosjektet er slettet");
      router.push(`/@${username}?fane=prosjekter`);
      router.refresh();
    });

  const draft = status === "draft";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 ${
        removed ? "border-danger/40 bg-danger/[0.07]" : draft ? "border-warn/40 bg-warn/[0.07]" : "border-line bg-surface/40"
      }`}
    >
      <p className="mr-auto px-1 text-sm text-mist">
        {removed ? (
          <span className="font-medium text-danger">Fjernet av en moderator. Bare du ser prosjektet.</span>
        ) : draft ? (
          <>
            <span className="font-medium text-warn">Utkast.</span> Bare du ser dette prosjektet.
          </>
        ) : (
          "Ditt prosjekt"
        )}
      </p>
      <ButtonLink href={`/prosjekt/${projectId}/rediger`} variant="secondary" size="sm">
        <PenLine className="size-4" /> Rediger
      </ButtonLink>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {!draft && !removed && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            className="max-sm:flex-1"
            onClick={() => run(() => setProjectPinnedAction(projectId, !pinned), pinned ? "Løsnet fra profilen" : "Festet på profilen")}
          >
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {pinned ? "Løsne" : <><span className="sm:hidden">Fest</span><span className="max-sm:hidden">Fest på profilen</span></>}
          </Button>
        )}
        {!removed && (
          <Button
            size="sm"
            variant={draft ? "primary" : "secondary"}
            disabled={pending}
            className="max-sm:flex-1"
            onClick={() => run(() => setProjectStatusAction(projectId, draft ? "published" : "draft"), draft ? "Prosjektet er publisert 🎉" : "Gjort om til utkast")}
          >
            {draft ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {draft ? "Publiser" : <><span className="sm:hidden">Utkast</span><span className="max-sm:hidden">Gjør til utkast</span></>}
          </Button>
        )}
        <ButtonLink href="/innsikt" variant="ghost" size="icon-sm" aria-label="Innsikt">
          <BarChart3 className="size-4" />
        </ButtonLink>
        <Button variant="ghost" size="icon-sm" aria-label="Slett prosjektet" onClick={() => setConfirmDelete(true)} className="hover:text-danger">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Slette prosjektet?" description="Bildene, kommentarene og reaksjonene forsvinner også. Dette kan ikke angres." size="sm">
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Avbryt
          </Button>
          <Button variant="danger" loading={pending} onClick={remove}>
            <Trash2 className="size-4" /> Slett for godt
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
