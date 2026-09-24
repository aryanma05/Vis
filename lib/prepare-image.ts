// Gjør et bilde klart for opplasting (bare i nettleseren): roterer det riktig, skalerer
// ned store mobil- og retinabilder og fjerner metadata (EXIF, bl.a. GPS-posisjonen der
// bildet ble tatt). Resultatet er som regel noen hundre kB, så opplastingen går raskt
// også på mobilnett. Serveren gjør det samme en gang til (lib/storage.ts).

export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_SIDE = 2400;
const MAX_GIF_BYTES = 5 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

const looksLikeHeic = (file: File) => /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

export async function prepareImage(file: File, { maxSide = MAX_SIDE }: { maxSide?: number } = {}): Promise<File> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`«${file.name}» er for stort (maks 40 MB).`);

  // Animerte GIF-er ville blitt stillbilder på et canvas, så de sendes som de er.
  if (file.type === "image/gif") {
    if (file.size > MAX_GIF_BYTES) throw new Error(`«${file.name}» er en for stor GIF (maks 5 MB).`);
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      looksLikeHeic(file)
        ? `«${file.name}» er et iPhone-bilde (HEIC) som nettleseren ikke kan lese. Åpne det i Bilder og del det som JPG, eller velg «Mest kompatibel» under Innstillinger → Kamera → Formater.`
        : `Klarte ikke å lese «${file.name}». Bruk JPG, PNG eller WebP.`,
    );
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP der nettleseren kan lage det. Ellers PNG for bilder som kan ha gjennomsiktighet
  // (logoer), og JPEG for resten.
  let blob = await toBlob(canvas, "image/webp", 0.9);
  if (blob?.type !== "image/webp") {
    blob = file.type === "image/png" ? await toBlob(canvas, "image/png") : await toBlob(canvas, "image/jpeg", 0.9);
  }
  if (!blob) throw new Error(`Klarte ikke å gjøre klar «${file.name}».`);

  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "bilde";
  return new File([blob], `${base}.${extension}`, { type: blob.type });
}

// Bredde og høyde på et bilde (brukes for CV-bilder, så siden får riktig form før den lastes).
export async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
