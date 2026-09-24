"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  addCvPageAction,
  deleteCvDocumentAction,
  setCvVisibilityAction,
  uploadCvDocumentAction,
} from "@/app/actions/cv";
import { renderPdfPages } from "@/lib/pdf-pages";
import { imageDimensions, prepareImage } from "@/lib/prepare-image";

export type DocState = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  pages: { url: string; width: number; height: number }[];
  isPublic: boolean;
} | null;

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = "application/pdf,image/*";

export default function CvDocumentPanel({
  initial,
  onAutofill,
  autofilling,
}: {
  initial: DocState;
  onAutofill: () => void;
  autofilling: boolean;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status !== null;

  async function handleFile(file: File) {
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.hei[cf]$/i.test(file.name);
    if (!isPdf && !isImage) return setError("Last opp en PDF eller et bilde (JPG, PNG, WebP).");
    // Bilder krympes før opplasting, så grensen gjelder bare PDF-er.
    if (isPdf && file.size > MAX_BYTES) return setError("PDF-en er større enn 4 MB. Prøv å eksportere den på nytt med lavere kvalitet.");

    try {
      if (isPdf) {
        setStatus("Leser PDF-en…");
        const { pages, totalPages } = await renderPdfPages(file, {
          onProgress: (i, total) => setStatus(`Lager bilde av side ${i} av ${total}…`),
        });

        setStatus("Laster opp…");
        const fd = new FormData();
        fd.append("file", file);
        const uploaded = await uploadCvDocumentAction(fd);
        if (!uploaded.ok) throw new Error(uploaded.error);

        const stored: NonNullable<DocState>["pages"] = [];
        for (const [index, page] of pages.entries()) {
          setStatus(`Laster opp side ${index + 1} av ${pages.length}…`);
          const pageData = new FormData();
          pageData.append("page", new File([page.blob], `side-${index + 1}`, { type: page.blob.type }));
          pageData.append("index", String(index));
          pageData.append("width", String(page.width));
          pageData.append("height", String(page.height));
          const result = await addCvPageAction(pageData);
          if (!result.ok) throw new Error(result.error);
          stored.push(result.data);
        }

        setDoc({ fileUrl: uploaded.data.url, fileName: file.name, mimeType: "application/pdf", pages: stored, isPublic: doc?.isPublic ?? true });
        if (totalPages > pages.length) setError(`Vi viser de ${pages.length} første sidene av ${totalPages}.`);
      } else {
        setStatus("Gjør klar bildet…");
        const prepared = await prepareImage(file);
        const size = await imageDimensions(prepared);
        setStatus("Laster opp…");
        const fd = new FormData();
        fd.append("file", prepared);
        fd.append("width", String(size.width));
        fd.append("height", String(size.height));
        const uploaded = await uploadCvDocumentAction(fd);
        if (!uploaded.ok) throw new Error(uploaded.error);
        setDoc({
          fileUrl: uploaded.data.url,
          fileName: file.name,
          mimeType: prepared.type,
          pages: [{ url: uploaded.data.url, ...size }],
          isPublic: doc?.isPublic ?? true,
        });
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Noe gikk galt med opplastingen.");
    } finally {
      setStatus(null);
    }
  }

  async function toggleVisibility() {
    if (!doc) return;
    const next = !doc.isPublic;
    setDoc({ ...doc, isPublic: next });
    const result = await setCvVisibilityAction(next);
    if (!result.ok) {
      setDoc({ ...doc, isPublic: !next });
      setError(result.error);
    }
  }

  async function remove() {
    if (!confirm("Fjerne CV-dokumentet fra profilen?")) return;
    setStatus("Fjerner…");
    const result = await deleteCvDocumentAction();
    setStatus(null);
    if (!result.ok) return setError(result.error);
    setDoc(null);
    router.refresh();
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = "";
      }}
    />
  );

  if (!doc || busy) {
    return (
      <div>
        {picker}
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center transition ${
            dragging ? "border-primary bg-primary/5" : "border-line hover:border-mist/60"
          }`}
        >
          {busy ? (
            <>
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ice" />
              <span className="mt-4 text-mist">{status}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-medium">Slipp CV-en her</span>
              <span className="mt-1.5 text-sm text-mist">eller klikk for å velge. PDF (maks 4 MB) eller bilde.</span>
            </>
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {picker}
      <div className="flex gap-5 overflow-x-auto pb-2">
        {doc.pages.map((page, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={page.url}
            src={page.url}
            alt={`Side ${i + 1}`}
            className="h-64 w-auto shrink-0 rounded-[2px] bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)] ring-1 ring-black/10"
          />
        ))}
        {doc.pages.length === 0 && (
          <p className="text-sm text-amber-200">Sidene ble ikke laget ferdig. Last opp filen på nytt.</p>
        )}
      </div>

      <p className="mt-4 truncate text-sm text-mist">{doc.fileName}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={doc.isPublic}
          onClick={toggleVisibility}
          className="mr-2 inline-flex items-center gap-3 text-sm"
        >
          <span className={`relative h-6 w-11 rounded-full transition ${doc.isPublic ? "bg-primary" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${doc.isPublic ? "left-[22px]" : "left-0.5"}`} />
          </span>
          {doc.isPublic ? "Synlig på profilen" : "Skjult for andre"}
        </button>
        <button
          type="button"
          onClick={onAutofill}
          disabled={autofilling}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-60"
        >
          {autofilling ? "Leser CV-en…" : "Fyll ut feltene fra CV-en"}
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-line px-4 py-2 text-sm transition hover:border-primary">
          Bytt fil
        </button>
        <button type="button" onClick={remove} className="rounded-lg px-3 py-2 text-sm text-mist hover:text-red-300">
          Fjern
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-mist/60">
        CV-en blir synlig for alle som besøker profilen din når den er slått på. Fjern gjerne telefonnummer og adresse
        hvis du ikke vil dele dem.
      </p>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
