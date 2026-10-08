"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { markHiredAction } from "@/app/actions/applications";
import { useRun } from "@/components/company/useRun";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/tabs";

// «Marker som ansatt» (søkere i Tilbud). Spørsmålet om byrå gir tallet for byråkostnaden
// dere slapp i Spart med Vis. Kandidaten får ingen beskjed.
export function HireDialog({ open, onClose, applicationId, name }: { open: boolean; onClose: () => void; applicationId: string; name: string }) {
  const { pending, run, t } = useRun();
  const [agency, setAgency] = useState<"ja" | "nei">("nei");
  return (
    <Dialog open={open} onClose={onClose} size="sm" title={t("Marker {name} som ansatt", { name: name.split(" ")[0] })} description={t("Teller med i «Spart med Vis». Kandidaten får ingen beskjed om dette.")}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-success/10 p-3 text-sm text-success">
          <PartyPopper className="size-5 shrink-0" aria-hidden="true" />
          <span>{t("Gratulerer med ansettelsen!")}</span>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-fg">{t("Ville dere ellers brukt rekrutteringsbyrå?")}</p>
          <Segmented
            label={t("Ville dere ellers brukt rekrutteringsbyrå?")}
            value={agency}
            onChange={setAgency}
            options={[
              { value: "ja", label: t("Ja") },
              { value: "nei", label: t("Nei") },
            ]}
          />
          <p className="mt-2 text-xs leading-5 text-mist">{t("Byråkostnaden dere slapp vises for seg, ved siden av tiden dere sparte.")}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t("Avbryt")}
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              run(async () => {
                const result = await markHiredAction(applicationId, agency === "ja");
                if (result.ok) onClose();
                return result;
              }, "Markert som ansatt")
            }
          >
            {t("Marker som ansatt")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
