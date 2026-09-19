"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/form";
import { formatPeriod } from "@/lib/format";
import MonthYear from "./MonthYear";

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
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function EntryShell({
  summary,
  period,
  open,
  onToggle,
  onUp,
  onDown,
  onRemove,
  children,
}: {
  summary: string;
  period: string | null;
  open: boolean;
  onToggle: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface/30">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate font-medium">{summary || "Ny oppføring"}</span>
          {period && <span className="block font-mono text-xs text-mist/70">{period}</span>}
        </button>
        <div className="flex shrink-0 items-center text-mist">
          <button type="button" onClick={onUp} aria-label="Flytt opp" className="rounded px-2 py-1 hover:bg-white/5 hover:text-white">
            ↑
          </button>
          <button type="button" onClick={onDown} aria-label="Flytt ned" className="rounded px-2 py-1 hover:bg-white/5 hover:text-white">
            ↓
          </button>
          <button type="button" onClick={onToggle} className="rounded px-2 py-1 text-sm hover:bg-white/5 hover:text-white">
            {open ? "Lukk" : "Rediger"}
          </button>
          <button type="button" onClick={onRemove} aria-label="Fjern" className="rounded px-2 py-1 hover:bg-white/5 hover:text-red-300">
            ×
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
        <span className="mb-1.5 block text-sm font-medium">Fra</span>
        <MonthYear label="Fra" value={start} onChange={(v) => onChange({ startDate: v })} />
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium">Til</span>
        <MonthYear label="Til" value={current ? "" : end} disabled={current} onChange={(v) => onChange({ endDate: v })} />
      </div>
      <label className="mb-2.5 inline-flex items-center gap-2 text-sm text-mist">
        <input
          type="checkbox"
          checked={current}
          onChange={(e) => onChange({ current: e.target.checked, endDate: e.target.checked ? "" : end })}
          className="h-4 w-4 accent-[#C7F9FF]"
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
    <div className="rounded-xl border border-line bg-ink p-2 focus-within:border-ice">
      <ul className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface/60 py-1 pl-2.5 pr-1 text-sm">
            {s}
            <button
              type="button"
              onClick={() => onChange(skills.filter((x) => x !== s))}
              aria-label={`Fjern ${s}`}
              className="rounded px-1 text-mist hover:text-red-300"
            >
              ×
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
            placeholder={skills.length ? "Legg til…" : "F.eks. React, Figma, SQL – trykk Enter"}
            className="w-full bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-mist/40"
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

  const addExperience = () => {
    const key = newKey();
    onChange({
      ...value,
      experience: [
        { key, title: "", organization: "", location: "", startDate: "", endDate: "", current: false, description: "" },
        ...value.experience,
      ],
    });
    setOpen((s) => new Set(s).add(key));
  };
  const addEducation = () => {
    const key = newKey();
    onChange({
      ...value,
      education: [
        { key, institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "", current: false, description: "" },
        ...value.education,
      ],
    });
    setOpen((s) => new Set(s).add(key));
  };

  const heading = (title: string, onAdd?: () => void, addLabel?: string) => (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mist/70">{title}</h3>
      {onAdd && (
        <button type="button" onClick={onAdd} className="text-sm text-ice hover:underline">
          + {addLabel}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-12">
      <div>
        {heading("Erfaring", addExperience, "Legg til erfaring")}
        {value.experience.length === 0 && <p className="text-sm text-mist/70">Ingen erfaring lagt til ennå.</p>}
        <ul className="space-y-3">
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
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Rolle">
                  <input className={inputClass} value={e.title} onChange={(ev) => setExp(i, { title: ev.target.value })} placeholder="Frontend-utvikler" />
                </Field>
                <Field label="Arbeidsgiver">
                  <input className={inputClass} value={e.organization} onChange={(ev) => setExp(i, { organization: ev.target.value })} placeholder="Finn.no" />
                </Field>
                <Field label="Sted">
                  <input className={inputClass} value={e.location} onChange={(ev) => setExp(i, { location: ev.target.value })} placeholder="Oslo" />
                </Field>
                <div className="hidden md:block" />
                <PeriodFields
                  start={e.startDate}
                  end={e.endDate}
                  current={e.current}
                  currentLabel="Jobber her nå"
                  onChange={(patch) => setExp(i, patch)}
                />
                <Field label="Hva gjorde du?" className="md:col-span-2">
                  <textarea
                    className={`${inputClass} min-h-28 resize-y leading-6`}
                    value={e.description}
                    onChange={(ev) => setExp(i, { description: ev.target.value })}
                    placeholder="Én linje per punkt: ansvar, resultater, teknologier."
                  />
                </Field>
              </div>
            </EntryShell>
          ))}
        </ul>
      </div>

      <div>
        {heading("Utdanning", addEducation, "Legg til utdanning")}
        {value.education.length === 0 && <p className="text-sm text-mist/70">Ingen utdanning lagt til ennå.</p>}
        <ul className="space-y-3">
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
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Skole" className="md:col-span-2">
                  <input className={inputClass} value={e.institution} onChange={(ev) => setEdu(i, { institution: ev.target.value })} placeholder="Universitetet i Oslo" />
                </Field>
                <Field label="Grad">
                  <input className={inputClass} value={e.degree} onChange={(ev) => setEdu(i, { degree: ev.target.value })} placeholder="Bachelor" />
                </Field>
                <Field label="Fag">
                  <input className={inputClass} value={e.fieldOfStudy} onChange={(ev) => setEdu(i, { fieldOfStudy: ev.target.value })} placeholder="Informatikk" />
                </Field>
                <PeriodFields
                  start={e.startDate}
                  end={e.endDate}
                  current={e.current}
                  currentLabel="Studerer her nå"
                  onChange={(patch) => setEdu(i, patch)}
                />
                <Field label="Beskrivelse" className="md:col-span-2">
                  <textarea
                    className={`${inputClass} min-h-24 resize-y leading-6`}
                    value={e.description}
                    onChange={(ev) => setEdu(i, { description: ev.target.value })}
                    placeholder="Fordypning, oppgaver, verv."
                  />
                </Field>
              </div>
            </EntryShell>
          ))}
        </ul>
      </div>

      <div>
        {heading("Ferdigheter")}
        <SkillsInput skills={value.skills} onChange={(skills) => onChange({ ...value, skills })} />
      </div>
    </div>
  );
}
