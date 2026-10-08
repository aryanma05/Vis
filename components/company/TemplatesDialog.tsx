"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Lock, MessageSquareText, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { deleteTemplateAction, saveTemplateAction, setCompanyMessagingAction } from "@/app/actions/pipeline";
import { useRun } from "@/components/company/useRun";
import { useT } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { inputClass, labelClass, selectClass, textareaClass } from "@/components/ui/field";
import Switch from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { TEMPLATE_KIND_LABELS, UPSELL_TEXT, type TemplateKind } from "@/lib/company-labels";
import { findSensitiveTerms } from "@/lib/fair-hiring";
import {
  defaultTemplateFor,
  MERGE_FIELDS,
  renderMessage,
  RESPONSE_DAYS,
  TEMPLATE_BODY_MAX,
  TEMPLATE_KINDS,
  TEMPLATE_NAME_MAX,
  TEMPLATE_SUBJECT_MAX,
  templateVars,
  type MergeField,
  type TemplateVars,
} from "@/lib/template-render";

// Svarmaler: listen, en editor med flettefelt og forhåndsvisning, og «Automatisk svar».
// Egne maler krever Bedrift; standardmalene og automatisk svar har alle. Serveren sjekker
// tilgangen på nytt (lib/message-templates.ts).

const EASE = [0.16, 1, 0.3, 1] as const;

export type TemplateOption = { id: string; kind: TemplateKind; name: string; subject: string; body: string; builtIn: boolean };

const FIELD_LABELS: Record<MergeField, string> = {
  fornavn: "Fornavn",
  navn: "Fullt navn",
  stilling: "Stillingen",
  bedrift: "Bedriften",
  svartid: "Svartid i dager",
  bookinglenke: "Lenke for å booke intervju",
};

// Malene som passer når søkeren flyttes hit: samme type og de generelle.
export const templatesFor = (templates: TemplateOption[], kind: TemplateKind) => templates.filter((t) => t.kind === kind || t.kind === "generell");

// Velg mal og se meldingen slik kandidaten får den (brukt når én eller mange flyttes).
export function MessagePicker({
  templates,
  kind,
  value,
  onChange,
  vars,
  caption,
}: {
  templates: TemplateOption[];
  kind: TemplateKind;
  value: string;
  onChange: (id: string) => void;
  vars: TemplateVars;
  caption?: string;
}) {
  const t = useT();
  const options = templatesFor(templates, kind);
  const chosen = options.find((o) => o.id === value) ?? defaultTemplateFor(templates, kind);
  const message = chosen ? renderMessage(chosen, vars) : null;
  return (
    <div className="space-y-3">
      <label className="block">
        <span className={labelClass}>{t("Melding")}</span>
        <select className={selectClass} value={chosen?.id ?? ""} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.builtIn ? t("{name} (standard)", { name: t(o.name) }) : o.name} · {t(TEMPLATE_KIND_LABELS[o.kind])}
            </option>
          ))}
        </select>
      </label>
      {message && (
        <div className="rounded-[18px] bg-fill p-4">
          {caption && <p className="caption mb-2">{caption}</p>}
          <p className="text-sm font-semibold text-fg">{message.subject}</p>
          <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-line text-sm leading-6 text-fg/85">{message.body}</p>
        </div>
      )}
    </div>
  );
}

type Draft = { id: string | null; kind: TemplateKind; name: string; subject: string; body: string };

