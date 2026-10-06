"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  CodeXml,
  Globe2,
  GripVertical,
  Hammer,
  ImagePlus,
  Layers,
  Link2,
  PenLine,
  PlayCircle,
  Plus,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  captureScreenshotsAction,
  createProjectAction,
  deleteProjectImageAction,
  reorderProjectImagesAction,
  updateProjectAction,
  uploadProjectImagesAction,
} from "@/app/actions/projects";
import ImageEditor from "@/components/ImageEditor";
import { useLocale, useT } from "@/components/LocaleProvider";
import MarkdownEditor from "@/components/MarkdownEditor";
import MemberPicker, { type MemberOption } from "@/components/MemberPicker";
import TagInput from "@/components/TagInput";
import MonthYear from "@/components/ui/month-year";
import { Button } from "@/components/ui/button";
import { Field, FieldError, inputClass, Section } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { MAX_PROJECT_MEMBERS, PROGRESS_LABELS, type ProjectProgress } from "@/lib/constants";
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
  progress: ProjectProgress;
  members: MemberOption[];
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
  progress: "completed",
  members: [],
};

const CASE_TEMPLATE = {
  nb: `## Bakgrunn

Hvorfor lagde du dette? Hvem er det for?

## Min rolle

Hva gjorde du selv, og hvem jobbet du med?

## Utfordringen

Hva var vanskelig, og hvilke valg måtte du ta?

## Løsningen

Hvordan løste du det? Legg gjerne til skjermbilder og kodeeksempler.

## Resultat

Hva ble resultatet, og hva lærte du?
`,
  en: `## Background

Why did you make this? Who is it for?

## My role

What did you do yourself, and who did you work with?

## The challenge

What was hard, and what choices did you have to make?

## The solution

How did you solve it? Feel free to add screenshots and code samples.

## Result

What was the result, and what did you learn?
`,
};

const isImageFile = (f: File) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name);

// «dittprosjekt.no», «localhost:5173» eller «https://…» – det som ser ut som en nettside.
// Serveren avgjør om adressen er lov (lokale adresser bare under utvikling).
const looksLikeUrl = (text: string) => /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(text.trim());
const hostOf = (text: string) => text.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];

