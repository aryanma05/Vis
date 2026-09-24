"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reportAction } from "@/app/actions/reports";
import Dialog from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason } from "@/lib/constants";

const WHAT = { project: "prosjektet", comment: "kommentaren", user: "profilen" } as const;

// Rapporter innhold til moderatorene. Brukes fra menyene på prosjekter, kommentarer og profiler.
export default function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  loggedIn,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "project" | "comment" | "user";
  targetId: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return setError("Velg hva som er galt.");
    setPending(true);
    setError(null);
    const result = await reportAction({ targetType, targetId, reason, details });
    setPending(false);
    if (!result.ok) return setError(result.error);
    onClose();
    setReason(null);
    setDetails("");
    toast.success("Takk for at du sa fra", { description: "En moderator ser på det så snart som mulig." });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Rapporter ${WHAT[targetType]}`}
      description="Rapporter er anonyme for den du rapporterer. Se retningslinjene for hva som ikke er lov."
    >
      {!loggedIn ? (
        <div className="space-y-4">
          <p className="text-mist">Du må være logget inn for å rapportere, så vi kan følge opp og hindre misbruk.</p>
          <Button onClick={() => router.push(`/logg-inn?neste=${encodeURIComponent(window.location.pathname)}`)}>Logg inn</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="sr-only">Hva er galt?</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                  reason === r ? "border-ice/60 bg-ice/10 text-fg" : "border-line text-fg/90 hover:border-mist/40"
                }`}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--ice)]" />
                {REPORT_REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Mer om det <span className="font-normal text-mist/60">valgfritt</span>
            </span>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={3} className={textareaClass} placeholder="Hva skjedde?" />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Avbryt
            </Button>
            <Button onClick={submit} loading={pending}>
              Send rapport
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
