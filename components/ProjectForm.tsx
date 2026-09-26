"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Plus, Star, X } from "lucide-react";
import {
  createProjectAction,
  deleteProjectImageAction,
  reorderProjectImagesAction,
  updateProjectAction,
  uploadProjectImagesAction,
} from "@/app/actions/projects";
import MarkdownEditor from "@/components/MarkdownEditor";
import TagInput from "@/components/TagInput";
import MonthYear from "@/components/ui/month-year";
import { Button } from "@/components/ui/button";
import { Field, FieldError, inputClass, Section } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { prepareImage } from "@/lib/prepare-image";

export type ProjectFormValues = {
  title: string;
  summary: string;
  description: string;
  tags: string[];
  repoUrl: string;
  demoUrl: string;
  videoUrl: string;
  role: string;
  projectDate: string;
  status: "draft" | "published";
};

type ExistingImage = { id: string; url: string; alt: string | null };

// Bildene i skjemaet: de som allerede er lagret, og nye som ikke er lastet opp ennå.
type Item = { kind: "existing"; key: string; id: string; url: string } | { kind: "new"; key: string; file: File; url: string };

const empty: ProjectFormValues = {
  title: "",
  summary: "",
  description: "",
  tags: [],
  repoUrl: "",
  demoUrl: "",
  videoUrl: "",
  role: "",
  projectDate: "",
  status: "published",
};

const CASE_TEMPLATE = `## Bakgrunn

Hvorfor lagde du dette? Hvem er det for?

## Min rolle

Hva gjorde du selv, og hvem jobbet du med?

## Utfordringen

Hva var vanskelig, og hvilke valg måtte du ta?

## Løsningen

Hvordan løste du det? Legg gjerne til skjermbilder og kodeeksempler.

## Resultat

Hva ble resultatet, og hva lærte du?
`;

const isImageFile = (f: File) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name);

