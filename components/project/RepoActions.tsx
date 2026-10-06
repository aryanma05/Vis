"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { syncProjectReadmeAction } from "@/app/actions/github";
import { useT } from "@/components/LocaleProvider";
import Dialog from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// «git clone …» med kopier-knapp, og ZIP-nedlasting av hovedgrenen.
export function CloneField({ cloneUrl, zipUrl }: { cloneUrl: string; zipUrl: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const command = `git clone ${cloneUrl}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("Fikk ikke kopiert. Merk teksten og kopier selv."));
    }
  }

  return (
    <div>
      <p className="caption">{t("Klon")}</p>
      <div className="mt-2 flex items-center gap-1 rounded-xl border border-line bg-ink-2/70 py-1 pl-3 pr-1">
        <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11.5px] text-fg/85">{command}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={t(copied ? "Kopiert" : "Kopier kommandoen")}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-mist transition hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </button>
        <a
          href={zipUrl}
          aria-label={t("Last ned som ZIP fra GitHub")}
          title={t("Last ned som ZIP")}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-mist transition hover:bg-surface-2 hover:text-fg"
        >
          <Download className="size-4" />
        </a>
      </div>
    </div>
  );
}

// Eieren kan hente README-en på nytt når repoet har endret seg.
export function SyncReadmeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const sync = () =>
    startTransition(async () => {
      const result = await syncProjectReadmeAction(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("Beskrivelsen er oppdatert fra GitHub");
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-medium text-mist transition hover:text-ice">
        <RefreshCw className="size-4" aria-hidden="true" /> {t("Hent README på nytt")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Hente README-en på nytt?")}
        description={t("Beskrivelsen byttes ut med den nyeste README-en fra GitHub. Endringer du har gjort i beskrivelsen her, forsvinner. Tittel, bilder og tagger beholdes.")}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t("Avbryt")}
          </Button>
          <Button loading={pending} onClick={sync}>
            <RefreshCw className="size-4" /> {t("Hent på nytt")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
