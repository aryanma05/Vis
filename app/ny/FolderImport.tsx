"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { addProjectScreenshotsAction, createProjectAction, updateProjectAction, uploadProjectImagesAction } from "@/app/actions/projects";
import { Check, FolderOpen, Plus, SlidersHorizontal, X } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { Button, Spinner } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
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

// Et bilde lastet opp for hånd, eller et bilde fra mappen som er redigert.
type Upload = { key: string; file: File; url: string };
type Editing = { kind: "upload" | "folder"; key: string; url: string };

const isImageFile = (f: File) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name);

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

// Bilder fra mappen kan velges bort og redigeres, og man kan laste opp egne bilder i
// tillegg (også når mappen ikke hadde noen).
export default function FolderImport({ maxImages }: { maxImages: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<FolderDraft | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [edits, setEdits] = useState<Map<string, Upload>>(new Map());
  const [preparing, setPreparing] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const room = maxImages - selected.size - uploads.length - preparing;

  // Rydd opp forhåndsvisningene (object-URL-er) når komponenten forsvinner.
  const ownUrls = useRef<string[]>([]);
  useEffect(() => {
    ownUrls.current = [...uploads.map((u) => u.url), ...[...edits.values()].map((e) => e.url)];
  }, [uploads, edits]);
  useEffect(() => () => ownUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

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
      // Ikke flere bilder enn et prosjekt kan ha.
      setSelected(new Set(next.images.slice(0, maxImages).map((i) => i.path)));
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

  async function addUploads(list: File[]) {
    const files = list.filter(isImageFile);
    if (files.length === 0) return toast.error("Det der var ikke et bilde. Bruk JPG, PNG, WebP eller GIF.");
    if (room <= 0) return toast.error(`Et prosjekt kan ha maks ${maxImages} bilder.`);
    const chosen = files.slice(0, room);
    if (files.length > room) toast.info(`Bare ${room} bilder til fikk plass (maks ${maxImages}).`);

    setPreparing((n) => n + chosen.length);
    let last: Upload | null = null;
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file);
        last = { key: crypto.randomUUID(), file: prepared, url: URL.createObjectURL(prepared) };
        const upload = last;
        setUploads((prev) => [...prev, upload]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPreparing((n) => n - 1);
      }
    }
    // Ett bilde: åpne redigeringen med en gang.
    if (chosen.length === 1 && last) setEditing({ kind: "upload", key: last.key, url: last.url });
  }

  function removeUpload(key: string) {
    const upload = uploads.find((u) => u.key === key);
    if (upload) URL.revokeObjectURL(upload.url);
    setUploads((prev) => prev.filter((u) => u.key !== key));
  }

  function saveEdit(target: Editing, file: File) {
    const next: Upload = { key: target.key, file, url: URL.createObjectURL(file) };
    if (target.kind === "upload") {
      const old = uploads.find((u) => u.key === target.key);
      if (old) URL.revokeObjectURL(old.url);
      setUploads((prev) => prev.map((u) => (u.key === target.key ? next : u)));
    } else {
      const old = edits.get(target.key);
      if (old) URL.revokeObjectURL(old.url);
      setEdits((prev) => new Map(prev).set(target.key, next));
      setSelected((prev) => new Set(prev).add(target.key));
    }
    setEditing(null);
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
      const total = chosen.length + uploads.length;
      const uploaded = new Map<string, string>();
      let failed = 0;
      let n = 0;
      const upload = async (getFile: () => File | Promise<File>) => {
        setStatus(`Laster opp bilde ${++n} av ${total}…`);
        try {
          const fd = new FormData();
          fd.append("images", await getFile());
          const result = await uploadProjectImagesAction(id, fd);
          if (result.ok && result.data[0]) return result.data[0].url;
        } catch {}
        failed++;
        return null;
      };
      // Bildene fra mappen først (redigert hvis brukeren har endret dem), så de opplastede.
      for (const img of chosen) {
        const edited = edits.get(img.path)?.file;
        const url = await upload(() => edited ?? prepareImage(img.file));
        if (url) uploaded.set(img.path, url);
      }
      for (const item of uploads) await upload(() => item.file);

      // Ingen bilder i det hele tatt, men prosjektet har en nettside: ta skjermbilder av den.
      if (total === 0 && draft.demoUrl.trim()) {
        setStatus("Tar skjermbilder av nettsiden…");
        await addProjectScreenshotsAction(id, draft.demoUrl.trim());
      }

      // README-bilder peker nå på de opplastede filene.
      if (chosen.some((img) => img.fromReadme)) {
        setStatus("Fullfører…");
        await updateProjectAction(id, projectForm(draft, rewriteReadmeImages(draft.description, draft.readmeDir, uploaded)));
      }

      // Noen bilder feilet: åpne redigeringen, så de kan legges til på nytt.
      router.push(failed > 0 ? `/prosjekt/${id}/rediger?bildefeil=${failed}` : `/prosjekt/${id}`);
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
          className={`flex flex-col items-center justify-center rounded-[28px] px-6 py-20 text-center ring-inset transition ${
            dragging ? "bg-sea/10 ring-2 ring-sea" : "bg-surface ring-1 ring-line"
          }`}
        >
          {status ? (
            <>
              <Spinner className="size-6 text-mist" />
              <span className="mt-4 text-mist">{status}</span>
            </>
          ) : (
            <>
              <span className="flex size-16 items-center justify-center rounded-full glass-chip text-fg">
                <FolderOpen className="size-7" />
              </span>
              <p className="mt-5 text-xl font-semibold">Dra prosjektmappen hit</p>
              <p className="mt-2 max-w-md text-sm leading-6 text-mist">
                Vi henter tittel, beskrivelse og skjermbilder fra README-en, og ser hvilke teknologier du har brukt.
              </p>
              <Button variant="secondary" className="mt-6" onClick={choose}>
                Velg mappe
              </Button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs leading-5 text-mist">
          Koden din lastes ikke opp. Vi leser bare README, package.json og lignende filer i nettleseren din, og laster opp
          skjermbildene du velger. node_modules, .git og byggmapper hoppes over.
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const set = <K extends keyof FolderDraft>(key: K, value: FolderDraft[K]) => setDraft({ ...draft, [key]: value });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-[18px] glass-card py-2 pl-4 pr-2 text-sm">
        <span className="flex items-center gap-2 text-mist">
          <Check className="size-4 text-success" />
          Leste {draft.fileCount.toLocaleString("nb-NO")} filer
          {draft.description ? " · fant README" : " · fant ingen README"}
        </span>
        <Button variant="ghost" size="xs" onClick={() => setDraft(null)}>
          Velg en annen mappe
        </Button>
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
        <Field label="GitHub-lenke" optional>
          <input className={inputClass} value={draft.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/…" />
        </Field>
        <Field label="Nettside" optional hint="Har prosjektet ingen bilder, tar vi skjermbilder av nettsiden." className="md:col-span-2">
          <input className={inputClass} value={draft.demoUrl} onChange={(e) => set("demoUrl", e.target.value)} inputMode="url" placeholder="https://" />
        </Field>
      </div>

      <section
        aria-label="Bilder"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addUploads([...e.dataTransfer.files]);
        }}
        className={`rounded-[22px] transition ${dragging ? "bg-sea/10 ring-2 ring-sea" : ""}`}
      >
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addUploads([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            Bilder <span className="font-normal text-mist">· {selected.size + uploads.length} valgt</span>
          </p>
          <p className="text-xs text-mist">Trykk på et bilde fra mappen for å velge det bort. Rediger med knappen i hjørnet.</p>
        </div>

        {draft.images.length === 0 && uploads.length === 0 && preparing === 0 && (
          <p className="mb-3 rounded-[18px] bg-fill p-4 text-sm text-mist">
            {draft.demoUrl.trim()
              ? "Fant ingen skjermbilder i mappen. Last opp egne bilder, eller la oss ta skjermbilder av nettsiden når prosjektet opprettes."
              : "Fant ingen skjermbilder i mappen. Last opp egne bilder, eller legg inn lenken til nettsiden over, så tar vi bilder av den."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {draft.images.map((img) => {
            const on = selected.has(img.path);
            const preview = edits.get(img.path)?.url ?? previews.get(img.path) ?? "";
            return (
              <div key={img.path} className={`glass-card group relative overflow-hidden rounded-[18px] transition ${on ? "" : "opacity-45 hover:opacity-80"}`}>
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(img.path);
                      else if (room > 0) next.add(img.path);
                      else toast.error(`Et prosjekt kan ha maks ${maxImages} bilder.`);
                      return next;
                    })
                  }
                  className="block w-full text-left"
                  aria-pressed={on}
                  aria-label={`${on ? "Velg bort" : "Velg"} ${img.path}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="aspect-[16/10] w-full object-cover" />
                  <span className="block truncate px-3 py-2 text-xs text-mist">{img.path}</span>
                </button>
                <span
                  className={`pointer-events-none absolute right-2 top-2 flex size-6 items-center justify-center rounded-full ${
                    on ? "bg-sea text-white" : "glass-dark text-transparent"
                  }`}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "folder", key: img.path, url: preview })}
                  aria-label={`Rediger ${img.path}`}
                  title="Rediger"
                  className="glass-dark absolute left-2 top-2 flex size-7 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>
              </div>
            );
          })}

          {uploads.map((item) => (
            <div key={item.key} className="glass-card group relative overflow-hidden rounded-[18px]">
              <button type="button" onClick={() => setEditing({ kind: "upload", key: item.key, url: item.url })} className="block w-full" aria-label="Rediger bildet">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="aspect-[16/10] w-full object-cover" />
                <span className="block truncate px-3 py-2 text-left text-xs text-mist">Lastet opp</span>
              </button>
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditing({ kind: "upload", key: item.key, url: item.url })}
                  aria-label="Rediger bildet"
                  title="Rediger"
                  className="glass-dark flex size-7 items-center justify-center rounded-full transition active:scale-90"
                >
                  <SlidersHorizontal className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeUpload(item.key)}
                  aria-label="Fjern bildet"
                  title="Fjern"
                  className="glass-dark flex size-7 items-center justify-center rounded-full transition hover:bg-danger active:scale-90"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {Array.from({ length: preparing }, (_, i) => (
            <div key={`klargjor-${i}`} className="skeleton aspect-[16/12] rounded-[18px]" />
          ))}

          {room > 0 && (
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="glass-chip flex min-h-32 flex-col items-center justify-center rounded-[18px] px-3 text-mist transition hover:bg-fill-2 hover:text-fg"
            >
              <Plus className="size-6" />
              <span className="mt-1.5 text-sm">Last opp bilder</span>
              <span className="mt-0.5 text-xs text-mist">eller dra dem hit</span>
            </button>
          )}
        </div>
      </section>

      {editing && (
        <ImageEditor
          key={`${editing.kind}-${editing.key}-${editing.url}`}
          src={editing.url}
          onCancel={() => setEditing(null)}
          onSave={(file) => saveEdit(editing, file)}
        />
      )}

      {draft.description && (
        <details className="rounded-[18px] glass-card">
          <summary className="cursor-pointer px-4 py-3 text-sm text-mist">README ({draft.description.length.toLocaleString("nb-NO")} tegn) blir beskrivelsen</summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-xs leading-5 text-mist">
            {draft.description.slice(0, 3000)}
          </pre>
        </details>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={create} disabled={!draft.title.trim() || preparing > 0} loading={status !== null}>
          {status ?? "Opprett prosjekt som utkast"}
        </Button>
        <p className="text-sm text-mist">Du kan se over og publisere det etterpå.</p>
      </div>
    </div>
  );
}
