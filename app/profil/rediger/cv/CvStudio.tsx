"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, FileUp, Printer, Sparkles } from "lucide-react";
import { applyCvImportAction, importCvAction, parseStoredCvAction, saveCvAction } from "@/app/actions/cv";
import { setCvTemplateAction } from "@/app/actions/profile";
import { Button, ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { CV_TEMPLATE_LABELS, CV_TEMPLATES, type CvTemplate } from "@/lib/constants";
import type { Cv } from "@/lib/cv";
import type { ParsedCv } from "@/lib/validation";
import CvDocumentPanel, { type DocState } from "./CvDocumentPanel";
import CvEditor, { newKey, type CvState } from "./CvEditor";

const s = (v: string | null | undefined) => v ?? "";
const n = (v: string) => v.trim() || null;

function fromSaved(cv: Cv): CvState {
  return {
    experience: cv.experience.map((e) => ({
      key: e.id,
      title: e.title,
      organization: e.organization,
      location: s(e.location),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
      current: Boolean(e.startDate) && !e.endDate,
      description: s(e.description),
    })),
    education: cv.education.map((e) => ({
      key: e.id,
      institution: e.institution,
      degree: s(e.degree),
      fieldOfStudy: s(e.fieldOfStudy),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
      current: Boolean(e.startDate) && !e.endDate,
      description: s(e.description),
    })),
    skills: cv.skills,
  };
}

function fromParsed(cv: ParsedCv): CvState {
  return {
    experience: cv.experience.map((e) => ({
      key: newKey(),
      title: e.title,
      organization: e.organization,
      location: s(e.location),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
      current: Boolean(e.startDate) && !e.endDate,
      description: s(e.description),
    })),
    education: cv.education.map((e) => ({
      key: newKey(),
      institution: e.institution,
      degree: s(e.degree),
      fieldOfStudy: s(e.fieldOfStudy),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
      current: Boolean(e.startDate) && !e.endDate,
      description: s(e.description),
    })),
    skills: cv.skills,
  };
}

function toPayload(state: CvState) {
  return {
    experience: state.experience
      .filter((e) => e.title.trim() || e.organization.trim())
      .map((e) => ({
        title: e.title.trim(),
        organization: e.organization.trim(),
        location: n(e.location),
        startDate: n(e.startDate),
        endDate: e.current ? null : n(e.endDate),
        description: n(e.description),
      })),
    education: state.education
      .filter((e) => e.institution.trim() || e.degree.trim())
      .map((e) => ({
        institution: e.institution.trim(),
        degree: n(e.degree),
        fieldOfStudy: n(e.fieldOfStudy),
        startDate: n(e.startDate),
        endDate: e.current ? null : n(e.endDate),
        description: n(e.description),
      })),
    skills: state.skills,
  };
}

// Miniatyr av hver mal, så man ser forskjellen før man velger.
function TemplateThumb({ template }: { template: CvTemplate }) {
  const line = (w: string, dark = false) => <span className={`block h-1 rounded-full ${dark ? "bg-[#0f172a]" : "bg-[#cbd5e1]"}`} style={{ width: w }} />;
  if (template === "moderne") {
    return (
      <span className="grid h-full grid-cols-[34%_1fr] bg-white">
        <span className="space-y-1 bg-[#dff7fb] p-2">
          {line("80%", true)}
          {line("60%")}
          {line("70%")}
          {line("50%")}
        </span>
        <span className="space-y-1.5 p-2">
          {line("40%", true)}
          {line("90%")}
          {line("80%")}
          {line("40%", true)}
          {line("85%")}
          {line("70%")}
        </span>
      </span>
    );
  }
  if (template === "kompakt") {
    return (
      <span className="block h-full space-y-1.5 bg-white p-2">
        {line("60%", true)}
        <span className="block h-px bg-[#0f172a]" />
        <span className="grid grid-cols-[1.3fr_1fr] gap-2">
          <span className="space-y-1">
            {line("90%")}
            {line("80%")}
            {line("85%")}
            {line("70%")}
          </span>
          <span className="space-y-1">
            {line("80%")}
            {line("60%")}
            {line("70%")}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="block h-full space-y-1.5 bg-white p-2.5">
      {line("70%", true)}
      {line("45%")}
      <span className="block h-px bg-[#e2e8f0]" />
      <span className="grid grid-cols-[25%_1fr] gap-1.5">
        {line("80%")}
        <span className="space-y-1">
          {line("90%")}
          {line("75%")}
        </span>
      </span>
      <span className="grid grid-cols-[25%_1fr] gap-1.5">
        {line("70%")}
        <span className="space-y-1">
          {line("85%")}
          {line("60%")}
        </span>
      </span>
    </span>
  );
}

type Pending = { importId: string; parsed: ParsedCv };

export default function CvStudio({
  cv,
  doc,
  username,
  template: initialTemplate,
  canParse,
}: {
  cv: Cv;
  doc: DocState;
  username: string;
  template: CvTemplate;
  canParse: boolean;
}) {
  const router = useRouter();
  const initial = useRef(fromSaved(cv));
  const [state, setState] = useState<CvState>(initial.current);
  const [draft, setDraft] = useState<Pending | null>(null);
  const [applied, setApplied] = useState<Pending | null>(null);
  const [autofilling, setAutofilling] = useState(false);
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, startSaving] = useTransition();
  const docxRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(toPayload(state)) !== JSON.stringify(toPayload(initial.current));
  const isEmpty = state.experience.length + state.education.length + state.skills.length === 0;

  async function readCv(run: () => ReturnType<typeof parseStoredCvAction>) {
    setAutofilling(true);
    const result = await run();
    setAutofilling(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const pending = { importId: result.data.importId, parsed: result.data.result };
    if (isEmpty) applyDraft(pending, "replace");
    else setDraft(pending);
  }

  function applyDraft(pending: Pending, mode: "replace" | "merge") {
    const incoming = fromParsed(pending.parsed);
    setState((current) =>
      mode === "replace"
        ? incoming
        : {
            experience: [...current.experience, ...incoming.experience],
            education: [...current.education, ...incoming.education],
            skills: [...current.skills, ...incoming.skills.filter((x) => !current.skills.some((y) => y.toLowerCase() === x.toLowerCase()))],
          },
    );
    setApplied(pending);
    setDraft(null);
    toast.success("Feltene er fylt ut", { description: "Se over og trykk «Lagre CV»." });
  }

  async function chooseTemplate(next: CvTemplate) {
    const previous = template;
    setTemplate(next);
    const result = await setCvTemplateAction(next);
    if (!result.ok) {
      setTemplate(previous);
      toast.error(result.error);
      return;
    }
    toast.success(`${CV_TEMPLATE_LABELS[next].name} er valgt`);
  }

  const save = () =>
    startSaving(async () => {
      const payload = toPayload(state);
      const missing = payload.experience.some((e) => !e.title || !e.organization) || payload.education.some((e) => !e.institution);
      if (missing) {
        toast.error("Alle erfaringer trenger rolle og arbeidsgiver, og all utdanning trenger skole.");
        return;
      }

      // Kommer innholdet fra en tolket CV, fylles også tomme profilfelter (tittel, bosted, lenker).
      const result = applied
        ? await applyCvImportAction(applied.importId, { mode: "replace", edited: { ...applied.parsed, ...payload } })
        : await saveCvAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      initial.current = state;
      setApplied(null);
      toast.success("CV-en er lagret");
      router.refresh();
    });

  return (
    <>
      <Section title="Mal" description="Hvordan CV-en ser ut på profilen og når du laster den ned som PDF.">
        <div role="radiogroup" aria-label="CV-mal" className="grid gap-3 sm:grid-cols-3">
          {CV_TEMPLATES.map((t) => {
            const on = template === t;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseTemplate(t)}
                className={`group rounded-2xl border p-2 text-left transition ${on ? "border-ice/70 bg-ice/[0.06]" : "border-line hover:border-mist/50"}`}
              >
                <span className="block aspect-[210/150] overflow-hidden rounded-xl ring-1 ring-black/10">
                  <TemplateThumb template={t} />
                </span>
                <span className="mt-2.5 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{CV_TEMPLATE_LABELS[t].name}</span>
                  {on && <Check className="size-4 text-ice" />}
                </span>
                <span className="block px-1 pb-1 text-xs text-mist">{CV_TEMPLATE_LABELS[t].description}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/@${username}/cv`} variant="secondary" size="sm">
            Forhåndsvis
          </ButtonLink>
          <ButtonLink href={`/@${username}/cv?skriv=1`} variant="ghost" size="sm">
            <Printer className="size-4" /> Last ned som PDF
          </ButtonLink>
        </div>
      </Section>

      <Section
        title="Importer CV"
        description="Last opp CV-en som PDF eller bilde. Den vises på profilen, og vi kan fylle ut feltene under for deg."
      >
        <CvDocumentPanel initial={doc} autofilling={autofilling} canParse={canParse} onAutofill={() => readCv(parseStoredCvAction)} />
        <p className="mt-5 text-[13px] leading-5 text-mist/80">
          <span className="font-medium text-fg">Fra LinkedIn?</span> Gå til profilen din på LinkedIn, trykk «Mer» → «Lagre som PDF», og last opp
          filen her.
        </p>
      </Section>

      <Section title="Innhold" description="Erfaring, utdanning og ferdigheter. Dra i håndtaket eller bruk pilene for å endre rekkefølgen.">
        {draft && (
          <div className="mb-8 rounded-2xl border border-ice/40 bg-ice/[0.06] p-5">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="size-4 text-ice" /> Vi fant {draft.parsed.experience.length} erfaringer, {draft.parsed.education.length} utdanninger og{" "}
              {draft.parsed.skills.length} ferdigheter.
            </p>
            <p className="mt-1 text-sm text-mist">Du har allerede fylt ut noe. Hva vil du gjøre?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => applyDraft(draft, "replace")}>
                Erstatt
              </Button>
              <Button size="sm" variant="secondary" onClick={() => applyDraft(draft, "merge")}>
                Legg til
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Avbryt
              </Button>
            </div>
          </div>
        )}

        <CvEditor value={state} onChange={setState} />

        {canParse && (
          <p className="mt-10 text-sm text-mist/80">
            Har du CV-en bare i Word?{" "}
            <button type="button" onClick={() => docxRef.current?.click()} disabled={autofilling} className="inline-flex items-center gap-1 text-ice hover:underline">
              <FileUp className="size-3.5" /> Les inn feltene fra en .docx-fil
            </button>
            <input
              ref={docxRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                readCv(() => importCvAction(fd));
              }}
            />
          </p>
        )}
      </Section>

      <div className="sticky bottom-24 z-20 mt-2 flex items-center justify-end gap-4 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.6)] backdrop-blur-xl md:bottom-6">
        <p className="mr-auto text-sm text-mist">{dirty || applied ? "Du har endringer som ikke er lagret." : "Alt er lagret."}</p>
        <Link href={`/@${username}?fane=cv`} className="hidden text-sm text-mist hover:text-fg sm:block">
          Se CV-en
        </Link>
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty && !applied}>
          Lagre CV
        </Button>
      </div>
    </>
  );
}
