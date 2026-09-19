"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyCvImportAction, discardCvImportAction, importCvAction } from "@/app/actions/cv";
import { ui } from "@/components/ui";
import type { ParsedCv } from "@/lib/validation";

export default function CvImporter({ username, hasCv }: { username: string; hasCv: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ importId: string; result: ParsedCv } | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (file instanceof File && file.size > 4 * 1024 * 1024) return setError("Filen er større enn 4 MB.");

    startTransition(async () => {
      setError(null);
      const result = await importCvAction(formData);
      if (!result.ok) return setError(result.error);
      setDraft(result.data);
    });
  }

  function apply() {
    if (!draft) return;
    startTransition(async () => {
      const result = await applyCvImportAction(draft.importId, { mode });
      if (!result.ok) return setError(result.error);
      router.push(`/@${username}`);
      router.refresh();
    });
  }

  function discard() {
    if (!draft) return;
    startTransition(async () => {
      await discardCvImportAction(draft.importId);
      setDraft(null);
    });
  }

  if (draft) {
    const cv = draft.result;
    return (
      <div className="space-y-6">
        <p className="text-[#B8D8E3]">Dette fant vi i CV-en. Se over før du lagrer det på profilen.</p>

        {(cv.headline || cv.location) && (
          <p>
            {[cv.headline, cv.location].filter(Boolean).join(" · ")}
          </p>
        )}

        <div>
          <h3 className="font-semibold">Erfaring ({cv.experience.length})</h3>
          <ul className="mt-2 space-y-2 text-sm text-[#B8D8E3]">
            {cv.experience.map((e, i) => (
              <li key={i}>
                <span className="text-white">{e.title}</span> · {e.organization}{" "}
                {e.startDate && `(${e.startDate} – ${e.endDate ?? "nå"})`}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Utdanning ({cv.education.length})</h3>
          <ul className="mt-2 space-y-2 text-sm text-[#B8D8E3]">
            {cv.education.map((e, i) => (
              <li key={i}>
                <span className="text-white">{e.institution}</span>
                {[e.degree, e.fieldOfStudy].filter(Boolean).length > 0 && ` · ${[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}`}{" "}
                {e.startDate && `(${e.startDate} – ${e.endDate ?? "nå"})`}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Ferdigheter ({cv.skills.length})</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {cv.skills.map((s) => (
              <span key={s} className={ui.tag}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {hasCv && (
          <fieldset className="space-y-2 text-sm">
            <legend className={ui.label}>Du har allerede en CV på profilen</legend>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Erstatt den med denne
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} /> Legg til i den eksisterende
            </label>
          </fieldset>
        )}

        {error && <p className={ui.error}>{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={apply} disabled={pending} className={ui.primary}>
            {pending ? "Lagrer…" : "Lagre på profilen"}
          </button>
          <button type="button" onClick={discard} disabled={pending} className={ui.secondary}>
            Forkast
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={upload} className="space-y-4">
      <input
        type="file"
        name="file"
        required
        accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="block w-full text-sm text-[#B8D8E3] file:mr-4 file:rounded-lg file:border-0 file:bg-[#C7F9FF] file:px-4 file:py-2 file:font-semibold file:text-[#071A52]"
      />
      <p className={ui.hint}>PDF eller Word (.docx), maks 4 MB. Selve filen lagres ikke, bare innholdet du velger å lagre.</p>
      {error && <p className={ui.error}>{error}</p>}
      <button type="submit" disabled={pending} className={ui.primary}>
        {pending ? "Leser CV-en… (tar noen sekunder)" : "Les inn CV"}
      </button>
    </form>
  );
}
