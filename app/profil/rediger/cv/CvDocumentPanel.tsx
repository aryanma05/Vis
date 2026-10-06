"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp, ScanText, Trash2 } from "lucide-react";
import { addCvPageAction, deleteCvDocumentAction, setCvVisibilityAction, uploadCvDocumentAction } from "@/app/actions/cv";
import { useT } from "@/components/LocaleProvider";
import { Button, Spinner } from "@/components/ui/button";
import Switch from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
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
  const t = useT();
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
    if (!isPdf && !isImage) return setError(t("Last opp en PDF eller et bilde (JPG, PNG, WebP)."));
    // Bilder krympes før opplasting, så grensen gjelder bare PDF-er.
    if (isPdf && file.size > MAX_BYTES) return setError(t("PDF-en er større enn 4 MB. Prøv å eksportere den på nytt med lavere kvalitet."));

    try {
      if (isPdf) {
        setStatus(t("Leser PDF-en …"));
        const { pages, totalPages } = await renderPdfPages(file, {
          onProgress: (i, total) => setStatus(t("Lager bilde av side {i} av {total} …", { i, total })),
        });

        setStatus(t("Laster opp …"));
        const fd = new FormData();
        fd.append("file", file);
        const uploaded = await uploadCvDocumentAction(fd);
        if (!uploaded.ok) throw new Error(uploaded.error);

        const stored: NonNullable<DocState>["pages"] = [];
        for (const [index, page] of pages.entries()) {
          setStatus(t("Laster opp side {i} av {total} …", { i: index + 1, total: pages.length }));
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
        if (totalPages > pages.length) setError(t("Vi viser de {n} første sidene av {total}.", { n: pages.length, total: totalPages }));
      } else {
        setStatus(t("Gjør klar bildet …"));
        const prepared = await prepareImage(file);
        const size = await imageDimensions(prepared);
        setStatus(t("Laster opp …"));
        const fd = new FormData();
        fd.append("file", prepared);
        fd.append("width", String(size.width));
        fd.append("height", String(size.height));
        const uploaded = await uploadCvDocumentAction(fd);
        if (!uploaded.ok) throw new Error(uploaded.error);
        setDoc({ fileUrl: uploaded.data.url, fileName: file.name, mimeType: prepared.type, pages: [{ url: uploaded.data.url, ...size }], isPublic: doc?.isPublic ?? true });
      }
      toast.success("CV-en er lastet opp", isPdf ? { description: "Trykk «Fyll ut feltene» for å hente ut innholdet." } : undefined);
      router.refresh();
    } catch (e) {
      setError(t((e as Error).message || "Noe gikk galt med opplastingen."));
    } finally {
      setStatus(null);
    }
  }

  async function toggleVisibility(next: boolean) {
    if (!doc) return;
    setDoc({ ...doc, isPublic: next });
    const result = await setCvVisibilityAction(next);
    if (!result.ok) {
      setDoc({ ...doc, isPublic: !next });
      toast.error(result.error);
    }
  }

  async function remove() {
    if (!confirm(t("Fjerne CV-dokumentet fra profilen?"))) return;
    setStatus(t("Fjerner …"));
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
          className={`flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition ${
            dragging ? "border-sea bg-sea/10" : "border-line hover:border-mist/60"
          }`}
        >
          {busy ? (
            <>
              <Spinner className="size-6 text-ice" />
              <span className="mt-4 text-mist">{status}</span>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-full glass-chip text-fg">
                <FileUp className="size-5" />
              </span>
              <span className="mt-4 text-lg font-semibold">{t("Slipp CV-en her")}</span>
              <span className="mt-1 text-sm text-mist">{t("eller klikk for å velge · PDF (maks 4 MB) eller bilde")}</span>
            </>
          )}
        </button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {picker}
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {doc.pages.map((page, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={page.url}
            src={page.url}
            alt={t("Side {n}", { n: i + 1 })}
            className="h-56 w-auto shrink-0 rounded-[3px] bg-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)] ring-1 ring-black/10"
          />
        ))}
        {doc.pages.length === 0 && <p className="text-sm text-warn">{t("Sidene ble ikke laget ferdig. Last opp filen på nytt.")}</p>}
      </div>

      <p className="mt-4 truncate text-sm text-mist">{doc.fileName}</p>

      <div className="mt-5 max-w-sm">
        <Switch
          checked={doc.isPublic}
          onChange={toggleVisibility}
          label={doc.isPublic ? t("Synlig på profilen") : t("Skjult for andre")}
          description={t("Besøkende kan se og laste ned CV-dokumentet når det er synlig.")}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* Tekst kan bare leses fra PDF-er; et bilde av CV-en vises bare på profilen. */}
        {doc.mimeType === "application/pdf" && (
          <Button size="sm" onClick={onAutofill} loading={autofilling}>
            <ScanText className="size-4" /> {autofilling ? t("Leser CV-en …") : t("Fyll ut feltene fra CV-en")}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
          {t("Bytt fil")}
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} className="hover:text-danger">
          <Trash2 className="size-4" /> {t("Fjern")}
        </Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-mist/70">{t("Fjern gjerne telefonnummer og adresse fra CV-en hvis du ikke vil dele dem med alle.")}</p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
