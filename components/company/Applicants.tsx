"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Columns3, GripVertical } from "lucide-react";
import { setApplicationNoteAction, setApplicationStatusAction } from "@/app/actions/applications";
import Avatar from "@/components/Avatar";
import { useLocale, useT } from "@/components/LocaleProvider";
import { Button, ButtonLink } from "@/components/ui/button";
import { textareaClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";
import { APPLICATION_STAGES, APPLICATION_STATUS_LABELS, type ApplicationStage, type ApplicationStatus } from "@/lib/constants";

export type BoardApplicant = {
  id: string;
  status: ApplicationStatus;
  createdAt: Date | string;
  job: { id: string; title: string };
  candidate: { id: string; name: string; username: string; image: string | null; headline: string | null; location: string | null; studyProgram: string | null; graduationYear: number | null };
  usedTech: { name: string; n: number }[];
  highlights: { id: string; title: string; cover: string | null }[];
};

const COLUMN_TONE: Record<ApplicationStage, string> = {
  ny: "bg-sea",
  intervju: "bg-[#b197fc]",
  tilbud: "bg-success",
  avslag: "bg-mist/50",
};

const MAX_COMPARE = 4;

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

function useMove() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const move = (id: string, status: ApplicationStage, name?: string) =>
    start(async () => {
      const result = await setApplicationStatusAction(id, status);
      if (!result.ok) return void toast.error(result.error);
      const label = t(APPLICATION_STATUS_LABELS[status]);
      toast.success(name ? t("{name} er flyttet til {status}", { name, status: label }) : t("Flyttet til {status}", { status: label }), {
        description: status !== "ny" ? t("Kandidaten har fått beskjed.") : undefined,
      });
      router.refresh();
    });
  return { pending, move };
}

