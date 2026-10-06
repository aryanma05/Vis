"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PenLine, Trash2, X } from "lucide-react";
import { deleteCollectionAction, setCollectionItemAction, updateCollectionAction } from "@/app/actions/collections";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";

// Redigering av en samling (bare for eieren).
export function CollectionOwnerTools({
  id,
  initial,
}: {
  id: string;
  initial: { title: string; description: string | null; isPublic: boolean };
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ ...initial, description: initial.description ?? "" });
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const result = await updateCollectionAction(id, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!window.confirm(t("Slette samlingen? Prosjektene slettes ikke."))) return;
      const result = await deleteCollectionAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Samlingen er slettet");
      router.push("/samlinger");
      router.refresh();
    });

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <PenLine className="size-4" /> {t("Rediger")}
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} className="hover:text-danger">
          <Trash2 className="size-4" /> {t("Slett")}
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Rediger samlingen")}>
        <div className="mt-5 space-y-4">
          <Field label={t("Navn")}>
            <input className={inputClass} value={values.title} maxLength={80} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} />
          </Field>
          <Field label={t("Beskrivelse")} optional>
            <textarea className={`${textareaClass} min-h-20`} value={values.description} maxLength={500} onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))} />
          </Field>
          <Switch
            checked={values.isPublic}
            onChange={(on) => setValues((v) => ({ ...v, isPublic: on }))}
            label={t("Offentlig")}
            description={t("Vises på profilen din, og alle med lenken kan se den.")}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("Avbryt")}
            </Button>
            <Button size="sm" onClick={save} loading={pending}>
              {t("Lagre")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function RemoveFromCollection({ collectionId, projectId }: { collectionId: string; projectId: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setCollectionItemAction(collectionId, projectId, false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          router.refresh();
        })
      }
      className="mt-2 inline-flex items-center gap-1 text-xs text-mist transition hover:text-danger"
    >
      <X className="size-3.5" /> {t("Fjern fra samlingen")}
    </button>
  );
}
