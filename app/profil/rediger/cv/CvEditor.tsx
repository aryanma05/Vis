"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Briefcase, ChevronDown, GraduationCap, GripVertical, Plus, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";
import { formatPeriod } from "@/lib/format";
import MonthYear from "@/components/ui/month-year";

export type Experience = {
  key: string;
  title: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

export type Education = {
  key: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
};

export type CvState = { experience: Experience[]; education: Education[]; skills: string[] };

export const newKey = () => Math.random().toString(36).slice(2);

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Liste som kan sorteres ved å dra i håndtaket, eller med pilknappene (tastatur).
function useDrag<T>(list: T[], onReorder: (next: T[]) => void) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const props = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragging(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== i) setOver(i);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging !== null) onReorder(move(list, dragging, i));
      setDragging(null);
      setOver(null);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });
  return { props, dragging, over };
}

function EntryShell({
  summary,
  period,
  open,
  onToggle,
  onUp,
  onDown,
  onRemove,
  dragProps,
  highlight,
  faded,
  children,
}: {
  summary: string;
  period: string | null;
  open: boolean;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  dragProps: ReturnType<ReturnType<typeof useDrag>["props"]>;
  highlight: boolean;
  faded: boolean;
  children: React.ReactNode;
}) {
  // Bare håndtaket starter dra-og-slipp, så man fortsatt kan markere tekst i feltene.
  const [armed, setArmed] = useState(false);
  return (
    <li
      {...dragProps}
      draggable={armed}
      onPointerUp={() => setArmed(false)}
      onDragEnd={() => {
        dragProps.onDragEnd();
        setArmed(false);
      }}
      className={`rounded-2xl border bg-surface/40 transition ${highlight ? "border-ice/70" : "border-line"} ${faded ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <span onPointerDown={() => setArmed(true)} className="cursor-grab touch-none p-1 text-mist/60 hover:text-fg active:cursor-grabbing" title="Dra for å flytte" aria-hidden="true">
          <GripVertical className="size-4" />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate font-medium">{summary || "Ny oppføring"}</span>
          {period && <span className="block font-mono text-xs text-mist/80">{period}</span>}
        </button>
        <div className="flex shrink-0 items-center text-mist">
          <button type="button" onClick={onUp} aria-label="Flytt opp" className="rounded-lg p-1.5 hover:bg-surface-2 hover:text-fg">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" onClick={onDown} aria-label="Flytt ned" className="rounded-lg p-1.5 hover:bg-surface-2 hover:text-fg">
            <ArrowDown className="size-4" />
          </button>
          <button type="button" onClick={onToggle} aria-label={open ? "Lukk" : "Rediger"} className="rounded-lg p-1.5 hover:bg-surface-2 hover:text-fg">
            <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
          </button>
          <button type="button" onClick={onRemove} aria-label="Fjern" className="rounded-lg p-1.5 hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {open && <div className="border-t border-line px-4 pb-5 pt-4">{children}</div>}
    </li>
  );
}

function PeriodFields({
  start,
  end,
  current,
  onChange,
  currentLabel,
}: {
  start: string;
  end: string;
  current: boolean;
  onChange: (patch: { startDate?: string; endDate?: string; current?: boolean }) => void;
  currentLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 md:col-span-2">
      <div>
        <span className="mb-2 block text-sm font-medium">Fra</span>
        <MonthYear label="Fra" value={start} onChange={(v) => onChange({ startDate: v })} />
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium">Til</span>
        <MonthYear label="Til" value={current ? "" : end} disabled={current} onChange={(v) => onChange({ endDate: v })} />
      </div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm text-mist">
        <input
          type="checkbox"
          checked={current}
          onChange={(e) => onChange({ current: e.target.checked, endDate: e.target.checked ? "" : end })}
          className="size-4 accent-[var(--ice)]"
        />
        {currentLabel}
      </label>
    </div>
  );
}

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...skills];
    for (const name of names) if (!next.some((s) => s.toLowerCase() === name.toLowerCase())) next.push(name.slice(0, 60));
    onChange(next.slice(0, 60));
    setDraft("");
  };

  return (
    <div className="rounded-2xl border border-line bg-ink-2/50 p-2 transition focus-within:border-ice/60 focus-within:ring-4 focus-within:ring-ice/10">
      <ul className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <li key={s} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface py-1 pl-2.5 pr-1 text-sm">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} aria-label={`Fjern ${s}`} className="rounded-md p-0.5 text-mist hover:text-danger">
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        <li className="min-w-40 flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
                e.preventDefault();
                add(draft);
              }
              if (e.key === "Backspace" && !draft && skills.length) onChange(skills.slice(0, -1));
            }}
            onBlur={() => draft.trim() && add(draft)}
            placeholder={skills.length ? "Legg til …" : "F.eks. React, Figma, SQL – trykk Enter"}
            aria-label="Legg til ferdighet"
            className="w-full bg-transparent px-2 py-1 text-sm text-fg outline-none placeholder:text-mist/45"
          />
        </li>
      </ul>
    </div>
  );
}

export default function CvEditor({ value, onChange }: { value: CvState; onChange: (next: CvState) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const setExp = (i: number, patch: Partial<Experience>) =>
    onChange({ ...value, experience: value.experience.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const setEdu = (i: number, patch: Partial<Education>) =>
    onChange({ ...value, education: value.education.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const expDrag = useDrag(value.experience, (experience) => onChange({ ...value, experience }));
  const eduDrag = useDrag(value.education, (education) => onChange({ ...value, education }));

  const addExperience = () => {
    const key = newKey();
    onChange({
      ...value,
      experience: [{ key, title: "", organization: "", location: "", startDate: "", endDate: "", current: false, description: "" }, ...value.experience],
    });
    setOpen((s) => new Set(s).add(key));
  };
  const addEducation = () => {
    const key = newKey();
    onChange({
      ...value,
      education: [{ key, institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", current: false, description: "" }, ...value.education],
    });
    setOpen((s) => new Set(s).add(key));
  };

  const heading = (Icon: typeof Briefcase, title: string, onAdd?: () => void, addLabel?: string) => (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h3 className="flex items-center gap-2 font-semibold tracking-tight">
        <Icon className="size-4 text-ice" aria-hidden="true" /> {title}
      </h3>
      {onAdd && (
        <Button variant="secondary" size="xs" onClick={onAdd}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-12">
      <div>
        {heading(Briefcase, "Erfaring", addExperience, "Legg til")}
        {value.experience.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-mist">Ingen erfaring lagt til ennå.</p>}
        <ul className="space-y-2.5">
          {value.experience.map((e, i) => (
            <EntryShell
              key={e.key}
              summary={[e.title, e.organization].filter(Boolean).join(" · ")}
              period={formatPeriod(e.startDate || null, e.current ? null : e.endDate || null)}
              open={open.has(e.key)}
              onToggle={() => toggle(e.key)}
              onUp={() => onChange({ ...value, experience: move(value.experience, i, i - 1) })}
              onDown={() => onChange({ ...value, experience: move(value.experience, i, i + 1) })}
              onRemove={() => onChange({ ...value, experience: value.experience.filter((_, j) => j !== i) })}
              dragProps={expDrag.props(i)}
              highlight={expDrag.over === i && expDrag.dragging !== i}
              faded={expDrag.dragging === i}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Rolle">
                  <input className={inputClass} value={e.title} onChange={(ev) => setExp(i, { title: ev.target.value })} placeholder="Frontend-utvikler" />
                </Field>
                <Field label="Arbeidsgiver">
                  <input className={inputClass} value={e.organization} onChange={(ev) => setExp(i, { organization: ev.target.value })} placeholder="Finn.no" />
                </Field>
                <Field label="Sted" optional>
                  <input className={inputClass} value={e.location} onChange={(ev) => setExp(i, { location: ev.target.value })} placeholder="Oslo" />
                </Field>
                <div className="hidden md:block" />
                <PeriodFields start={e.startDate} end={e.endDate} current={e.current} currentLabel="Jobber her nå" onChange={(patch) => setExp(i, patch)} />
                <Field label="Hva gjorde du?" optional hint="Én linje per punkt: ansvar, resultater, teknologier." className="md:col-span-2">
                  <textarea className={textareaClass} value={e.description} onChange={(ev) => setExp(i, { description: ev.target.value })} />
                </Field>
              </div>
            </EntryShell>
          ))}
        </ul>
      </div>

      <div>
        {heading(GraduationCap, "Utdanning", addEducation, "Legg til")}
        {value.education.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-mist">Ingen utdanning lagt til ennå.</p>}
        <ul className="space-y-2.5">
          {value.education.map((e, i) => (
            <EntryShell
              key={e.key}
              summary={[e.institution, e.degree].filter(Boolean).join(" · ")}
              period={formatPeriod(e.startDate || null, e.current ? null : e.endDate || null)}
              open={open.has(e.key)}
              onToggle={() => toggle(e.key)}
              onUp={() => onChange({ ...value, education: move(value.education, i, i - 1) })}
              onDown={() => onChange({ ...value, education: move(value.education, i, i + 1) })}
              onRemove={() => onChange({ ...value, education: value.education.filter((_, j) => j !== i) })}
              dragProps={eduDrag.props(i)}
              highlight={eduDrag.over === i && eduDrag.dragging !== i}
              faded={eduDrag.dragging === i}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Skole" className="md:col-span-2">
                  <input className={inputClass} value={e.institution} onChange={(ev) => setEdu(i, { institution: ev.target.value })} placeholder="Universitetet i Oslo" />
                </Field>
                <Field label="Grad" optional>
                  <input className={inputClass} value={e.degree} onChange={(ev) => setEdu(i, { degree: ev.target.value })} placeholder="Bachelor" />
                </Field>
                <Field label="Fag" optional>
                  <input className={inputClass} value={e.fieldOfStudy} onChange={(ev) => setEdu(i, { fieldOfStudy: ev.target.value })} placeholder="Informatikk" />
                </Field>
                <PeriodFields start={e.startDate} end={e.endDate} current={e.current} currentLabel="Studerer her nå" onChange={(patch) => setEdu(i, patch)} />
                <Field label="Beskrivelse" optional className="md:col-span-2">
                  <textarea className={`${textareaClass} min-h-24`} value={e.description} onChange={(ev) => setEdu(i, { description: ev.target.value })} placeholder="Fordypning, oppgaver, verv." />
                </Field>
              </div>
            </EntryShell>
          ))}
        </ul>
      </div>

      <div>
        {heading(Wrench, "Ferdigheter")}
        <SkillsInput skills={value.skills} onChange={(skills) => onChange({ ...value, skills })} />
      </div>
    </div>
  );
}
