"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createProjectAction,
  deleteProjectImageAction,
  reorderProjectImagesAction,
  updateProjectAction,
  uploadProjectImagesAction,
} from "@/app/actions/projects";
import { ui } from "@/components/ui";
import { prepareImage } from "@/lib/prepare-image";

export type ProjectFormValues = {
  title: string;
  summary: string;
  description: string;
  tags: string;
  repoUrl: string;
  demoUrl: string;
  projectDate: string;
  status: "draft" | "published";
};

type ExistingImage = { id: string; url: string; alt: string | null };

// Bildene i skjemaet: de som allerede er lagret, og nye som ikke er lastet opp ennå.
type Item =
  | { kind: "existing"; key: string; id: string; url: string }
  | { kind: "new"; key: string; file: File; url: string };

const empty: ProjectFormValues = {
  title: "",
  summary: "",
  description: "",
  tags: "",
  repoUrl: "",
  demoUrl: "",
  projectDate: "",
  status: "published",
};

// Feltene under «Mer om prosjektet». Har ett av dem en feil, må delen åpnes.
const MORE_FIELDS = ["description", "repoUrl", "demoUrl", "projectDate"];

const isImageFile = (f: File) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name);

// Bildene er hovedsaken: de kommer først og vises store. Tittel og teknologier er det
// eneste som trengs i tillegg, resten ligger under «Mer om prosjektet».
export default function ProjectForm({
  projectId,
  initial = empty,
  images: initialImages = [],
  maxImages,
  notice,
}: {
  projectId?: string;
  initial?: ProjectFormValues;
  images?: ExistingImage[];
  maxImages: number;
  notice?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Settes når prosjektet er opprettet, så et nytt forsøk (f.eks. etter en bildefeil)
  // oppdaterer det i stedet for å lage et til.
  const [savedId, setSavedId] = useState<string | null>(projectId ?? null);
  const [items, setItems] = useState<Item[]>(() =>
    initialImages.map((img) => ({ kind: "existing", key: img.id, id: img.id, url: img.url })),
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [showMore, setShowMore] = useState(
    Boolean(initial.description || initial.repoUrl || initial.demoUrl || initial.projectDate),
  );
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(projectId);
  const room = maxImages - items.length - preparing;
  const busy = pending || preparing > 0;

  // Rydd opp forhåndsvisningene (object-URL-er) når skjemaet lukkes.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => itemsRef.current.forEach((item) => item.kind === "new" && URL.revokeObjectURL(item.url)),
    [],
  );

  async function addFiles(list: File[]) {
    const files = list.filter(isImageFile);
    if (files.length === 0) return setError("Det der var ikke et bilde. Bruk JPG, PNG, WebP eller GIF.");
    if (room <= 0) return setError(`Et prosjekt kan ha maks ${maxImages} bilder.`);
    const chosen = files.slice(0, room);
    setError(files.length > room ? `Bare ${room} bilder til fikk plass (maks ${maxImages}).` : null);

    setPreparing((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file);
        setItems((prev) => [
          ...prev,
          { kind: "new", key: crypto.randomUUID(), file: prepared, url: URL.createObjectURL(prepared) },
        ]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPreparing((n) => n - 1);
      }
    }
  }

  // Lim inn et skjermbilde med ⌘V / Ctrl+V hvor som helst i skjemaet.
  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  });
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])].filter(isImageFile);
      if (files.length === 0) return;
      event.preventDefault();
      addFilesRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function move(index: number, to: number) {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function remove(index: number) {
    const item = items[index];
    if (item.kind === "new") URL.revokeObjectURL(item.url);
    else setRemovedIds((ids) => [...ids, item.id]);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles([...event.dataTransfer.files]);
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preparing > 0) return setError("Vent litt, bildene gjøres klare.");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setError(null);
      setErrors({});
      const result = savedId ? await updateProjectAction(savedId, formData) : await createProjectAction(formData);
      if (!result.ok) {
        const fieldErrors = result.fieldErrors ?? {};
        setError(result.error);
        setErrors(fieldErrors);
        if (MORE_FIELDS.some((f) => fieldErrors[f]?.length)) setShowMore(true);
        return;
      }

      const id = result.data.id;
      setSavedId(id);
      const failures: string[] = [];

      // 1. Bilder som er fjernet.
      for (const imageId of removedIds) {
        const removed = await deleteProjectImageAction(imageId);
        if (!removed.ok) failures.push(removed.error);
      }
      setRemovedIds([]);

      // 2. Nye bilder, ett om gangen (holder hver forespørsel liten).
      let current = items;
      const fresh = items.filter((item) => item.kind === "new");
      for (const [n, item] of fresh.entries()) {
        setProgress(`Laster opp bilde ${n + 1} av ${fresh.length}…`);
        const fd = new FormData();
        fd.append("images", item.file);
        const uploaded = await uploadProjectImagesAction(id, fd);
        if (uploaded.ok && uploaded.data[0]) {
          const saved = uploaded.data[0];
          current = current.map((i) => (i.key === item.key ? { kind: "existing", key: item.key, id: saved.id, url: saved.url } : i));
          URL.revokeObjectURL(item.url);
        } else {
          failures.push(uploaded.ok ? "ukjent feil" : uploaded.error);
        }
      }
      setItems(current);

      // 3. Rekkefølgen slik den står i skjemaet (det første bildet er forsiden).
      const orderedIds = current.flatMap((i) => (i.kind === "existing" ? [i.id] : []));
      if (orderedIds.length > 1) {
        const reordered = await reorderProjectImagesAction(id, orderedIds);
        if (!reordered.ok) failures.push(reordered.error);
      }
      setProgress(null);

      if (failures.length > 0) {
        const count = failures.length === 1 ? "ett bilde" : `${failures.length} bilder`;
        setError(`Prosjektet er lagret, men ${count} ble ikke lagret: ${failures[0]} Trykk «Lagre» for å prøve igjen.`);
        return;
      }

      router.push(`/prosjekt/${id}`);
      router.refresh();
    });
  }

  const fieldError = (name: string) =>
    errors[name]?.length ? <p className={ui.fieldError}>{errors[name][0]}</p> : null;

  const [cover, ...rest] = items;

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      {/* ------------------------------------------------------------------ */}
      {/* Bildene                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Bilder">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />

        {!cover && preparing === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            {...dropHandlers}
            className={`group flex aspect-[16/9] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition ${
              dragging ? "border-ice bg-ice/10" : "border-line bg-surface/40 hover:border-ice/70 hover:bg-surface/70"
            }`}
          >
            <ImagePlusIcon className="h-12 w-12 text-ice transition group-hover:scale-110" />
            <span className="mt-5 text-xl font-semibold text-fg md:text-2xl">Dra bildene hit</span>
            <span className="mt-2 text-sm text-mist">
              eller klikk for å velge · lim inn skjermbilder med ⌘V · opptil {maxImages} bilder
            </span>
          </button>
        ) : (
          <div className="space-y-3" {...dropHandlers}>
            {cover ? (
              <figure
                className={`group relative overflow-hidden rounded-3xl border bg-black/40 ${dragging ? "border-ice" : "border-line"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.url} alt="" className="aspect-[16/10] w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-fg backdrop-blur">
                  Forsidebilde
                </span>
                <div className="absolute right-4 top-4 flex gap-2">
                  {rest.length > 0 && (
                    <OverlayButton onClick={() => move(0, 1)} label="Flytt bakover">
                      →
                    </OverlayButton>
                  )}
                  <OverlayButton onClick={() => remove(0)} label="Fjern bildet" danger>
                    ✕
                  </OverlayButton>
                </div>
              </figure>
            ) : (
              <div className="aspect-[16/10] w-full animate-pulse rounded-3xl bg-surface" />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((item, i) => {
                const index = i + 1;
                return (
                  <figure key={item.key} className="group relative overflow-hidden rounded-2xl border border-line bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                      <OverlayButton onClick={() => move(index, 0)} label="Gjør til forsidebilde">
                        Forside
                      </OverlayButton>
                      <div className="flex gap-1">
                        <OverlayButton onClick={() => move(index, index - 1)} label="Flytt fremover">
                          ←
                        </OverlayButton>
                        {index < items.length - 1 && (
                          <OverlayButton onClick={() => move(index, index + 1)} label="Flytt bakover">
                            →
                          </OverlayButton>
                        )}
                        <OverlayButton onClick={() => remove(index)} label="Fjern bildet" danger>
                          ✕
                        </OverlayButton>
                      </div>
                    </div>
                  </figure>
                );
              })}

              {Array.from({ length: Math.max(0, preparing - (cover ? 0 : 1)) }, (_, i) => (
                <div key={`klargjor-${i}`} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface" />
              ))}

              {room > 0 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-mist transition hover:border-ice/70 hover:text-fg"
                >
                  <span className="text-3xl leading-none">+</span>
                  <span className="mt-2 text-sm">Legg til bilder</span>
                </button>
              )}
            </div>
            <p className="text-xs text-mist/70">
              Det første bildet blir forsiden. {preparing > 0 && "Gjør klar bilder…"}
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tekst: så lite som mulig                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-6">
        <div>
          <label htmlFor="title" className="sr-only">
            Tittel
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={100}
            defaultValue={initial.title}
            placeholder="Navn på prosjektet"
            className="w-full border-b border-line bg-transparent pb-3 text-3xl font-semibold tracking-tight text-fg outline-none placeholder:text-mist/40 focus:border-ice md:text-5xl"
          />
          {fieldError("title")}
        </div>

        <div>
          <label htmlFor="summary" className="sr-only">
            Kort beskrivelse
          </label>
          <input
            id="summary"
            name="summary"
            maxLength={200}
            defaultValue={initial.summary}
            placeholder="Én setning om hva det er (valgfritt)"
            className="w-full bg-transparent text-lg text-fg outline-none placeholder:text-mist/50"
          />
          {fieldError("summary")}
        </div>

        <div>
          <label htmlFor="tags" className={ui.label}>
            Laget med
          </label>
          <input id="tags" name="tags" defaultValue={initial.tags} placeholder="Figma, React, Blender …" className={ui.input} />
          <p className={ui.hint}>Skill med komma. Gjør at andre finner prosjektet.</p>
          {fieldError("tags")}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            className="text-sm font-medium text-ice hover:underline"
          >
            {showMore ? "− Skjul beskrivelse, lenker og dato" : "+ Beskrivelse, lenker og dato (valgfritt)"}
          </button>

          {/* Feltene må ligge i skjemaet selv om de er skjult, ellers slettes innholdet ved lagring. */}
          <div className={showMore ? "mt-6 space-y-6" : "hidden"}>
            <div>
              <label htmlFor="description" className={ui.label}>
                Om prosjektet
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                defaultValue={initial.description}
                placeholder="Kort om hva du laget og hvorfor. Markdown støttes."
                className={`${ui.input} text-sm`}
              />
              {fieldError("description")}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label htmlFor="demoUrl" className={ui.label}>
                  Lenke til prosjektet
                </label>
                <input id="demoUrl" name="demoUrl" type="url" defaultValue={initial.demoUrl} placeholder="https://…" className={ui.input} />
                {fieldError("demoUrl")}
              </div>
              <div>
                <label htmlFor="repoUrl" className={ui.label}>
                  Kode (GitHub)
                </label>
                <input id="repoUrl" name="repoUrl" type="url" defaultValue={initial.repoUrl} placeholder="https://github.com/…" className={ui.input} />
                {fieldError("repoUrl")}
              </div>
            </div>

            <div className="max-w-xs">
              <label htmlFor="projectDate" className={ui.label}>
                Når ble det laget?
              </label>
              <input
                id="projectDate"
                name="projectDate"
                defaultValue={initial.projectDate}
                placeholder="ÅÅÅÅ-MM, f.eks. 2025-03"
                pattern="\d{4}(-(0[1-9]|1[0-2]))?"
                className={ui.input}
              />
              {fieldError("projectDate")}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <fieldset className="flex rounded-lg border border-line p-1 text-sm">
          <legend className="sr-only">Synlighet</legend>
          {(
            [
              ["published", "Publisert"],
              ["draft", "Utkast – bare du ser det"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="status" value={value} defaultChecked={initial.status === value} className="peer sr-only" />
              <span className="block rounded-md px-3 py-1.5 text-mist transition peer-checked:bg-surface peer-checked:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-ice">
                {label}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className={ui.secondary}>
            Avbryt
          </button>
          <button type="submit" disabled={busy} className={ui.primary}>
            {progress ?? (pending ? "Lagrer…" : isEdit || savedId ? "Lagre" : "Publiser prosjektet")}
          </button>
        </div>
      </div>
    </form>
  );
}

function OverlayButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium backdrop-blur transition ${
        danger ? "text-red-300 hover:bg-red-500/80 hover:text-white" : "text-fg hover:bg-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ImagePlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-4.5-4.5L8 20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 1.5v5M16.5 4h5" strokeLinecap="round" />
    </svg>
  );
}
