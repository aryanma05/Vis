// Gjør om sidene i en PDF til bilder i nettleseren (bare klient). Profilen viser
// bildene, så besøkende slipper å laste inn en PDF-leser.

export type RenderedPage = { blob: Blob; width: number; height: number };

const MAX_BYTES = 3.9 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

// WebP der nettleseren støtter det (Safari lager PNG i stedet), ellers JPEG.
async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", 0.92);
  if (webp?.type === "image/webp" && webp.size <= MAX_BYTES) return webp;
  for (const quality of [0.92, 0.85, 0.75]) {
    const jpeg = await toBlob(canvas, "image/jpeg", quality);
    if (jpeg && jpeg.size <= MAX_BYTES) return jpeg;
  }
  throw new Error("Siden ble for stor som bilde.");
}

export async function renderPdfPages(
  file: File,
  { width = 2000, maxPages = 6, onProgress }: { width?: number; maxPages?: number; onProgress?: (page: number, total: number) => void } = {},
): Promise<{ pages: RenderedPage[]; totalPages: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Egen worker per fil, så den kan avsluttes når vi er ferdige.
  const port = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    worker: pdfjs.PDFWorker.create({ port }),
  });

  const pdf = await task.promise.catch((error) => {
    port.terminate();
    throw error;
  });
  const total = Math.min(pdf.numPages, maxPages);
  const pages: RenderedPage[] = [];

  try {
    for (let i = 1; i <= total; i++) {
      onProgress?.(i, total);
      const page = await pdf.getPage(i);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      pages.push({ blob: await encode(canvas), width: canvas.width, height: canvas.height });
      page.cleanup();
    }
    return { pages, totalPages: pdf.numPages };
  } finally {
    await task.destroy();
    port.terminate();
  }
}

export async function imageSize(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
