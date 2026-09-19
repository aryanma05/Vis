"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createProjectAction, updateProjectAction, uploadProjectImagesAction } from "@/app/actions/projects";
import { Field, inputClass } from "@/components/form";
import { FolderIcon } from "@/components/icons";
import {
  analyzeFolder,
  entriesFromDrop,
  entriesFromFileList,
  entriesFromHandle,
  prepareImage,
  rewriteReadmeImages,
  type FolderDraft,
} from "@/lib/folder-import";

type Picker = { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };

function projectForm(draft: FolderDraft, description: string) {
  const fd = new FormData();
  fd.append("title", draft.title);
  fd.append("summary", draft.summary);
  fd.append("description", description);
  fd.append("tags", draft.tags.join(","));
  fd.append("repoUrl", draft.repoUrl);
  fd.append("demoUrl", draft.demoUrl);
  fd.append("status", "draft");
  return fd;
}

export default function FolderImport() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<FolderDraft | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => new Map(draft?.images.map((img) => [img.path, URL.createObjectURL(img.file)]) ?? []),
    [draft],
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function analyze(source: Promise<{ root: string; entries: Parameters<typeof analyzeFolder>[1] } | null>) {
    setError(null);
    setStatus("Leser mappen…");
    try {
      const result = await source;
      if (!result) throw new Error("Dra inn en mappe, ikke en enkeltfil.");
      if (result.entries.length === 0) throw new Error("Fant ingen filer i mappen.");
      const next = await analyzeFolder(result.root, result.entries);
      setDraft(next);
      setSelected(new Set(next.images.map((i) => i.path)));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Klarte ikke å lese mappen.");
    } finally {
      setStatus(null);
    }
  }

  async function choose() {
    const picker = (window as Picker).showDirectoryPicker;
    if (picker) return analyze(picker().then(entriesFromHandle));
    inputRef.current?.click();
  }

  async function create() {
    if (!draft) return;
    setError(null);
    try {
      setStatus("Oppretter prosjektet…");
      const baseDescription = rewriteReadmeImages(draft.description, draft.readmeDir, new Map());
      const created = await createProjectAction(projectForm(draft, baseDescription));
      if (!created.ok) throw new Error(created.error);
      const id = created.data.id;

      const chosen = draft.images.filter((img) => selected.has(img.path));
      const uploaded = new Map<string, string>();
      for (const [i, img] of chosen.entries()) {
        setStatus(`Laster opp bilde ${i + 1} av ${chosen.length}…`);
        const fd = new FormData();
        fd.append("images", await prepareImage(img.file));
        const result = await uploadProjectImagesAction(id, fd);
        if (result.ok && result.data[0]) uploaded.set(img.path, result.data[0].url);
      }

      // README-bilder peker nå på de opplastede filene.
      if (chosen.some((img) => img.fromReadme)) {
        setStatus("Fullfører…");
        await updateProjectAction(id, projectForm(draft, rewriteReadmeImages(draft.description, draft.readmeDir, uploaded)));
      }

      router.push(`/prosjekt/${id}`);
    } catch (e) {
      setError((e as Error).message || "Noe gikk galt.");
      setStatus(null);
    }
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      {...{ webkitdirectory: "", directory: "" }}
      onChange={(e) => {
        if (e.target.files?.length) analyze(Promise.resolve(entriesFromFileList(e.target.files)));
        e.target.value = "";
      }}
    />
  );

  if (!draft) {
    return (
      <div>
        {hiddenInput}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const item = e.dataTransfer.items?.[0];
            if (item) analyze(entriesFromDrop(item));
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center transition ${
            dragging ? "border-ice bg-ice/5" : "border-line"
          }`}
        >
          {status ? (
            <>
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ice" />
              <span className="mt-4 text-mist">{status}</span>
            </>
          ) : (
            <>
              <FolderIcon className="h-10 w-10 text-mist" />
              <p className="mt-4 text-lg font-medium">Dra prosjektmappen hit</p>
              <p className="mt-1.5 max-w-md text-sm text-mist">
                Vi henter tittel, beskrivelse og skjermbilder fra README-en, og ser hvilke teknologier du har brukt.
              </p>
              <button
                type="button"
                onClick={choose}
                className="mt-6 rounded-lg border border-line px-4 py-2 text-sm font-medium transition hover:border-ice"
              >
                Velg mappe
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-mist/60">
          Koden din lastes ikke opp. Vi leser bare README, package.json og lignende filer i nettleseren din, og laster opp
          skjermbildene du velger. node_modules, .git og byggmapper hoppes over.
        </p>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  const set = <K extends keyof FolderDraft>(key: K, value: FolderDraft[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm">
        <span className="text-mist">
          Leste {draft.fileCount.toLocaleString("nb-NO")} filer
          {draft.description ? " · fant README" : " · fant ingen README"}
        </span>
        <button type="button" onClick={() => setDraft(null)} className="text-mist hover:text-white">
          Velg en annen mappe
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Tittel" className="md:col-span-2">
          <input className={inputClass} value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={100} />
        </Field>
        <Field label="Kort beskrivelse" className="md:col-span-2">
          <input className={inputClass} value={draft.summary} onChange={(e) => set("summary", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Teknologier" hint="Skill med komma.">
          <input
            className={inputClass}
            value={draft.tags.join(", ")}
            onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trimStart()))}
          />
        </Field>
        <Field label="GitHub-lenke (valgfritt)">
          <input className={inputClass} value={draft.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/…" />
        </Field>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">
          Bilder <span className="font-normal text-mist">· {selected.size} valgt</span>
        </p>
        {draft.images.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-sm text-mist">
            Fant ingen skjermbilder. Du kan legge til bilder etterpå fra redigeringssiden.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {draft.images.map((img) => {
              const on = selected.has(img.path);
              return (
                <button
                  key={img.path}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(img.path);
                      else next.add(img.path);
                      return next;
                    })
                  }
                  className={`group relative overflow-hidden rounded-lg border text-left transition ${on ? "border-ice" : "border-line opacity-50"}`}
                  aria-pressed={on}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previews.get(img.path)} alt="" className="aspect-[16/10] w-full object-cover" />
                  <span className="block truncate px-2 py-1.5 font-mono text-[10px] text-mist">{img.path}</span>
                  <span
                    className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      on ? "bg-ice text-ink" : "bg-ink/80 text-mist"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {draft.description && (
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-4 py-3 text-sm text-mist">README ({draft.description.length.toLocaleString("nb-NO")} tegn) blir beskrivelsen</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-xs leading-5 text-mist">
            {draft.description.slice(0, 3000)}
          </pre>
        </details>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={create}
          disabled={status !== null || !draft.title.trim()}
          className="rounded-lg bg-ice px-5 py-3 font-semibold text-ink transition hover:bg-white disabled:opacity-60"
        >
          {status ?? "Opprett prosjekt som utkast"}
        </button>
        <p className="text-sm text-mist/70">Du kan se over og publisere det etterpå.</p>
      </div>
    </div>
  );
}
