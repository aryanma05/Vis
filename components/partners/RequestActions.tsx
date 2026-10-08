"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Undo2, X } from "lucide-react";
import { respondToPartnerRequestAction, withdrawPartnerRequestAction } from "@/app/actions/partners";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

// Eieren svarer på en forespørsel. Et nei kan gjøres om til ja senere.
export function AnswerRequest({ requestId, name, status }: { requestId: string; name: string; status: "pending" | "declined" }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = name.split(" ")[0] || name;

  const answer = (accept: boolean) =>
    start(async () => {
      const result = await respondToPartnerRequestAction(requestId, accept);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(accept ? t("Du sa ja til {name}", { name: first }) : t("Du takket nei"), {
        description: accept ? t("{name} får beskjed og e-postadressen din, så dere kan komme i gang.", { name: first }) : undefined,
      });
      router.refresh();
    });

  if (status === "declined") {
    return (
      <Button size="xs" variant="ghost" loading={pending} onClick={() => answer(true)}>
        <Undo2 className="size-3.5" /> {t("Si ja likevel")}
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" loading={pending} onClick={() => answer(true)}>
        <Check className="size-4" /> {t("Si ja")}
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer(false)}>
        <X className="size-4" /> {t("Nei takk")}
      </Button>
    </div>
  );
}

// Den som sendte forespørselen trekker den tilbake (eller seg selv etter et ja).
export function WithdrawRequest({ requestId, accepted }: { requestId: string; accepted: boolean }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const withdraw = () =>
    start(async () => {
      const result = await withdrawPartnerRequestAction(requestId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(accepted ? t("Du har trukket deg") : t("Forespørselen er trukket tilbake"));
      router.refresh();
    });

  return (
    <>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        {accepted ? t("Trekk meg") : t("Trekk forespørselen")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title={accepted ? t("Trekke deg fra prosjektet?") : t("Trekke tilbake forespørselen?")}
        description={t("Du kan sende en ny forespørsel senere, så lenge prosjektet er åpent.")}
      >
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button size="sm" variant="danger" loading={pending} onClick={withdraw}>
            {accepted ? t("Trekk meg") : t("Trekk forespørselen")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
