"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { acceptInviteAction, declineInviteAction } from "@/app/actions/company-invites";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import type { InviteKind } from "@/lib/company-labels";

// «Godta» og «Avslå» på en invitasjon: fra /varsler og /invitasjoner (inviteId) eller fra
// lenken i e-posten (token). Avslå virker med lenken alene; godta krever riktig konto.
export default function InviteResponse({
  inviteId,
  token,
  kind,
  companySlug,
  canAccept = true,
}: {
  inviteId?: string;
  token?: string;
  kind: InviteKind;
  companySlug: string;
  canAccept?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [showOnPage, setShowOnPage] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"accept" | "decline" | null>(null);
  const ref = inviteId ? { inviteId } : { token };

  const accept = () => {
    setWhich("accept");
    start(async () => {
      const result = await acceptInviteAction({ ...ref, showOnPage });
      if (!result.ok) return void toast.error(result.error);
      setDone("accepted");
      toast.success("Invitasjonen er godtatt");
      // Tilgang og eierskap: rett inn i administrasjonen. Teamet: bedriftssiden der du vises.
      const slug = result.data.companySlug || companySlug;
      router.push(kind === "employee" ? `/bedrift/${slug}` : kind === "owner" ? `/bedrift/${slug}/admin?fane=medlemmer` : `/bedrift/${slug}/admin`);
      router.refresh();
    });
  };

  const decline = () => {
    setWhich("decline");
    start(async () => {
      const result = await declineInviteAction(ref);
      if (!result.ok) return void toast.error(result.error);
      setDone("declined");
      toast.success("Invitasjonen er avslått");
      router.refresh();
    });
  };

  if (done === "declined") {
    return <p className="text-sm text-mist">{t("Du avslo invitasjonen. Ingenting er delt med bedriften.")}</p>;
  }

  return (
    <div className="space-y-4">
      {canAccept && kind === "member" && (
        <div className="rounded-[16px] bg-fill px-4 py-3">
          <Switch
            checked={showOnPage}
            onChange={setShowOnPage}
            label={t("Vis meg på bedriftssiden")}
            description={t("Av som standard. Du kan endre det senere under Team og tilgang.")}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canAccept && (
          <Button size="sm" onClick={accept} loading={pending && which === "accept"} disabled={pending || done !== null}>
            <Check className="size-4" /> {t("Godta")}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={decline} loading={pending && which === "decline"} disabled={pending || done !== null}>
          <X className="size-4" /> {t("Avslå")}
        </Button>
      </div>
    </div>
  );
}
