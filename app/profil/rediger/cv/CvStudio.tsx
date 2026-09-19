"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { applyCvImportAction, importCvAction, parseStoredCvAction, saveCvAction } from "@/app/actions/cv";
import { Section } from "@/components/form";
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

type Pending = { importId: string; parsed: ParsedCv };

export default function CvStudio({ cv, doc, username }: { cv: Cv; doc: DocState; username: string }) {
  const router = useRouter();
  const initial = useRef(fromSaved(cv));
  const [state, setState] = useState<CvState>(initial.current);
  const [draft, setDraft] = useState<Pending | null>(null);
  const [applied, setApplied] = useState<Pending | null>(null);
  const [autofilling, setAutofilling] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const docxRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(toPayload(state)) !== JSON.stringify(toPayload(initial.current));
  const isEmpty = state.experience.length + state.education.length + state.skills.length === 0;

  async function readCv(run: () => ReturnType<typeof parseStoredCvAction>) {
    setAutofilling(true);
    setMessage(null);
    const result = await run();
    setAutofilling(false);
    if (!result.ok) return setMessage({ type: "error", text: result.error });
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
    setMessage({ type: "ok", text: "Feltene er fylt ut. Se over og trykk «Lagre CV»." });
  }

  const save = () =>
    startSaving(async () => {
      setMessage(null);
      const payload = toPayload(state);
      const missing =
        payload.experience.some((e) => !e.title || !e.organization) || payload.education.some((e) => !e.institution);
      if (missing) {
        return setMessage({ type: "error", text: "Alle erfaringer trenger rolle og arbeidsgiver, og all utdanning trenger skole." });
      }

      // Kommer innholdet fra en tolket CV, fylles også tomme profilfelter (tittel, bosted, lenker).
      const result = applied
        ? await applyCvImportAction(applied.importId, { mode: "replace", edited: { ...applied.parsed, ...payload } })
        : await saveCvAction(payload);

      if (!result.ok) return setMessage({ type: "error", text: result.error });
      initial.current = state;
      setApplied(null);
      setMessage({ type: "ok", text: "CV-en er lagret." });
      router.refresh();
    });

  return (
    <>
      <Section
        title="CV-dokument"
        description="Last opp CV-en som PDF eller bilde. Den vises på profilen din i full oppløsning, og besøkende kan laste den ned."
      >
        <CvDocumentPanel initial={doc} autofilling={autofilling} onAutofill={() => readCv(parseStoredCvAction)} />
      </Section>

      <Section
        title="Innhold"
        description="Erfaring, utdanning og ferdigheter vises ved siden av CV-dokumentet, og gjør deg lettere å finne."
      >
        {draft && (
          <div className="mb-8 rounded-xl border border-ice/40 bg-ice/5 p-5">
            <p className="font-medium">
              Vi fant {draft.parsed.experience.length} erfaringer, {draft.parsed.education.length} utdanninger og{" "}
              {draft.parsed.skills.length} ferdigheter.
            </p>
            <p className="mt-1 text-sm text-mist">Du har allerede fylt ut noe. Hva vil du gjøre?</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => applyDraft(draft, "replace")} className="rounded-lg bg-ice px-4 py-2 text-sm font-semibold text-ink">
                Erstatt
              </button>
              <button type="button" onClick={() => applyDraft(draft, "merge")} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-ice">
                Legg til
              </button>
              <button type="button" onClick={() => setDraft(null)} className="px-2 text-sm text-mist hover:text-white">
                Avbryt
              </button>
            </div>
          </div>
        )}

        <CvEditor value={state} onChange={setState} />

        <p className="mt-10 text-sm text-mist/70">
          Har du CV-en bare i Word?{" "}
          <button type="button" onClick={() => docxRef.current?.click()} disabled={autofilling} className="text-ice hover:underline">
            Les inn feltene fra en .docx-fil
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
      </Section>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-4 border-t border-line bg-ink/90 px-6 py-4 backdrop-blur">
        {message && (
          <p className={`mr-auto text-sm ${message.type === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</p>
        )}
        {!message && dirty && <p className="mr-auto text-sm text-mist">Du har endringer som ikke er lagret.</p>}
        <a href={`/@${username}?fane=cv`} className="text-sm text-mist hover:text-white">
          Se CV-en
        </a>
        <button
          type="button"
          onClick={save}
          disabled={saving || (!dirty && !applied)}
          className="rounded-lg bg-ice px-5 py-2.5 font-semibold text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Lagrer…" : "Lagre CV"}
        </button>
      </div>
    </>
  );
}
