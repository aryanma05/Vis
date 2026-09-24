import "server-only";

import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { UserFacingError } from "@/lib/result";

// Hvor filene havner:
// - Vercel Blob når BLOB_READ_WRITE_TOKEN er satt.
// - Ellers i databasen (tabellen stored_file), servert fra /filer/<key> av
//   app/filer/[...key]/route.ts. Render har ingen varig disk på gratisnivået, så
//   databasen er det eneste stedet som overlever en omstart der.
// Eldre filer fra lokal utvikling (public/uploads, nøkler som starter med "local:")
// kan fortsatt leses og slettes.

// Hva vi tar imot. Bildene krympes etterpå (se processImage), så det som lagres er mye mindre.
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;

// Største bredde/høyde vi lagrer. Nok til å se skarpt ut i fullskjerm på en stor skjerm.
const MAX_IMAGE_SIDE = 2400;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;

type ImageType = keyof typeof IMAGE_TYPES;

const LOCAL_PREFIX = "local:";
const DB_PREFIX = "db:";
export const FILE_URL_PREFIX = "/filer/";
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

const { storedFile } = schema;

const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Sjekker de første bytene i filen i stedet for å stole på filnavn/MIME fra nettleseren.
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}

// iPhone-bilder (HEIC) kan ikke vises i de fleste nettlesere, så de må konverteres først.
function isHeic(bytes: Uint8Array) {
  const brand = String.fromCharCode(...bytes.slice(4, 12));
  return /^ftyp(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand);
}

export function isPdf(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

export type StoredFile = { url: string; key: string; contentType?: string };

// ownerId: brukeren filen tilhører (slettes sammen med kontoen).
// isPrivate: vises bare for eieren (gjelder filer lagret i databasen).
export type StoreOptions = { ownerId: string; isPrivate?: boolean };

type Sharp = (typeof import("sharp"))["default"];
let sharpModule: Promise<Sharp | null> | null = null;
const loadSharp = () =>
  (sharpModule ??= import("sharp")
    .then((m) => m.default)
    .catch((error) => {
      console.warn("[storage] sharp er ikke tilgjengelig, bilder lagres uendret:", error);
      return null;
    }));

// Roterer riktig, skalerer ned store bilder og fjerner metadata (EXIF med bl.a.
// GPS-posisjon, kameramodell og tidspunkt). Resultatet lagres som WebP.
// Animerte GIF-er beholdes som de er.
async function processImage(bytes: Uint8Array, type: ImageType): Promise<{ bytes: Uint8Array; type: ImageType }> {
  if (type === "image/gif") {
    if (bytes.byteLength > MAX_GIF_BYTES) throw new UserFacingError("GIF-en er for stor (maks 5 MB).");
    return { bytes, type };
  }

  const sharp = await loadSharp();
  if (!sharp) return { bytes, type };

  try {
    const output = await sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, smartSubsample: true })
      .toBuffer();
    return { bytes: new Uint8Array(output), type: "image/webp" };
  } catch (error) {
    console.error("[storage] kunne ikke behandle bildet", error);
    throw new UserFacingError("Klarte ikke å lese bildet. Prøv å lagre det som JPG eller PNG først.");
  }
}

export async function storeImage(file: File, folder: string, options: StoreOptions): Promise<StoredFile> {
  if (file.size === 0) throw new UserFacingError("Bildet er tomt.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UserFacingError(`Bildet er for stort (maks ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    throw new UserFacingError(
      isHeic(bytes)
        ? "iPhone-bilder i HEIC-format støttes ikke. Ta et skjermbilde av bildet eller eksporter det som JPG."
        : "Filtypen støttes ikke. Bruk JPG, PNG, WebP, GIF eller AVIF.",
    );
  }

  const image = await processImage(bytes, type);
  return storeBytes(image.bytes, image.type, `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[image.type]}`, options);
}

export async function storePdf(file: File, folder: string, options: StoreOptions): Promise<StoredFile> {
  if (file.size === 0) throw new UserFacingError("Filen er tom.");
  if (file.size > MAX_PDF_BYTES) throw new UserFacingError("Filen er for stor (maks 4 MB).");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) throw new UserFacingError("Filen er ikke en PDF.");
  return storeBytes(bytes, "application/pdf", `${folder}/${crypto.randomUUID()}.pdf`, options);
}

async function storeBytes(
  bytes: Uint8Array,
  type: string,
  name: string,
  { ownerId, isPrivate = false }: StoreOptions,
): Promise<StoredFile> {
  if (blobConfigured()) {
    const blob = await put(name, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: blob.url, key: blob.pathname, contentType: type };
  }

  await db.insert(storedFile).values({
    key: name,
    ownerId,
    contentType: type,
    size: bytes.byteLength,
    isPrivate,
    data: Buffer.from(bytes),
  });
  return { url: `${FILE_URL_PREFIX}${name}`, key: `${DB_PREFIX}${name}`, contentType: type };
}

// Brukes av /filer/[...key].
export async function getStoredFile(key: string) {
  const [row] = await db.select().from(storedFile).where(eq(storedFile.key, key)).limit(1);
  return row ?? null;
}

// Leser en fil vi selv har lagret (brukes f.eks. når CV-en skal tolkes på nytt).
export async function readStoredFile(file: StoredFile): Promise<Uint8Array> {
  if (file.key.startsWith(DB_PREFIX)) {
    const row = await getStoredFile(file.key.slice(DB_PREFIX.length));
    if (!row) throw new Error(`Fant ikke ${file.key}`);
    return new Uint8Array(row.data);
  }
  if (file.key.startsWith(LOCAL_PREFIX)) {
    return new Uint8Array(await readFile(path.join(LOCAL_DIR, file.key.slice(LOCAL_PREFIX.length))));
  }
  const res = await fetch(file.url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Kunne ikke hente ${file.key}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Finner lagringsnøkkelen for en URL vi selv har lagret, ellers null.
export function storageKeyFromUrl(url: string): string | null {
  if (url.startsWith(FILE_URL_PREFIX)) return `${DB_PREFIX}${url.slice(FILE_URL_PREFIX.length)}`;
  if (url.startsWith("/uploads/")) return `${LOCAL_PREFIX}${url.slice("/uploads/".length)}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return parsed.pathname.slice(1);
  } catch {}
  return null;
}

const dbKeys = (keys: string[]) => keys.filter((k) => k.startsWith(DB_PREFIX)).map((k) => k.slice(DB_PREFIX.length));

// Skjuler eller viser filer lagret i databasen (f.eks. når CV-en gjøres privat).
export async function setStoredFilesPrivate(keys: string[], isPrivate: boolean) {
  const inDb = dbKeys(keys);
  if (inDb.length === 0) return;
  await db.update(storedFile).set({ isPrivate }).where(inArray(storedFile.key, inDb));
}

export async function deleteStoredFiles(keys: (string | null | undefined)[]) {
  const valid = keys.filter((k): k is string => Boolean(k));
  const inDb = dbKeys(valid);
  const local = valid.filter((k) => k.startsWith(LOCAL_PREFIX));
  const remote = valid.filter((k) => !k.startsWith(LOCAL_PREFIX) && !k.startsWith(DB_PREFIX));

  await Promise.all([
    inDb.length > 0 ? db.delete(storedFile).where(inArray(storedFile.key, inDb)) : null,
    remote.length > 0 && blobConfigured() ? del(remote) : null,
    ...local.map((k) =>
      unlink(path.join(LOCAL_DIR, k.slice(LOCAL_PREFIX.length))).catch(() => {}),
    ),
  ]);
}