// Søkeroversikten: Ny → Intervju → Tilbud → Avslag. Dra kortene mellom kolonnene, eller
// bruk pilene. Kandidaten får varsel og e-post når kortet flyttes (unntatt tilbake til Ny).
export function ApplicantBoard({ applicants, base, canManage, showJob }: { applicants: BoardApplicant[]; base: string; canManage: boolean; showJob: boolean }) {
  const t = useT();
  const { pending, move } = useMove();
  const [compare, setCompare] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<ApplicationStage | null>(null);

  const columns = useMemo(
    () => APPLICATION_STAGES.map((stage) => ({ stage, items: applicants.filter((a) => a.status === stage) })),
    [applicants],
  );
  const withdrawn = applicants.filter((a) => a.status === "trukket");
  const toggleCompare = (userId: string) =>
    setCompare((list) => (list.includes(userId) ? list.filter((x) => x !== userId) : list.length >= MAX_COMPARE ? list : [...list, userId]));

  return (
    <div>
      <div className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">
          {canManage ? t("Dra kortene mellom kolonnene. Kandidaten får beskjed automatisk.") : t("Søkerne kommer inn her. Med Bedrift kan dere flytte dem videre, og de får beskjed automatisk.")}
        </p>
        {compare.length > 0 && (
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

      <div className="-mx-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[900px] grid-cols-4 gap-3">
          {columns.map(({ stage, items }) => (
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
                if (card && card.status !== stage) move(id, stage, card.candidate.name.split(" ")[0]);
                setDragging(null);
              }}
              className={`flex min-h-64 flex-col rounded-[22px] p-2.5 transition ${over === stage ? "bg-sea/10 ring-2 ring-sea/50" : "bg-fill/60"}`}
            >
              <h3 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-sm font-semibold">
                <span className={`size-2 rounded-full ${COLUMN_TONE[stage]}`} />
                {t(APPLICATION_STATUS_LABELS[stage])}
                <span className="ml-auto rounded-full bg-fill px-2 text-xs font-medium text-mist">{items.length}</span>
              </h3>
              <ul className="flex flex-1 flex-col gap-2.5">
                {items.map((a) => (
                  <ApplicantCard
                    key={a.id}
                    a={a}
                    base={base}
                    showJob={showJob}
                    canManage={canManage}
                    pending={pending}
                    compared={compare.includes(a.candidate.id)}
                    onCompare={() => toggleCompare(a.candidate.id)}
                    onMove={(to) => move(a.id, to, a.candidate.name.split(" ")[0])}
                    onDragStart={() => setDragging(a.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                ))}
                {items.length === 0 && <li className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-mist">{t("Ingen her ennå")}</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {withdrawn.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-mist">{t("Trukket ({n})", { n: withdrawn.length })}</summary>
          <ul className="mt-2 space-y-1">
            {withdrawn.map((a) => (
              <li key={a.id} className="text-mist">
                {a.candidate.name} · {a.job.title}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ApplicantCard({
  a,
  base,
  showJob,
  canManage,
  pending,
  compared,
  onCompare,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  a: BoardApplicant;
  base: string;
  showJob: boolean;
  canManage: boolean;
  pending: boolean;
  compared: boolean;
  onCompare: () => void;
  onMove: (to: ApplicationStage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const index = APPLICATION_STAGES.indexOf(a.status as ApplicationStage);
  const prev = APPLICATION_STAGES[index - 1];
  const next = APPLICATION_STAGES[index + 1];
  const student = [a.candidate.studyProgram, a.candidate.graduationYear ? t("ferdig {year}", { year: a.candidate.graduationYear }) : null].filter(Boolean).join(", ");
  return (
    <li
      draggable={canManage}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-2xl glass-card p-3 ${canManage ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={a.candidate.name} image={a.candidate.image} size={34} />
        <div className="min-w-0 flex-1">
          <Link href={`${base}/soker/${a.id}`} className="block truncate text-sm font-semibold hover:text-ice">
            {a.candidate.name}
          </Link>
          <p className="truncate text-xs text-mist">{a.candidate.headline ?? (student || `@${a.candidate.username}`)}</p>
        </div>
        {canManage && <GripVertical className="size-4 shrink-0 text-mist/50 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />}
      </div>

      {a.highlights.length > 0 && (
        <Link href={`${base}/soker/${a.id}`} className="mt-2.5 grid grid-cols-3 gap-1" aria-label={t("Se prosjektene til {name}", { name: a.candidate.name })}>
          {a.highlights.slice(0, 3).map((p) => (
            <span key={p.id} className="block aspect-[4/3] overflow-hidden rounded-lg bg-fill-2" title={p.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.cover && <img src={p.cover} alt="" className="size-full object-cover" />}
            </span>
          ))}
        </Link>
      )}

      <UsedTech tech={a.usedTech} max={4} className="mt-2" />

      <p className="mt-2 truncate text-[11px] text-mist" suppressHydrationWarning>
        {showJob ? `${a.job.title} · ` : ""}
        {timeAgo(a.createdAt, locale)}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-mist">
          <input type="checkbox" checked={compared} onChange={onCompare} className="accent-[var(--sea)]" /> {t("Sammenlign")}
        </label>
        {canManage && (
          <span className="flex gap-1">
            {prev && (
              <button type="button" disabled={pending} onClick={() => onMove(prev)} aria-label={t("Flytt til {status}", { status: t(APPLICATION_STATUS_LABELS[prev]) })} className="flex size-6 items-center justify-center rounded-full bg-fill text-mist hover:text-fg">
                <ChevronLeft className="size-3.5" />
              </button>
            )}
            {next && (
              <button type="button" disabled={pending} onClick={() => onMove(next)} aria-label={t("Flytt til {status}", { status: t(APPLICATION_STATUS_LABELS[next]) })} className="flex size-6 items-center justify-center rounded-full bg-fill text-mist hover:text-fg">
                <ChevronRight className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

// Statusknappene på detaljsiden til en søker.
export function StageButtons({ id, status, name }: { id: string; status: ApplicationStatus; name: string }) {
  const t = useT();
  const { pending, move } = useMove();
  if (status === "trukket") return <p className="text-sm text-mist">{t("Kandidaten har trukket søknaden.")}</p>;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Status")}>
      {APPLICATION_STAGES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={status === s}
          disabled={pending || status === s}
          onClick={() => move(id, s, name.split(" ")[0])}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${status === s ? "bg-primary text-on-primary" : "glass-chip hover:bg-fill-2"}`}
        >
          {t(APPLICATION_STATUS_LABELS[s])}
        </button>
      ))}
    </div>
  );
}

// Internt notat om søkeren. Kandidaten ser det aldri.
export function ApplicantNote({ id, initial }: { id: string; initial: string | null }) {
  const t = useT();
  const [note, setNote] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [pending, start] = useTransition();
  return (
    <div>
      <textarea className={`${textareaClass} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder={t("F.eks. «Sterk på React, spør om testing i intervjuet»")} aria-label={t("Notat")} />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-mist">{t("Bare dere i bedriften ser notatet.")}</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={note === saved}
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await setApplicationNoteAction(id, note);
              if (!result.ok) return void toast.error(result.error);
              setSaved(note);
              toast.success(t("Notatet er lagret"));
            })
          }
        >
          {t("Lagre notat")}
        </Button>
      </div>
    </div>
  );
}
