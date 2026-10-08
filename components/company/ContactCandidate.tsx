"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { contactCandidateAction } from "@/app/actions/talent";
import { useT } from "@/components/LocaleProvider";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { CONTACT_REASON_LABELS, CONTACT_REASONS, type ContactReason } from "@/lib/constants";

export function ContactCandidate({ companyId, userId, name }: { companyId: string; userId: string; name: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContactReason>("jobb");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const first = name.split(" ")[0];
  return (
    <>
      <Button size="xs" variant="secondary" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" /> {t("Kontakt")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Kontakt {name}", { name: first })}
        description={t("Meldingen sendes som varsel og e-post. Svaret kommer til e-posten din.")}
      >
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {CONTACT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reason === r}
                onClick={() => setReason(r)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${reason === r ? "bg-primary text-on-primary" : "glass-chip"}`}
              >
                {t(CONTACT_REASON_LABELS[r])}
              </button>
            ))}
          </div>
          <textarea className={`${textareaClass} mt-4 min-h-32`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder={t("Hei {name}! …", { name: first })} aria-label={t("Melding")} />
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              loading={pending}
              disabled={message.trim().length < 20}
              onClick={() =>
                start(async () => {
                  const result = await contactCandidateAction(companyId, userId, { reason, message });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  setOpen(false);
                  setMessage("");
                  toast.success(t("Meldingen er sendt til {name}", { name: first }));
                })
              }
            >
              {t("Send")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