export function TemplatesDialog({
  companyId,
  templates,
  business,
  canEdit,
  autoReply,
  responseDays,
  sample,
  base,
}: {
  companyId: string;
  templates: TemplateOption[];
  business: boolean;
  canEdit: boolean;
  autoReply: boolean;
  responseDays: number;
  sample: { name: string; jobTitle: string; companyName: string; bookingUrl: string };
  base: string;
}) {
  const { pending, run, t } = useRun();
  const reduce = useReduceMotion();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reply, setReply] = useState({ autoReply, responseDays });
  const own = templates.filter((x) => !x.builtIn).length;
  const editable = business && canEdit;

  const saveMessaging = (next: { autoReply: boolean; responseDays: number }) => {
    const before = reply;
    setReply(next);
    run(async () => {
      const result = await setCompanyMessagingAction(companyId, next);
      if (!result.ok) setReply(before);
      return result;
    }, "Lagret");
  };

  const close = () => {
    setOpen(false);
    setDraft(null);
  };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MessageSquareText className="size-4" /> {t("Maler")}
        {own > 0 && <span className="rounded-full bg-fill px-1.5 text-xs tabular-nums text-mist">{own}</span>}
      </Button>

      <Dialog open={open} onClose={close} size="lg" title={t("Svarmaler")} description={t("Det kandidatene får på e-post når dere flytter dem. Flettefeltene fylles inn for hver søker.")}>
        <AnimatePresence mode="wait" initial={false}>
          {draft ? (
            <motion.div key="editor" initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -12 }} transition={{ duration: 0.22, ease: EASE }}>
              <Editor
                draft={draft}
                setDraft={setDraft}
                sample={sample}
                responseDays={reply.responseDays}
                pending={pending}
                editable={editable}
                onBack={() => setDraft(null)}
                onDelete={() => setConfirmDelete(true)}
                onSave={() =>
                  run(async () => {
                    const result = await saveTemplateAction(companyId, draft);
                    if (result.ok) setDraft(null);
                    return result;
                  }, "Malen er lagret")
                }
              />
            </motion.div>
          ) : (
            <motion.div key="list" initial={reduce ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: 12 }} transition={{ duration: 0.22, ease: EASE }} className="space-y-7">
              <section className="rounded-[22px] glass-card p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Sparkles className="size-4 text-sea" aria-hidden="true" /> {t("Automatisk svar")}
                </h3>
                <div className="mt-4 space-y-4">
                  <Switch
                    checked={reply.autoReply}
                    disabled={!canEdit || pending}
                    onChange={(on) => saveMessaging({ ...reply, autoReply: on })}
                    label={t("Send «Takk for søknaden» med en gang")}
                    description={t("Alle som søker får et svar med en gang, med svartiden dere lover. Gjelder alle planer.")}
                  />
                  <div className={reply.autoReply ? "" : "opacity-50"}>
                    <p className="mb-2 text-sm font-medium text-fg">{t("Vi svarer innen")}</p>
                    <Segmented
                      size="sm"
                      label={t("Vi svarer innen")}
                      value={String(reply.responseDays)}
                      onChange={(v) => canEdit && saveMessaging({ ...reply, responseDays: Number(v) })}
                      options={RESPONSE_DAYS.map((d) => ({ value: String(d), label: t("{n} dager", { n: d }) }))}
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{t("Maler")}</h3>
                  {editable && (
                    <Button size="xs" variant="secondary" onClick={() => setDraft({ id: null, kind: "avslag", name: "", subject: "", body: "" })}>
                      <Plus className="size-3.5" /> {t("Ny mal")}
                    </Button>
                  )}
                </div>
                {!business && (
                  <p className="mt-3 flex items-start gap-2 rounded-[18px] bg-fill p-4 text-sm text-mist">
                    <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      {t(UPSELL_TEXT.maler)}{" "}
                      <Link href={`${base}?fane=abonnement`} className="font-medium text-ice hover:underline">
                        {t("Se Bedrift")}
                      </Link>
                    </span>
                  </p>
                )}
                <div className="mt-4 space-y-4">
                  {TEMPLATE_KINDS.map((kind) => {
                    const items = templates.filter((x) => x.kind === kind);
                    const active = defaultTemplateFor(templates, kind);
                    return (
                      <div key={kind}>
                        <p className="caption">{t(TEMPLATE_KIND_LABELS[kind])}</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {items.map((item, i) => (
                            <motion.li key={item.id} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE, delay: i * 0.03 }}>
                              <button
                                type="button"
                                onClick={() => setDraft({ id: item.builtIn ? null : item.id, kind: item.kind, name: item.builtIn ? "" : item.name, subject: item.subject, body: item.body })}
                                className="flex w-full items-center gap-3 rounded-[14px] glass-chip px-3.5 py-2.5 text-left transition hover:bg-fill-2"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-fg">{item.builtIn ? t(item.name) : item.name}</span>
                                  <span className="block truncate text-xs text-mist">{item.subject}</span>
                                </span>
                                {item.builtIn && <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-mist">{t("Standard")}</span>}
                                {active?.id === item.id && kind !== "generell" && (
                                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">{t("Brukes nå")}</span>
                                )}
                              </button>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm" title={t("Slette malen?")} description={t("Standardmalen brukes igjen der denne var valgt.")}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            {t("Avbryt")}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              draft?.id &&
              run(async () => {
                const result = await deleteTemplateAction(draft.id!);
                if (result.ok) {
                  setConfirmDelete(false);
                  setDraft(null);
                }
                return result;
              }, "Malen er slettet")
            }
          >
            {t("Slett malen")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function Editor({
  draft,
  setDraft,
  sample,
  responseDays,
  pending,
  editable,
  onBack,
  onSave,
  onDelete,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  sample: { name: string; jobTitle: string; companyName: string; bookingUrl: string };
  responseDays: number;
  pending: boolean;
  editable: boolean;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<"subject" | "body">("body");
  const vars = useMemo(() => templateVars({ ...sample, responseDays }), [sample, responseDays]);
  const preview = renderMessage(draft, vars);
  const warnings = findSensitiveTerms(`${draft.subject}\n${draft.body}`);
  const isNew = draft.id === null;

  // Setter inn {felt} der markøren står, i emnet eller teksten.
  const insert = (field: MergeField) => {
    const token = `{${field}}`;
    const el = focus === "subject" ? subjectRef.current : bodyRef.current;
    const key = focus === "subject" ? "subject" : "body";
    const value = draft[key];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setDraft({ ...draft, [key]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-fg">
        <ArrowLeft className="size-4" /> {t("Alle maler")}
      </button>

      {!editable && <p className="rounded-[18px] bg-fill p-3 text-sm text-mist">{t("Dette er en forhåndsvisning. Egne maler krever Bedrift.")}</p>}

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <label className="block">
          <span className={labelClass}>{t("Navn")}</span>
          <input
            className={inputClass}
            value={draft.name}
            maxLength={TEMPLATE_NAME_MAX}
            disabled={!editable}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t(TEMPLATE_KIND_LABELS[draft.kind])}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("Type")}</span>
          <select className={selectClass} value={draft.kind} disabled={!editable} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TemplateKind })}>
            {TEMPLATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(TEMPLATE_KIND_LABELS[k])}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>{t("Emne")}</span>
        <input
          ref={subjectRef}
          className={inputClass}
          value={draft.subject}
          maxLength={TEMPLATE_SUBJECT_MAX}
          disabled={!editable}
          onFocus={() => setFocus("subject")}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        />
      </label>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-fg">{t("Tekst")}</span>
          <span className="text-xs tabular-nums text-mist">
            {draft.body.length} / {TEMPLATE_BODY_MAX}
          </span>
        </div>
        {editable && (
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t("Flettefelt")}>
            {MERGE_FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(f)}
                title={t(FIELD_LABELS[f])}
                className="rounded-full glass-chip px-2.5 py-1 font-mono text-[11px] text-fg/85 transition hover:bg-fill-2 hover:text-fg"
              >
                {`{${f}}`}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={bodyRef}
          className={`${textareaClass} min-h-48 font-[inherit]`}
          value={draft.body}
          maxLength={TEMPLATE_BODY_MAX}
          disabled={!editable}
          onFocus={() => setFocus("body")}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <p className="mt-1.5 text-[13px] leading-5 text-mist">{t("En linje der et flettefelt er tomt, tas bort. Bookinglenken kommer bare med når stillingen har ledige intervjutider.")}</p>
      </div>

      {warnings.length > 0 && (
        <p className="flex items-start gap-2 rounded-[18px] bg-warn/10 p-3 text-sm text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("Teksten nevner {terms}. Ikke vurder eller spør kandidater om dette (likestillings- og diskrimineringsloven).", { terms: warnings.join(", ") })}</span>
        </p>
      )}

      <div className="rounded-[22px] glass-card p-5">
        <p className="caption">{t("Slik ser {name} den", { name: sample.name.split(" ")[0] })}</p>
        <p className="mt-2 font-semibold text-fg">{preview.subject || t("(uten emne)")}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-fg/85">{preview.body}</p>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!isNew ? (
            <Button variant="ghost" size="sm" className="hover:text-danger" onClick={onDelete}>
              <Trash2 className="size-4" /> {t("Slett")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            loading={pending}
            onClick={() => {
              if (!draft.subject.trim() || !draft.body.trim()) return void toast.error("Malen trenger både emne og tekst.");
              onSave();
            }}
          >
            {isNew && draft.subject ? <Copy className="size-4" /> : null}
            {isNew ? t("Lagre som egen mal") : t("Lagre malen")}
          </Button>
        </div>
      )}
    </div>
  );
}
