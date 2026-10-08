"use client";

import { Trash2 } from "lucide-react";
import { deleteJobAction, setJobStatusAction } from "@/app/actions/jobs";
import { useRun } from "@/components/company/useRun";
import { Button } from "@/components/ui/button";

// Publiser, lukk og slett en stilling. fresh (søkere i Ny) og business brukes av
// lukke- og slettedialogene (P3).
export function JobActions({ jobId, status }: { jobId: string; status: "draft" | "published" | "closed"; fresh?: number; business?: boolean }) {
  const { pending, run, t } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button size="xs" onClick={() => run(() => setJobStatusAction(jobId, "published"), t("Stillingen er publisert"))} loading={pending}>
          {t("Publiser")}
        </Button>
      )}
      {status === "published" && (
        <Button size="xs" variant="secondary" onClick={() => run(() => setJobStatusAction(jobId, "closed"), t("Stillingen er lukket"))} loading={pending}>
          {t("Lukk")}
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        className="hover:text-danger"
        onClick={() => window.confirm(t("Slette stillingen?")) && run(() => deleteJobAction(jobId), t("Slettet"))}
        aria-label={t("Slett stillingen")}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
