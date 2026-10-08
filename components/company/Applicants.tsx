"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMemo, useState, useTransition } from "react";
import { BadgeCheck, CalendarCheck, Check, ChevronLeft, ChevronRight, ClipboardCheck, Columns3, Ellipsis, GripVertical, MessageSquare, PartyPopper, Undo2 } from "lucide-react";
import { setApplicationStatusAction, unmarkHiredAction } from "@/app/actions/applications";
import Avatar from "@/components/Avatar";
import { BulkBar, type MessageContext, type Selected } from "@/components/company/BulkBar";
import { HireDialog } from "@/components/company/HireDialog";
import { MessagePicker, type TemplateOption } from "@/components/company/TemplatesDialog";
import { ageTone, STAGE_FILL, STAGE_TONE } from "@/components/company/tones";
import { useLocale, useT } from "@/components/LocaleProvider";
import { useReduceMotion } from "@/components/settings/display-prefs";
import { Button, ButtonLink } from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { Menu, MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import type { TemplateKind } from "@/lib/company-labels";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, type ApplicationStage, type ApplicationStatus } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { dateLocale, type Locale } from "@/lib/i18n";
import { templateVars } from "@/lib/template-render";

export type { MessageContext } from "@/components/company/BulkBar";

export type BoardApplicant = {
  id: string;
  status: ApplicationStage;
  createdAt: Date | string;
  statusChangedAt: Date | string;
  job: { id: string; title: string };
  candidate: { id: string; name: string; username: string; image: string | null; headline: string | null; location: string | null; studyProgram: string | null; graduationYear: number | null };
  usedTech: { name: string; n: number }[];
  highlights: { id: string; title: string; cover: string | null }[];
  noteCount: number;
  reviewCount: number;
  interviewAt: Date | string | null;
  hiredAt: Date | string | null;
};

export type WithdrawnApplicant = { id: string; job: { id: string; title: string }; candidate: { id: string; name: string; username: string; image: string | null } };

const EASE = [0.16, 1, 0.3, 1] as const;
const MAX_COMPARE = 4;
const DAY = 86_400_000;
const STAGE_KIND: Partial<Record<ApplicationStage, TemplateKind>> = { intervju: "intervju", tilbud: "tilbud", avslag: "avslag" };

// Hele dager siden datoen (til «6 d i Ny»).
const daysSince = (date: Date | string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY));

