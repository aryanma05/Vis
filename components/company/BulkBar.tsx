"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { ArrowRightLeft, ChevronDown, Info, MailX, X } from "lucide-react";
import { bulkSetApplicationStatusAction } from "@/app/actions/pipeline";
import { MessagePicker, type TemplateOption } from "@/components/company/TemplatesDialog";
import { STAGE_FILL } from "@/components/company/tones";
import { useT } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import type { TemplateKind } from "@/lib/company-labels";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, type ApplicationStage } from "@/lib/constants";
import { templateVars } from "@/lib/template-render";

// Fast linje nederst når man har valgt søkere: «Flytt til…» og «Avslå med mal». Før noe
// sendes, vises antallet og meldingen slik den første kandidaten får den. Maks 100 per gang;
// serveren hopper over trukne søknader og teller dem som «hoppet over».

const EASE = [0.16, 1, 0.3, 1] as const;
const MAX = 100;
const STAGE_KIND: Partial<Record<ApplicationStage, TemplateKind>> = { intervju: "intervju", tilbud: "tilbud", avslag: "avslag" };

export type Selected = { id: string; name: string; jobId: string; jobTitle: string };
export type MessageContext = { companyName: string; responseDays: number; siteUrl: string; openSlotJobs: string[] };

export function BulkBar({ companyId, selected, templates, ctx, onClear }: { companyId: string; selected: Selected[]; templates: TemplateOption[]; ctx: MessageContext; onClear: () => void }) {
  const t = useT();
  const router = useRouter();
  const reduce = useReduceMotion();
  const [action, setAction] = useState<ApplicationStage | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [pending, start] = useTransition();
  const n = selected.length;
  const first = selected[0];
  const kind = action ? STAGE_KIND[action] : undefined;
  const status = action ? t(APPLICATION_STATUS_LABELS[action]) : "";

  const open = (stage: ApplicationStage) => {
    setTemplateId("");
    setAction(stage);
  };

  const confirm = () =>
    start(async () => {
      if (!action) return;
      const result = await bulkSetApplicationStatusAction(
        companyId,
        selected.map((s) => s.id),
        action,
        templateId || null,
      );
      if (!result.ok) return void toast.error(result.error);
      const { changed, skipped } = result.data;
      toast.success(changed === 1 ? t("1 søker er flyttet til {status}", { status }) : t("{n} søkere er flyttet til {status}", { n: changed, status }), {
        description: [kind && changed > 0 ? t("Alle har fått beskjed.") : null, skipped > 0 ? t("{n} ble hoppet over (trukket eller sto der fra før).", { n: skipped }) : null].filter(Boolean).join(" ") || undefined,
      });
      setAction(null);
      onClear();
      router.refresh();
    });

  return (
    <>
      <AnimatePresence>
        {n > 0 && (
          <motion.div
            role="toolbar"
            aria-label={t("Valgte søkere")}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="fixed inset-x-0 bottom-24 z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full glass-strong px-4 py-2 md:bottom-6"
          >
            <span className="flex items-center gap-2 pr-1 text-sm font-semibold tabular-nums text-fg">
              <motion.span key={n} initial={reduce ? false : { scale: 1.35 }} animate={{ scale: 1 }} transition={{ duration: 0.25, ease: EASE }} className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-on-primary">
                {n}
              </motion.span>
              <span className="hidden sm:inline">{t("valgt")}</span>
            </span>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <Menu
              label={t("Flytt til…")}
              side="top"
              align="start"
              trigger={({ open: isOpen, toggle, id }) => (
                <Button size="sm" variant="ghost" onClick={toggle} aria-haspopup="menu" aria-expanded={isOpen} aria-controls={id}>
                  <ArrowRightLeft className="size-4" /> <span className="hidden sm:inline">{t("Flytt til…")}</span> <ChevronDown className="size-3.5" />
                </Button>
              )}
            >
              {APPLICATION_STAGES.map((stage) => (
                <MenuItem key={stage} onSelect={() => open(stage)} icon={<span className={`block size-2 rounded-full ${STAGE_FILL[stage]}`} />}>
                  {t(APPLICATION_STATUS_LABELS[stage])}
                </MenuItem>
              ))}
            </Menu>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => open("avslag")}>
              <MailX className="size-4" /> <span className="hidden sm:inline">{t("Avslå med mal")}</span>
            </Button>
            <button type="button" onClick={onClear} aria-label={t("Avbryt valget")} className="flex size-8 items-center justify-center rounded-full bg-fill text-mist transition hover:bg-fill-2 hover:text-fg">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === "avslag" ? (n === 1 ? t("Avslå 1 søker") : t("Avslå {n} søkere", { n })) : n === 1 ? t("Flytt 1 søker til {status}", { status }) : t("Flytt {n} søkere til {status}", { n, status })}
        description={kind ? t("Alle får varsel i appen og meldingen under på e-post, med sitt eget navn og sin stilling.") : t("Søkerne flyttes uten at de får noen melding.")}
      >
        <div className="space-y-5">
          {n > MAX && <p className="rounded-[18px] bg-danger/10 p-3 text-sm text-danger">{t("Dere kan flytte maks {n} søkere om gangen. Fjern noen fra utvalget.", { n: MAX })}</p>}
          {kind && first && (
            <MessagePicker
              templates={templates}
              kind={kind}
              value={templateId}
              onChange={setTemplateId}
              caption={t("Slik ser {name} den", { name: first.name.split(" ")[0] })}
              vars={templateVars({
                name: first.name,
                jobTitle: first.jobTitle,
                companyName: ctx.companyName,
                responseDays: ctx.responseDays,
                bookingUrl: action === "intervju" && ctx.openSlotJobs.includes(first.jobId) ? `${ctx.siteUrl}/soknader/${first.id}/book` : null,
              })}
            />
          )}
          <p className="flex items-start gap-2 text-xs leading-5 text-mist">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("Trukne søknader og søkere som allerede står der, hoppes over. Handlingen logges.")}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setAction(null)}>
              {t("Avbryt")}
            </Button>
            <Button variant={action === "avslag" ? "danger" : "primary"} loading={pending} disabled={n === 0 || n > MAX} onClick={confirm}>
              {action === "avslag" ? t("Avslå og send") : kind ? t("Flytt og send") : t("Flytt")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
