"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { deletePartnerPostAction, setPartnerPostClosedAction } from "@/app/actions/partners";
import { useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

// Rediger, lukk (når du har funnet folk) eller slett en utlysning.
export default function PostOwnerActions({ postId, closed }: { postId: string; closed: boolean }) {
  const t = useT();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      const result = await setPartnerPostClosedAction(postId, !closed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(closed ? t("Åpen for forespørsler igjen") : t("Lukket"), {
        description: closed ? undefined : t("Prosjektet vises ikke lenger på partnersiden eller profilen din."),
      });
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const result = await deletePartnerPostAction(postId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("Slettet"));
      router.push("/partnere");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={`/partnere/${postId}/rediger`} size="sm" variant="secondary">
        <Pencil className="size-4" /> {t("Rediger")}
      </ButtonLink>
      <Button size="sm" variant="secondary" loading={pending && !confirm} onClick={toggle}>
        {closed ? <LockOpen className="size-4" /> : <Lock className="size-4" />} {closed ? t("Åpne igjen") : t("Lukk")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} aria-label={t("Slett")}>
        <Trash2 className="size-4" />
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title={t("Slette prosjektet?")}
        description={t("Forespørslene slettes også. Vil du bare stoppe nye forespørsler, kan du lukke det i stedet.")}
      >
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            {t("Avbryt")}
          </Button>
          <Button size="sm" variant="danger" loading={pending} onClick={remove}>
            {t("Slett")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