function base64ToFile(base64: string, name: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

// Bildene kommer først, som et rutenett av små miniatyrer. Limer man inn lenken til
// prosjektet, tar vi skjermbilder av siden og legger dem inn blant bildene, der de kan
// fjernes, flyttes og beskjæres som alle andre. Deretter tittel, teknologier, historien og teamet.
export default function ProjectForm({
  projectId,
  initial = empty,
  images: initialImages = [],
  maxImages,
  notice,
  tagSuggestions = [],
  selfUsername,
}: {
  projectId?: string;
  initial?: ProjectFormValues;
  images?: ExistingImage[];
  maxImages: number;
  notice?: string;
  tagSuggestions?: string[];
  // Den innloggede, så du ikke foreslås som medlem i ditt eget prosjekt.
  selfUsername?: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
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
  const [projectProgress, setProjectProgress] = useState(initial.progress);
  const [members, setMembers] = useState(initial.members);
  const [demoUrl, setDemoUrl] = useState(initial.demoUrl);
  const [capturing, setCapturing] = useState<{ host: string; count: number } | null>(null);
  const [editing, setEditing] = useState<{ key: string; url: string } | null>(null);
  const autoCaptured = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = Boolean(projectId);
  const room = maxImages - items.length - preparing - (capturing?.count ?? 0);
  const busy = pending || preparing > 0 || capturing !== null;

  // Rydd opp forhåndsvisningene (object-URL-er) når skjemaet lukkes.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((item) => item.kind === "new" && URL.revokeObjectURL(item.url)), []);

  async function addFiles(list: File[]) {
    const files = list.filter(isImageFile);
    if (files.length === 0) return toast.error("Det der var ikke et bilde. Bruk JPG, PNG, WebP eller GIF.");
    if (room <= 0) return toast.error(t("Et prosjekt kan ha maks {n} bilder.", { n: maxImages }));
    const chosen = files.slice(0, room);
    if (files.length > room) toast.info(t("Bare {room} bilder til fikk plass (maks {max}).", { room, max: maxImages }));

    setPreparing((n) => n + chosen.length);
    let last: { key: string; url: string } | null = null;
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file);
        last = { key: crypto.randomUUID(), url: URL.createObjectURL(prepared) };
        const item: Item = { kind: "new", key: last.key, file: prepared, url: last.url };
        setItems((prev) => [...prev, item]);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPreparing((n) => n - 1);
      }
    }
    // Ett bilde: åpne redigeringen med en gang. Flere: trykk på et bilde for å redigere det.
    if (chosen.length === 1 && last) setEditing(last);
    else if (chosen.length > 1) toast.info("Trykk på et bilde for å beskjære, rotere eller justere det.");
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

  // Skjermbilder av nettsiden. `auto`: startet av at lenken ble limt inn, ikke av knappen.
  async function capture(url: string, { auto = false } = {}) {
    const text = url.trim();
    if (capturing) return;
    if (!looksLikeUrl(text)) {
      if (!auto) toast.error("Skriv inn lenken til prosjektet først, f.eks. dittprosjekt.no.");
      return;
    }
    if (auto) {
      // Bare når skjemaet ikke har bilder ennå, og bare én gang per lenke.
      if (items.length > 0 || preparing > 0 || autoCaptured.current.has(text)) return;
      autoCaptured.current.add(text);
    }
    if (room <= 0) {
      if (!auto) toast.error(t("Et prosjekt kan ha maks {n} bilder.", { n: maxImages }));
      return;
    }

    const count = Math.min(room, 3);
    setCapturing({ host: hostOf(text), count });
    const result = await captureScreenshotsAction(text, count)
      .catch(() => ({ ok: false as const, error: t("Fikk ikke kontakt med serveren. Prøv igjen.") }))
      .finally(() => setCapturing(null));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Tittel og ingress fra siden, hvis feltene er tomme (f.eks. fra Dribbble, Behance eller Figma).
    const form = formRef.current;
    const fill = (name: string, value: string | null) => {
      const field = form?.elements.namedItem(name);
      if (value && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && !field.value.trim()) field.value = value;
    };
    fill("title", result.data.meta.title);
    fill("summary", result.data.meta.description);

    const added = result.data.shots.map((shot, i) => {
      const file = base64ToFile(shot.base64, `skjermbilde-${i + 1}.webp`, shot.type);
      return { kind: "new" as const, key: crypto.randomUUID(), file, url: URL.createObjectURL(file) };
    });
    setItems((prev) => [...prev, ...added].slice(0, maxImages));
    toast.success(added.length === 1 ? t("La til et skjermbilde") : t("La til {n} skjermbilder", { n: added.length }), {
      description: t("Trykk på et bilde for å redigere det."),
    });
  }

  // Redigert bilde erstatter det gamle på samme plass. Et lagret bilde slettes når skjemaet lagres.
  function replaceImage(key: string, file: File) {
    const item = items.find((i) => i.key === key);
    if (!item) return;
    if (item.kind === "new") URL.revokeObjectURL(item.url);
    else setRemovedIds((ids) => [...ids, item.id]);
    const next: Item = { kind: "new", key: crypto.randomUUID(), file, url: URL.createObjectURL(file) };
    setItems((prev) => prev.map((i) => (i.key === key ? next : i)));
    setEditing(null);
  }

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
    if (preparing > 0 || capturing) return toast.info("Vent litt, bildene gjøres klare.");
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
        setProgress(t("Laster opp bilde {i} av {total} …", { i: n + 1, total: fresh.length }));
        const fd = new FormData();
        fd.append("images", item.file);
        const uploaded = await uploadProjectImagesAction(id, fd);
        if (uploaded.ok && uploaded.data[0]) {
          const saved = uploaded.data[0];
          current = current.map((i) => (i.key === item.key ? { kind: "existing", key: item.key, id: saved.id, url: saved.url } : i));
          URL.revokeObjectURL(item.url);
        } else {
          failures.push(uploaded.ok ? t("ukjent feil") : uploaded.error);
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
        setError(
          failures.length === 1
            ? t("Prosjektet er lagret, men ett bilde ble ikke lagret: {reason} Trykk «Lagre» for å prøve igjen.", { reason: failures[0] })
            : t("Prosjektet er lagret, men {n} bilder ble ikke lagret: {reason} Trykk «Lagre» for å prøve igjen.", { n: failures.length, reason: failures[0] }),
        );
        return;
      }

      toast.success(isEdit ? t("Endringene er lagret") : status === "published" ? t("Prosjektet er publisert") : t("Utkastet er lagret"));
      router.push(`/prosjekt/${id}`);
      router.refresh();
    });
  }

  const err = (name: string) => errors[name]?.[0];

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
    <form ref={formRef} onSubmit={onSubmit} className="pb-4">
      {/* Lenken og bildene */}
      <section aria-label={t("Bilder")} className="space-y-4">
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

        <div className="rounded-[22px] glass-card p-4 sm:p-5">
          <label htmlFor="demoUrl" className="block text-sm font-medium text-fg">
            {t("Lenke til prosjektet")} <span className="font-normal text-mist">{t("valgfritt")}</span>
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
              <input
                id="demoUrl"
                name="demoUrl"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (looksLikeUrl(pasted) && !demoUrl.trim()) capture(pasted, { auto: true });
                }}
                onBlur={() => capture(demoUrl, { auto: true })}
                placeholder={t("dittprosjekt.no")}
                aria-invalid={Boolean(err("demoUrl")) || undefined}
                aria-describedby="demoUrl-hint"
                className={`${inputClass} pl-10`}
              />
            </div>
            <Button variant="secondary" onClick={() => capture(demoUrl)} loading={capturing !== null} disabled={room <= 0 && !capturing}>
              {!capturing && <Camera className="size-4" />}
              {capturing ? t("Tar skjermbilder …") : items.length > 0 ? t("Ta flere skjermbilder") : t("Ta skjermbilder")}
            </Button>
          </div>
          {err("demoUrl") ? (
            <FieldError>{err("demoUrl")}</FieldError>
          ) : (
            <p id="demoUrl-hint" className="mt-1.5 text-[13px] leading-5 text-mist">
              {t("Vi tar skjermbilder av siden for deg.")}
            </p>
          )}
        </div>

        {items.length === 0 && preparing === 0 && !capturing ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            {...dropHandlers}
            className={`group flex h-44 w-full flex-col items-center justify-center rounded-[24px] px-6 text-center ring-inset transition md:h-48 ${
              dragging ? "bg-sea/10 ring-2 ring-sea" : "bg-surface ring-1 ring-line hover:bg-surface-2"
            }`}
          >
            <span className="flex size-12 items-center justify-center rounded-full glass-chip text-fg transition group-hover:scale-105">
              <ImagePlus className="size-5" />
            </span>
            <span className="mt-3 text-lg font-semibold text-fg">{t("Legg til bilder")}</span>
            <span className="mt-1 text-sm text-mist">{t("Dra, klikk eller lim inn · maks {n}", { n: maxImages })}</span>
          </button>
        ) : (
          <div className="space-y-3" {...dropHandlers}>
            <div
              className={`grid grid-cols-2 gap-3 rounded-[22px] transition sm:grid-cols-3 lg:grid-cols-4 ${
                dragging ? "outline-2 outline-offset-4 outline-sea outline-dashed" : ""
              }`}
            >
              {items.map((item, index) => (
                <figure
                  key={item.key}
                  {...tileDrag(index)}
                  className={`glass-card group relative overflow-hidden rounded-[18px] ${index === 0 ? "ring-2 ring-sea" : ""} ${
                    dragIndex === index ? "opacity-40" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    onClick={() => setEditing({ key: item.key, url: item.url })}
                    className="aspect-[16/10] w-full cursor-pointer object-cover"
                  />
                  {index === 0 ? (
                    <span className="glass-dark absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      <Star className="size-3" /> {t("Forside")}
                    </span>
                  ) : (
                    <span className="glass-dark absolute left-2 top-2 cursor-grab rounded-full p-1.5 opacity-0 transition group-hover:opacity-100" aria-hidden="true">
                      <GripVertical className="size-3.5" />
                    </span>
                  )}
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                    {index > 0 ? (
                      <OverlayButton onClick={() => move(index, 0)} label={t("Gjør til forsidebilde")} icon={<Star className="size-3.5" />} />
                    ) : (
                      <span />
                    )}
                    <div className="flex gap-1">
                      {/* På mobil redigerer man ved å trykke på bildet, så knappene får plass. */}
                      <OverlayButton
                        onClick={() => setEditing({ key: item.key, url: item.url })}
                        label={t("Rediger")}
                        icon={<SlidersHorizontal className="size-3.5" />}
                        className="max-sm:hidden"
                      />
                      {index > 0 && <OverlayButton onClick={() => move(index, index - 1)} label={t("Flytt fremover")} icon={<ArrowLeft className="size-3.5" />} />}
                      {index < items.length - 1 && <OverlayButton onClick={() => move(index, index + 1)} label={t("Flytt bakover")} icon={<ArrowRight className="size-3.5" />} />}
                      <OverlayButton onClick={() => remove(index)} label={t("Fjern bildet")} icon={<X className="size-3.5" />} danger />
                    </div>
                  </div>
                </figure>
              ))}

              {Array.from({ length: preparing + (capturing?.count ?? 0) }, (_, i) => (
                <div key={`klargjor-${i}`} className="skeleton flex aspect-[16/10] items-center justify-center rounded-[18px]">
                  {capturing && <Camera className="size-5 animate-pulse text-mist" aria-hidden="true" />}
                </div>
              ))}

              {room > 0 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-[16/10] flex-col items-center justify-center rounded-[18px] bg-fill text-mist transition hover:bg-fill-2 hover:text-fg"
                >
                  <Plus className="size-5" />
                  <span className="mt-1 text-sm">{t("Legg til bilder")}</span>
                </button>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist">
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5" aria-hidden="true" /> {t("Første bilde er forsiden")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5" aria-hidden="true" /> {t("Trykk for å redigere")}
              </span>
              <span className="inline-flex items-center gap-1.5 max-sm:hidden">
                <GripVertical className="size-3.5" aria-hidden="true" /> {t("Dra for å sortere")}
              </span>
              {(capturing || preparing > 0) && (
                <span className="inline-flex items-center gap-1.5 text-fg">
                  <Camera className="size-3.5 animate-pulse" aria-hidden="true" />
                  {capturing ? t("Tar skjermbilder av {host} …", { host: capturing.host }) : t("Gjør klar bilder …")}
                </span>
              )}
            </p>
          </div>
        )}
      </section>

      {editing && (
        <ImageEditor key={editing.key} src={editing.url} onCancel={() => setEditing(null)} onSave={(file) => replaceImage(editing.key, file)} />
      )}

      {/* Tittel og kort om */}
      <section className="mt-10 space-y-4">
        <div>
          <label htmlFor="title" className="sr-only">
            {t("Tittel")}
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={100}
            defaultValue={initial.title}
            placeholder={t("Navn på prosjektet")}
            aria-invalid={Boolean(err("title")) || undefined}
            className="w-full border-b border-line bg-transparent pb-3 text-4xl font-bold tracking-[-0.03em] text-fg outline-none transition placeholder:text-mist/50 focus:border-sea md:text-5xl"
          />
          {err("title") && <FieldError>{err("title")}</FieldError>}
        </div>
        <div>
          <label htmlFor="summary" className="sr-only">
            {t("Kort beskrivelse")}
          </label>
          <input
            id="summary"
            name="summary"
            maxLength={200}
            defaultValue={initial.summary}
            placeholder={t("Én setning om hva det er og hvem det er for")}
            className="w-full bg-transparent text-xl text-fg outline-none placeholder:text-mist/60 md:text-2xl"
          />
          {err("summary") && <FieldError>{err("summary")}</FieldError>}
        </div>
      </section>

      <Section icon={<Layers />} title={t("Laget med")} description={t("Teknologier og verktøy.")}>
        <TagInput name="tags" defaultValue={initial.tags} suggestions={tagSuggestions} />
        {err("tags") && <FieldError>{err("tags")}</FieldError>}
      </Section>

      <Section icon={<BookOpen />} title={t("Historien")} description={t("Hva, hvorfor og hva du lærte.")}>
        <MarkdownEditor
          name="description"
          defaultValue={initial.description}
          placeholder={t("Skriv om prosjektet med markdown …")}
          maxLength={20_000}
          rows={12}
          template={CASE_TEMPLATE[locale]}
          templateLabel={t("Bruk case-mal")}
          invalid={Boolean(err("description"))}
        />
        {err("description") && <FieldError>{err("description")}</FieldError>}
      </Section>

      <Section icon={<SlidersHorizontal />} title={t("Detaljer")} description={t("Alt er valgfritt.")}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-medium text-fg">{t("Er prosjektet ferdig?")}</span>
            <input type="hidden" name="progress" value={projectProgress} />
            <Segmented
              label={t("Status")}
              value={projectProgress}
              onChange={setProjectProgress}
              options={(Object.keys(PROGRESS_LABELS) as ProjectProgress[]).map((key) => ({
                value: key,
                label: (
                  <span className="inline-flex items-center gap-2">
                    {key === "completed" ? (
                      <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <Hammer className="size-4 text-warn" aria-hidden="true" />
                    )}
                    {t(PROGRESS_LABELS[key])}
                  </span>
                ),
              }))}
            />
          </div>
          <div>
            <span className="mb-2 block text-sm font-medium text-fg">
              {projectProgress === "completed" ? t("Når ble det laget?") : t("Når startet du?")} <span className="font-normal text-mist/60">{t("valgfritt")}</span>
            </span>
            <MonthYear label={t("Dato")} value={projectDate} onChange={setProjectDate} />
            <input type="hidden" name="projectDate" value={projectDate} />
            {err("projectDate") && <FieldError>{err("projectDate")}</FieldError>}
          </div>
          <Field label={t("Din rolle")} optional error={err("role")}>
            <input name="role" defaultValue={initial.role} maxLength={80} placeholder={t("F.eks. design og frontend")} className={inputClass} />
          </Field>
          <Field label={t("Kode")} optional error={err("repoUrl")}>
            <span className="relative block">
              <CodeXml className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
              <input name="repoUrl" inputMode="url" defaultValue={initial.repoUrl} placeholder="github.com/…" className={`${inputClass} pl-10`} />
            </span>
          </Field>
          <Field label={t("Video eller prototype")} optional error={err("videoUrl")} className="md:col-span-2">
            <span className="relative block">
              <PlayCircle className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden="true" />
              <input
                name="videoUrl"
                inputMode="url"
                defaultValue={initial.videoUrl}
                placeholder={t("YouTube, Vimeo, Loom eller Figma")}
                className={`${inputClass} pl-10`}
              />
            </span>
          </Field>
        </div>
      </Section>

      <Section icon={<Users />} title={t("Teamet")} description={t("Folk du laget det sammen med.")}>
        <MemberPicker name="members" value={members} onChange={setMembers} exclude={selfUsername} max={MAX_PROJECT_MEMBERS} />
        {err("members") ? (
          <FieldError>{err("members")}</FieldError>
        ) : (
          members.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-mist">
              <Bell className="size-3.5 shrink-0" aria-hidden="true" />
              {t("De får et varsel når prosjektet publiseres, og vises på prosjektet og profilen sin.")}
            </p>
          )
        )}
      </Section>

      {error && (
        <p role="alert" className="mt-6 rounded-[18px] bg-danger/10 px-4 py-3 text-sm text-danger">
          {t(error)}
        </p>
      )}

      <div className="sticky bottom-24 z-20 mt-8 flex flex-wrap items-center justify-between gap-4 glass rounded-[26px] py-2 pl-5 pr-2 md:bottom-6">
        <input type="hidden" name="status" value={status} />
        <Segmented
          label={t("Synlighet")}
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            {
              value: "published",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="size-3.5" aria-hidden="true" /> {t("Publisert")}
                </span>
              ),
            },
            {
              value: "draft",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <PenLine className="size-3.5" aria-hidden="true" /> {t("Utkast")}
                </span>
              ),
            },
          ]}
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.back()}>
            {t("Avbryt")}
          </Button>
          <Button type="submit" loading={busy}>
            {progress ?? (pending ? t("Lagrer …") : isEdit || savedId ? t("Lagre") : status === "published" ? t("Publiser") : t("Lagre utkast"))}
          </Button>
        </div>
      </div>
    </form>
  );
}

function OverlayButton({
  onClick,
  label,
  icon,
  danger,
  className = "",
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`glass-dark flex size-8 items-center justify-center rounded-full transition active:scale-90 ${danger ? "hover:bg-danger" : "hover:bg-black/70"} ${className}`}
    >
      {icon}
    </button>
  );
}