// Bildene er hovedsaken: de kommer først og vises store. Deretter tittel, teknologier
// og historien om prosjektet.
export default function ProjectForm({
  projectId,
  initial = empty,
  images: initialImages = [],
  maxImages,
  notice,
  tagSuggestions = [],
}: {
  projectId?: string;
  initial?: ProjectFormValues;
  images?: ExistingImage[];
  maxImages: number;
  notice?: string;
  tagSuggestions?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Settes når prosjektet er opprettet, så et nytt forsøk (f.eks. etter en bildefeil)
  // oppdaterer det i stedet for å lage et til.
  const [savedId, setSavedId] = useState<string | null>(projectId ?? null);
  const [items, setItems] = useState<Item[]>(() => initialImages.map((img) => ({ kind: "existing", key: img.id, id: img.id, url: img.url })));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [projectDate, setProjectDate] = useState(initial.projectDate);
  const [status, setStatus] = useState(initial.status);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEdit = Boolean(projectId);
  const room = maxImages - items.length - preparing;
  const busy = pending || preparing > 0;

  // Rydd opp forhåndsvisningene (object-URL-er) når skjemaet lukkes.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => item.kind === "new" && URL.revokeObjectURL(item.url)), []);

  async function addFiles(list: File[]) {
    const files = list.filter(isImageFile);
    if (files.length === 0) return toast.error("Det der var ikke et bilde. Bruk JPG, PNG, WebP eller GIF.");
    if (room <= 0) return toast.error(`Et prosjekt kan ha maks ${maxImages} bilder.`);
    const chosen = files.slice(0, room);
    if (files.length > room) toast.info(`Bare ${room} bilder til fikk plass (maks ${maxImages}).`);

    setPreparing((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file);
        setItems((prev) => [...prev, { kind: "new", key: crypto.randomUUID(), file: prepared, url: URL.createObjectURL(prepared) }]);
      } catch (e) {
        toast.error((e as Error).message);
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
      if (to < 0 || to >= prev.length || to === index) return prev;
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preparing > 0) return toast.info("Vent litt, bildene gjøres klare.");
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setError(null);
      setErrors({});
      const result = savedId ? await updateProjectAction(savedId, formData) : await createProjectAction(formData);
      if (!result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
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
        setProgress(`Laster opp bilde ${n + 1} av ${fresh.length} …`);
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

      toast.success(isEdit ? "Endringene er lagret" : status === "published" ? "Prosjektet er publisert 🎉" : "Utkastet er lagret");
      router.push(`/prosjekt/${id}`);
      router.refresh();
    });
  }

  const err = (name: string) => errors[name]?.[0];
  const [cover, ...rest] = items;

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (dragIndex !== null) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      if (dragIndex !== null) return;
      e.preventDefault();
      setDragging(false);
      addFiles([...e.dataTransfer.files]);
    },
  };

  const tileDrag = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      if (dragIndex === null) return;
      e.preventDefault();
    },
    onDrop: (e: React.DragEvent) => {
      if (dragIndex === null) return;
      e.preventDefault();
      e.stopPropagation();
      move(dragIndex, index);
      setDragIndex(null);
    },
    onDragEnd: () => setDragIndex(null),
  });

  return (
    <form onSubmit={onSubmit} className="pb-4">
      {/* Bildene */}
      <section aria-label="Bilder" className="pt-2">
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
            className={`blueprint group flex aspect-[16/8] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition ${
              dragging ? "border-ice bg-ice/10" : "border-line hover:border-ice/60"
            }`}
          >
            <span className="flex size-16 items-center justify-center rounded-3xl border border-line bg-surface text-ice transition group-hover:scale-105">
              <ImagePlus className="size-7" />
            </span>
            <span className="mt-5 text-2xl font-bold tracking-tight text-fg md:text-3xl">Dra bildene hit</span>
            <span className="mt-2 text-sm text-mist">eller klikk for å velge · lim inn skjermbilder med ⌘V · opptil {maxImages} bilder</span>
          </button>
        ) : (
          <div className="space-y-3" {...dropHandlers}>
            {cover ? (
              <figure {...tileDrag(0)} className={`group relative overflow-hidden rounded-3xl bg-surface ring-1 ${dragging ? "ring-ice" : "ring-line"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover.url} alt="" className="aspect-[16/9] w-full object-cover" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  <Star className="size-3.5" /> Forsidebilde
                </span>
                <div className="absolute right-4 top-4 flex gap-2">
                  {rest.length > 0 && <OverlayButton onClick={() => move(0, 1)} label="Flytt bakover" icon={<ArrowRight className="size-3.5" />} />}
                  <OverlayButton onClick={() => remove(0)} label="Fjern bildet" icon={<X className="size-3.5" />} danger />
                </div>
              </figure>
            ) : (
              <div className="skeleton aspect-[16/9] w-full rounded-3xl" />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rest.map((item, i) => {
                const index = i + 1;
                return (
                  <figure key={item.key} {...tileDrag(index)} className={`group relative overflow-hidden rounded-2xl bg-surface ring-1 ring-line ${dragIndex === index ? "opacity-40" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <span className="absolute left-2 top-2 cursor-grab rounded-md bg-black/50 p-1 text-white opacity-0 backdrop-blur transition group-hover:opacity-100" aria-hidden="true">
                      <GripVertical className="size-3.5" />
                    </span>
                    <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                      <OverlayButton onClick={() => move(index, 0)} label="Gjør til forsidebilde" icon={<Star className="size-3.5" />} />
                      <div className="flex gap-1">
                        <OverlayButton onClick={() => move(index, index - 1)} label="Flytt fremover" icon={<ArrowLeft className="size-3.5" />} />
                        {index < items.length - 1 && <OverlayButton onClick={() => move(index, index + 1)} label="Flytt bakover" icon={<ArrowRight className="size-3.5" />} />}
                        <OverlayButton onClick={() => remove(index)} label="Fjern bildet" icon={<X className="size-3.5" />} danger />
                      </div>
                    </div>
                  </figure>
                );
              })}

              {Array.from({ length: Math.max(0, preparing - (cover ? 0 : 1)) }, (_, i) => (
                <div key={`klargjor-${i}`} className="skeleton aspect-[4/3] rounded-2xl" />
              ))}

              {room > 0 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-mist transition hover:border-ice/60 hover:text-fg"
                >
                  <Plus className="size-6" />
                  <span className="mt-1.5 text-sm">Legg til bilder</span>
                </button>
              )}
            </div>
            <p className="text-xs text-mist/80">Det første bildet blir forsiden. Dra bildene for å endre rekkefølgen. {preparing > 0 && "Gjør klar bilder …"}</p>
          </div>
        )}
      </section>

      {/* Tittel og kort om */}
      <section className="mt-10 space-y-4">
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
            aria-invalid={Boolean(err("title")) || undefined}
            className="w-full border-b border-line bg-transparent pb-3 text-4xl font-bold tracking-tight text-fg outline-none transition placeholder:text-mist/35 focus:border-ice md:text-6xl"
          />
          {err("title") && <FieldError>{err("title")}</FieldError>}
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
            placeholder="Én setning om hva det er og hvem det er for"
            className="w-full bg-transparent text-xl text-fg outline-none placeholder:text-mist/45 md:text-2xl"
          />
          {err("summary") && <FieldError>{err("summary")}</FieldError>}
        </div>
      </section>

      <Section title="Laget med" description="Teknologier og verktøy. Gjør at folk som leter etter dem, finner prosjektet.">
        <TagInput name="tags" defaultValue={initial.tags} suggestions={tagSuggestions} />
        {err("tags") && <FieldError>{err("tags")}</FieldError>}
      </Section>

      <Section title="Historien" description="README-en til prosjektet. Hva laget du, hvorfor, og hva lærte du? Bruk case-malen for å komme i gang.">
        <MarkdownEditor
          name="description"
          defaultValue={initial.description}
          placeholder="Skriv om prosjektet med markdown …"
          maxLength={20_000}
          rows={12}
          template={CASE_TEMPLATE}
          templateLabel="Bruk case-mal"
          invalid={Boolean(err("description"))}
        />
        {err("description") && <FieldError>{err("description")}</FieldError>}
      </Section>

      <Section title="Detaljer" description="Alt er valgfritt, men lenker og rolle gjør prosjektet mer troverdig.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Din rolle" optional hint="F.eks. «Design og frontend» eller «Alt, alene»." error={err("role")}>
            <input name="role" defaultValue={initial.role} maxLength={80} placeholder="Fullstack" className={inputClass} />
          </Field>
          <div>
            <span className="mb-2 block text-sm font-medium text-fg">
              Når ble det laget? <span className="font-normal text-mist/60">valgfritt</span>
            </span>
            <MonthYear label="Dato" value={projectDate} onChange={setProjectDate} />
            <input type="hidden" name="projectDate" value={projectDate} />
            {err("projectDate") && <FieldError>{err("projectDate")}</FieldError>}
          </div>
          <Field label="Lenke til prosjektet" optional error={err("demoUrl")}>
            <input name="demoUrl" inputMode="url" defaultValue={initial.demoUrl} placeholder="https://" className={inputClass} />
          </Field>
          <Field label="Kode" optional hint="GitHub, GitLab eller lignende." error={err("repoUrl")}>
            <input name="repoUrl" inputMode="url" defaultValue={initial.repoUrl} placeholder="https://github.com/…" className={inputClass} />
          </Field>
          <Field label="Video eller prototype" optional hint="YouTube, Vimeo, Loom eller Figma vises innebygd på prosjektsiden." error={err("videoUrl")} className="md:col-span-2">
            <input name="videoUrl" inputMode="url" defaultValue={initial.videoUrl} placeholder="https://www.youtube.com/watch?v=…" className={inputClass} />
          </Field>
        </div>
      </Section>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="sticky bottom-24 z-20 mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.6)] backdrop-blur-xl md:bottom-6">
        <input type="hidden" name="status" value={status} />
        <Segmented
          label="Synlighet"
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: "published", label: "Publisert" },
            { value: "draft", label: "Utkast – bare du ser det" },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>
            Avbryt
          </Button>
          <Button type="submit" loading={busy}>
            {progress ?? (pending ? "Lagrer …" : isEdit || savedId ? "Lagre" : status === "published" ? "Publiser prosjektet" : "Lagre utkast")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function OverlayButton({ onClick, label, icon, danger }: { onClick: () => void; label: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition ${danger ? "hover:bg-danger" : "hover:bg-black/80"}`}
    >
      {icon}
    </button>
  );
}