// «tor 14:00» denne uka, ellers «14. okt 14:00». Alltid norsk tid.
export function formatInterview(date: Date | string, locale: Locale) {
  const d = new Date(date);
  const soon = d.getTime() - Date.now() < 6 * DAY && d.getTime() > Date.now() - DAY;
  return new Intl.DateTimeFormat(dateLocale(locale), {
    ...(soon ? { weekday: "short" } : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo",
  }).format(d);
}

// Teknologiene kandidaten har brukt i prosjektene sine, med antall prosjekter.
export function UsedTech({ tech, max = 5, className = "" }: { tech: { name: string; n: number }[]; max?: number; className?: string }) {
  const t = useT();
  if (tech.length === 0) return null;
  return (
    <p className={`flex flex-wrap gap-1 ${className}`} title={t("Teknologier brukt i publiserte prosjekter (antall prosjekter)")}>
      {tech.slice(0, max).map((item) => (
        <span key={item.name} className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-fg/80">
          {item.name}
          {item.n > 1 && <span className="text-mist"> ×{item.n}</span>}
        </span>
      ))}
    </p>
  );
}

// Hvor lenge søkeren har stått i Ny eller Intervju: grå, gul fra 7 dager, rød fra 14.
export function AgeChip({ status, since, className = "" }: { status: ApplicationStatus; since: Date | string; className?: string }) {
  const t = useT();
  if (status !== "ny" && status !== "intervju") return null;
  const days = daysSince(since);
  if (days < 1) return null;
  return (
    <span suppressHydrationWarning className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${ageTone(days)} ${className}`}>
      {t("{n} d i {status}", { n: days, status: t(APPLICATION_STATUS_LABELS[status]) })}
    </span>
  );
}

function useMove() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const move = (id: string, status: ApplicationStage, name?: string, templateId?: string | null, after?: () => void) =>
    start(async () => {
      const result = await setApplicationStatusAction(id, status, templateId ?? null);
      if (!result.ok) return void toast.error(result.error);
      const label = t(APPLICATION_STATUS_LABELS[status]);
      toast.success(name ? t("{name} er flyttet til {status}", { name, status: label }) : t("Flyttet til {status}", { status: label }), {
        description: status !== "ny" ? t("Kandidaten har fått beskjed.") : undefined,
      });
      after?.();
      router.refresh();
    });
  return { pending, move };
}

// Søkeroversikten: Ny → Intervju → Tilbud → Avslag. Dra kortene mellom kolonnene, eller bruk
// pilene; da sendes standardmalen for statusen. «Velg» gir avkrysning og linjen nederst for
// å flytte eller avslå mange på en gang. Alt sjekkes på nytt på serveren.
export function ApplicantBoard({
  applicants,
  withdrawn,
  base,
  companyId,
  canManage,
  canHire,
  readOnly,
  selecting,
  showJob,
  templates,
  ctx,
}: {
  applicants: BoardApplicant[];
  withdrawn: WithdrawnApplicant[];
  base: string;
  companyId: string;
  canManage: boolean;
  canHire: boolean;
  // Hvorfor kortene ikke kan flyttes: planen (uten Bedrift) eller rollen (vurderer).
  readOnly: "plan" | "role" | null;
  selecting: boolean;
  showJob: boolean;
  templates: TemplateOption[];
  ctx: MessageContext;
}) {
  const t = useT();
  const reduce = useReduceMotion();
  const { pending, move } = useMove();
  const [compare, setCompare] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<ApplicationStage | null>(null);
  const [hiring, setHiring] = useState<BoardApplicant | null>(null);

  const columns = useMemo(() => APPLICATION_STAGES.map((stage) => ({ stage, items: applicants.filter((a) => a.status === stage) })), [applicants]);
  const total = applicants.length;
  const toggleCompare = (userId: string) =>
    setCompare((list) => (list.includes(userId) ? list.filter((x) => x !== userId) : list.length >= MAX_COMPARE ? list : [...list, userId]));
  const toggleSelected = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const selectColumn = (ids: string[]) =>
    setSelected((list) => (ids.every((id) => list.includes(id)) ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])]));
  const chosen: Selected[] = applicants.filter((a) => selected.includes(a.id)).map((a) => ({ id: a.id, name: a.candidate.name, jobId: a.job.id, jobTitle: a.job.title }));

  return (
    <div>
      <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">
          {selecting
            ? t("Kryss av søkere, og bruk linjen nederst for å flytte eller avslå dem med en mal.")
            : canManage
              ? t("Dra kortene mellom kolonnene. Kandidaten får beskjed automatisk.")
              : readOnly === "role"
                ? t("Du kan se søkerne, skrive notater og vurdere dem. Rekrutterere og administratorer flytter dem videre.")
                : t("Søkerne kommer inn her. Med Bedrift kan dere flytte dem videre, og de får beskjed automatisk.")}
        </p>
        {compare.length > 0 && !selecting && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCompare([])} className="text-sm text-mist hover:text-fg">
              {t("Nullstill")}
            </button>
            <ButtonLink href={`${base}/sammenlign?folk=${compare.join(",")}`} size="sm" variant={compare.length > 1 ? "primary" : "secondary"}>
              <Columns3 className="size-4" /> {t("Sammenlign {n}", { n: compare.length })}
            </ButtonLink>
          </div>
        )}
      </div>

      {/* Fordelingen per kolonne (tallene står også i kolonneoverskriftene). */}
      {total > 0 && (
        <div className="mb-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
          {columns.map(({ stage, items }) =>
            items.length > 0 ? (
              <motion.span
                key={stage}
                className={`h-full ${STAGE_FILL[stage]}`}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(items.length / total) * 100}%` }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            ) : null,
          )}
        </div>
      )}

      <div className="-mx-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[900px] grid-cols-4 gap-3">
          {columns.map(({ stage, items }) => {
            const ids = items.map((a) => a.id);
            const allChosen = ids.length > 0 && ids.every((id) => selected.includes(id));
            return (
              <section
                key={stage}
                aria-label={t(APPLICATION_STATUS_LABELS[stage])}
                onDragOver={(e) => {
                  if (!canManage || !dragging) return;
                  e.preventDefault();
                  setOver(stage);
                }}
                onDragLeave={() => setOver((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = e.dataTransfer.getData("text/plain");
                  const card = applicants.find((a) => a.id === id);
                  if (canManage && card && card.status !== stage) move(id, stage, card.candidate.name.split(" ")[0]);
                  setDragging(null);
                }}
                className={`flex min-h-64 flex-col rounded-[22px] p-2.5 transition ${over === stage ? "bg-sea/10 ring-2 ring-sea/50" : "bg-fill/60"}`}
              >
                <h3 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-sm font-semibold">
                  <span className={`size-2 rounded-full ${STAGE_FILL[stage]}`} />
                  {t(APPLICATION_STATUS_LABELS[stage])}
                  {selecting && ids.length > 0 && (
                    <button type="button" onClick={() => selectColumn(ids)} className="text-xs font-medium text-ice hover:underline">
                      {allChosen ? t("Fjern alle") : t("Velg alle")}
                    </button>
                  )}
                  <span className="ml-auto rounded-full bg-fill px-2 text-xs font-medium tabular-nums text-mist">{items.length}</span>
                </h3>
                <ul className="flex flex-1 flex-col gap-2.5">
                  {items.map((a, i) => (
                    <motion.li
                      key={a.id}
                      layout={reduce ? false : "position"}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 8) * 0.035 }}
                    >
                      <ApplicantCard
                        a={a}
                        base={base}
                        showJob={showJob}
                        canManage={canManage && !selecting}
                        canHire={canHire && !selecting}
                        pending={pending}
                        selecting={selecting}
                        chosen={selected.includes(a.id)}
                        onChoose={() => toggleSelected(a.id)}
                        compared={compare.includes(a.candidate.id)}
                        onCompare={() => toggleCompare(a.candidate.id)}
                        onMove={(to) => move(a.id, to, a.candidate.name.split(" ")[0])}
                        onHire={() => setHiring(a)}
                        onDragStart={() => setDragging(a.id)}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                      />
                    </motion.li>
                  ))}
                  {items.length === 0 && <li className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-mist">{t("Ingen her ennå")}</li>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {withdrawn.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-mist">{t("Trukket ({n})", { n: withdrawn.length })}</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {withdrawn.map((a) => (
              <li key={a.id} className="inline-flex items-center gap-2 rounded-full bg-fill py-1 pl-1 pr-3 text-mist">
                <Avatar name={a.candidate.name} image={a.candidate.image} size={22} />
                {a.candidate.name} · {a.job.title}
              </li>
            ))}
          </ul>
        </details>
      )}

      {hiring && <HireDialog open onClose={() => setHiring(null)} applicationId={hiring.id} name={hiring.candidate.name} />}
      {selecting && <BulkBar companyId={companyId} selected={chosen} templates={templates} ctx={ctx} onClear={() => setSelected([])} />}
    </div>
  );
}

