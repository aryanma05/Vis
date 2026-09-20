"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createProjectAction,
  deleteProjectImageAction,
  reorderProjectImagesAction,
  updateProjectAction,
  uploadProjectImagesAction,
} from "@/app/actions/projects";
import { ui } from "@/components/ui";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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

export default function ProjectForm({
  projectId,
  initial = empty,
  images: initialImages = [],
  maxImages,
}: {
  projectId?: string;
  initial?: ProjectFormValues;
  images?: ExistingImage[];
  maxImages: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [images, setImages] = useState(initialImages);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const isEdit = Boolean(projectId);
  const slotsLeft = maxImages - images.length - newFiles.length;

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const files = [...list];
    const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) return setError(`«${tooBig.name}» er større enn 4 MB.`);
    if (files.length > slotsLeft) return setError(`Du kan legge til ${slotsLeft} bilder til.`);
    setError(null);
    setNewFiles((prev) => [...prev, ...files]);
  }

  async function uploadAll(id: string) {
    for (const file of newFiles) {
      const fd = new FormData();
      fd.append("images", file);
      const result = await uploadProjectImagesAction(id, fd);
      if (!result.ok) throw new Error(result.error);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("images");

    startTransition(async () => {
      setError(null);
      const result = isEdit ? await updateProjectAction(projectId!, formData) : await createProjectAction(formData);
      if (!result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      try {
        await uploadAll(result.data.id);
      } catch (e) {
        setError(`Prosjektet er lagret, men et bilde feilet: ${(e as Error).message}`);
        router.push(`/prosjekt/${result.data.id}/rediger`);
        return;
      }
      router.push(`/prosjekt/${result.data.id}`);
      router.refresh();
    });
  }

  function removeImage(imageId: string) {
    startTransition(async () => {
      const result = await deleteProjectImageAction(imageId);
      if (!result.ok) return setError(result.error);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    });
  }

  function makeCover(imageId: string) {
    const ordered = [...images].sort((a, b) => (a.id === imageId ? -1 : b.id === imageId ? 1 : 0));
    startTransition(async () => {
      const result = await reorderProjectImagesAction(projectId!, ordered.map((img) => img.id));
      if (!result.ok) return setError(result.error);
      setImages(ordered);
    });
  }

  const fieldError = (name: string) =>
    errors[name]?.length ? <p className={ui.fieldError}>{errors[name][0]}</p> : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className={ui.label}>
          Tittel
        </label>
        <input id="title" name="title" required maxLength={100} defaultValue={initial.title} className={ui.input} />
        {fieldError("title")}
      </div>

      <div>
        <label htmlFor="summary" className={ui.label}>
          Kort beskrivelse
        </label>
        <input
          id="summary"
          name="summary"
          maxLength={200}
          defaultValue={initial.summary}
          placeholder="Én setning som vises på prosjektkortet"
          className={ui.input}
        />
        {fieldError("summary")}
      </div>

      <div>
        <label htmlFor="description" className={ui.label}>
          Beskrivelse
        </label>
        <textarea
          id="description"
          name="description"
          rows={10}
          defaultValue={initial.description}
          placeholder="Hva er prosjektet, hvorfor laget du det, og hva lærte du? Markdown støttes."
          className={`${ui.input} font-mono text-sm`}
        />
        <p className={ui.hint}>Vises som en README. Markdown støttes (# overskrifter, **fet**, lister, lenker).</p>
        {fieldError("description")}
      </div>

      <div>
        <label htmlFor="tags" className={ui.label}>
          Teknologier
        </label>
        <input id="tags" name="tags" defaultValue={initial.tags} placeholder="React, TypeScript, Supabase" className={ui.input} />
        <p className={ui.hint}>Skill med komma.</p>
        {fieldError("tags")}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="repoUrl" className={ui.label}>
            GitHub-lenke
          </label>
          <input id="repoUrl" name="repoUrl" type="url" defaultValue={initial.repoUrl} placeholder="https://github.com/…" className={ui.input} />
          {fieldError("repoUrl")}
        </div>
        <div>
          <label htmlFor="demoUrl" className={ui.label}>
            Demo-lenke
          </label>
          <input id="demoUrl" name="demoUrl" type="url" defaultValue={initial.demoUrl} placeholder="https://…" className={ui.input} />
          {fieldError("demoUrl")}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
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
        <div>
          <label htmlFor="status" className={ui.label}>
            Synlighet
          </label>
          <select id="status" name="status" defaultValue={initial.status} className={ui.input}>
            <option value="published">Publisert – alle kan se det</option>
            <option value="draft">Utkast – bare du ser det</option>
          </select>
        </div>
      </div>

      <div>
        <p className={ui.label}>Bilder</p>
        <p className={ui.hint}>Det første bildet blir forsidebildet. Maks {maxImages} bilder, 4 MB hver.</p>

        {(images.length > 0 || newFiles.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {images.map((img, i) => (
              <div key={img.id} className="overflow-hidden rounded-xl border border-line bg-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt ?? ""} className="aspect-video w-full object-cover" />
                <div className="flex justify-between gap-2 p-2 text-xs">
                  {i === 0 ? (
                    <span className="text-ice">Forsidebilde</span>
                  ) : (
                    <button type="button" onClick={() => makeCover(img.id)} disabled={pending} className="text-mist hover:text-fg">
                      Gjør til forside
                    </button>
                  )}
                  <button type="button" onClick={() => removeImage(img.id)} disabled={pending} className="text-red-300 hover:text-red-200">
                    Fjern
                  </button>
                </div>
              </div>
            ))}
            {newFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="overflow-hidden rounded-xl border border-dashed border-line bg-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="aspect-video w-full object-cover opacity-80" />
                <div className="flex justify-between gap-2 p-2 text-xs">
                  <span className="truncate text-mist">Ny</span>
                  <button
                    type="button"
                    onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-red-300 hover:text-red-200"
                  >
                    Fjern
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {slotsLeft > 0 && (
          <input
            type="file"
            name="images"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            onChange={(e) => {
              pickFiles(e.target.files);
              e.target.value = "";
            }}
            className="mt-3 block w-full text-sm text-mist file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-on-primary"
          />
        )}
      </div>

      {error && <p className={ui.error}>{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={ui.primary}>
          {pending ? "Lagrer…" : isEdit ? "Lagre endringer" : "Opprett prosjekt"}
        </button>
        <button type="button" onClick={() => router.back()} className={ui.secondary}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