function ApplicantCard({
  a,
  base,
  showJob,
  canManage,
  canHire,
  pending,
  selecting,
  chosen,
  onChoose,
  compared,
  onCompare,
  onMove,
  onHire,
  onDragStart,
  onDragEnd,
}: {
  a: BoardApplicant;
  base: string;
  showJob: boolean;
  canManage: boolean;
  canHire: boolean;
  pending: boolean;
  selecting: boolean;
  chosen: boolean;
  onChoose: () => void;
  compared: boolean;
  onCompare: () => void;
  onMove: (to: ApplicationStage) => void;
  onHire: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [, startUndo] = useTransition();
  const index = APPLICATION_STAGES.indexOf(a.status);
  const prev = APPLICATION_STAGES[index - 1];
  const next = APPLICATION_STAGES[index + 1];
  const student = [a.candidate.studyProgram, a.candidate.graduationYear ? t("ferdig {year}", { year: a.candidate.graduationYear }) : null].filter(Boolean).join(", ");
  const unhire = () =>
    startUndo(async () => {
      const result = await unmarkHiredAction(a.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Ansatt-markeringen er fjernet");
      router.refresh();
    });

  return (
    <div
      draggable={canManage}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={selecting ? onChoose : undefined}
      className={`group relative rounded-2xl glass-card p-3 transition ${canManage ? "cursor-grab active:cursor-grabbing" : ""} ${selecting ? "cursor-pointer" : ""} ${chosen ? "ring-2 ring-sea" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={a.candidate.name} image={a.candidate.image} size={34} />
        <div className="min-w-0 flex-1">
          {selecting ? (
            <p className="truncate text-sm font-semibold">{a.candidate.name}</p>
          ) : (
            <Link href={`${base}/soker/${a.id}`} className="block truncate text-sm font-semibold hover:text-ice">
              {a.candidate.name}
            </Link>
          )}
          <p className="truncate text-xs text-mist">{a.candidate.headline ?? (student || `@${a.candidate.username}`)}</p>
        </div>
        {selecting ? (
          <span
            role="checkbox"
            aria-checked={chosen}
            aria-label={t("Velg {name}", { name: a.candidate.name })}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onChoose();
              }
            }}
            className={`flex size-5 shrink-0 items-center justify-center rounded-md transition ${chosen ? "bg-sea text-on-primary" : "bg-fill ring-1 ring-line"}`}
          >
            {chosen && <Check className="size-3.5" />}
          </span>
        ) : (
          canManage && <GripVertical className="size-4 shrink-0 text-mist/50 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        )}
      </div>

      {a.highlights.length > 0 && (
        <Link
          href={`${base}/soker/${a.id}`}
          onClick={selecting ? (e) => e.preventDefault() : undefined}
          className="mt-2.5 grid grid-cols-3 gap-1"
          aria-label={t("Se prosjektene til {name}", { name: a.candidate.name })}
        >
          {a.highlights.slice(0, 3).map((p) => (
            <span key={p.id} className="block aspect-[4/3] overflow-hidden rounded-lg bg-fill-2" title={p.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.cover && <img src={p.cover} alt="" className="size-full object-cover" />}
            </span>
          ))}
        </Link>
      )}

      <UsedTech tech={a.usedTech} max={4} className="mt-2" />

      {(a.hiredAt || a.interviewAt || a.status === "ny" || a.status === "intervju") && (
        <p className="mt-2 flex flex-wrap gap-1">
          {a.hiredAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
              <BadgeCheck className="size-3" /> {t("Ansatt")}
            </span>
          )}
          {a.interviewAt && (
            <span suppressHydrationWarning className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_TONE.intervju}`}>
              <CalendarCheck className="size-3" /> {t("Booket {time}", { time: formatInterview(a.interviewAt, locale) })}
            </span>
          )}
          {!a.interviewAt && <AgeChip status={a.status} since={a.statusChangedAt} />}
        </p>
      )}

      <p className="mt-2 truncate text-[11px] text-mist" suppressHydrationWarning>
        {showJob ? `${a.job.title} · ` : ""}
        {timeAgo(a.createdAt, locale)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="flex items-center gap-2.5">
          {!selecting && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-mist">
              <input type="checkbox" checked={compared} onChange={onCompare} className="accent-[var(--sea)]" /> {t("Sammenlign")}
            </label>
          )}
          {a.noteCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-mist" title={t("{n} notater", { n: a.noteCount })}>
              <MessageSquare className="size-3" aria-hidden="true" /> {a.noteCount}
              <span className="sr-only">{t("notater")}</span>
            </span>
          )}
          {a.reviewCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-mist" title={t("{n} vurderinger", { n: a.reviewCount })}>
              <ClipboardCheck className="size-3" aria-hidden="true" /> {a.reviewCount}
              <span className="sr-only">{t("vurderinger")}</span>
            </span>
          )}
        </span>
        <span className="flex gap-1">
          {canHire && a.status === "tilbud" && (
            <Menu
              label={t("Mer")}
              trigger={({ open, toggle, id }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-controls={id}
                  aria-label={t("Mer for {name}", { name: a.candidate.name })}
                  className="flex size-6 items-center justify-center rounded-full bg-fill text-mist hover:text-fg"
                >
                  <Ellipsis className="size-3.5" />
                </button>
              )}
            >
              {a.hiredAt ? (
                <MenuItem icon={<Undo2 className="size-4" />} onSelect={unhire}>
                  {t("Fjern ansatt-markeringen")}
                </MenuItem>
              ) : (
                <MenuItem icon={<PartyPopper className="size-4" />} onSelect={onHire}>
                  {t("Marker som ansatt")}
                </MenuItem>
              )}
            </Menu>
          )}
          {canManage && prev && (
            <button type="button" disabled={pending} onClick={() => onMove(prev)} aria-label={t("Flytt til {status}", { status: t(APPLICATION_STATUS_LABELS[prev]) })} className="flex size-6 items-center justify-center rounded-full bg-fill text-mist hover:text-fg">
              <ChevronLeft className="size-3.5" />
            </button>
          )}
          {canManage && next && (
            <button type="button" disabled={pending} onClick={() => onMove(next)} aria-label={t("Flytt til {status}", { status: t(APPLICATION_STATUS_LABELS[next]) })} className="flex size-6 items-center justify-center rounded-full bg-fill text-mist hover:text-fg">
              <ChevronRight className="size-3.5" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

// Statusknappene på søkersiden. Flytt til Intervju, Tilbud eller Avslag åpner meldingen som
// sendes, med valg av mal og forhåndsvisning; tilbake til Ny skjer uten melding.
export function StageButtons({
  id,
  status,
  name,
  jobTitle,
  templates,
  ctx,
}: {
  id: string;
  status: ApplicationStatus;
  name: string;
  jobTitle: string;
  templates: TemplateOption[];
  ctx: { companyName: string; responseDays: number; bookingUrl: string | null };
}) {
  const t = useT();
  const { pending, move } = useMove();
  const [target, setTarget] = useState<ApplicationStage | null>(null);
  const [templateId, setTemplateId] = useState("");
  if (status === "trukket") return <p className="text-sm text-mist">{t("Kandidaten har trukket søknaden.")}</p>;
  const first = name.split(" ")[0];
  const kind = target ? STAGE_KIND[target] : undefined;
  const label = target ? t(APPLICATION_STATUS_LABELS[target]) : "";

  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Status")}>
        {APPLICATION_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            disabled={pending || status === s}
            onClick={() => {
              if (!STAGE_KIND[s]) return move(id, s, first);
              setTemplateId("");
              setTarget(s);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${status === s ? "bg-primary text-on-primary" : "glass-chip hover:bg-fill-2"}`}
          >
            <span className={`size-1.5 rounded-full ${STAGE_FILL[s]}`} aria-hidden="true" />
            {t(APPLICATION_STATUS_LABELS[s])}
          </button>
        ))}
      </div>

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={t("Flytt {name} til {status}", { name: first, status: label })}
        description={t("{name} får varsel i appen og meldingen under på e-post.", { name: first })}
      >
        <div className="space-y-5">
          {kind && (
            <MessagePicker
              templates={templates}
              kind={kind}
              value={templateId}
              onChange={setTemplateId}
              vars={templateVars({ name, jobTitle, companyName: ctx.companyName, responseDays: ctx.responseDays, bookingUrl: target === "intervju" ? ctx.bookingUrl : null })}
            />
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setTarget(null)}>
              {t("Avbryt")}
            </Button>
            <Button
              variant={target === "avslag" ? "danger" : "primary"}
              loading={pending}
              onClick={() => target && move(id, target, first, templateId || null, () => setTarget(null))}
            >
              {target === "avslag" ? t("Avslå og send") : t("Flytt og send")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
