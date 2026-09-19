import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { UserFacingError } from "@/lib/result";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;

type ImageType = keyof typeof IMAGE_TYPES;

const LOCAL_PREFIX = "local:";
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

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

export function isPdf(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

export type StoredFile = { url: string; key: string };

export async function storeImage(file: File, folder: string): Promise<StoredFile> {
  if (file.size === 0) throw new UserFacingError("Bildet er tomt.");
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UserFacingError("Bildet er for stort (maks 4 MB).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    throw new UserFacingError("Filtypen støttes ikke. Bruk JPG, PNG, WebP, GIF eller AVIF.");
  }

  return storeBytes(bytes, type, `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`);
}

export async function storePdf(file: File, folder: string): Promise<StoredFile> {
  if (file.size === 0) throw new UserFacingError("Filen er tom.");
  if (file.size > MAX_IMAGE_BYTES) throw new UserFacingError("Filen er for stor (maks 4 MB).");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) throw new UserFacingError("Filen er ikke en PDF.");
  return storeBytes(bytes, "application/pdf", `${folder}/${crypto.randomUUID()}.pdf`);
}

// Leser en fil vi selv har lagret (brukes f.eks. når CV-en skal tolkes på nytt).
export async function readStoredFile(file: StoredFile): Promise<Uint8Array> {
  if (file.key.startsWith(LOCAL_PREFIX)) {
    return new Uint8Array(await readFile(path.join(LOCAL_DIR, file.key.slice(LOCAL_PREFIX.length))));
  }
  const res = await fetch(file.url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Kunne ikke hente ${file.key}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function storeBytes(bytes: Uint8Array, type: string, name: string): Promise<StoredFile> {
  if (blobConfigured()) {
    const blob = await put(name, Buffer.from(bytes), {
      access: "public",
      contentType: type,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: blob.url, key: blob.pathname };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BLOB_READ_WRITE_TOKEN mangler i produksjon.");
  }

  // Lokal utvikling uten Vercel Blob: lagre i public/uploads.
  const target = path.join(LOCAL_DIR, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { url: `/uploads/${name}`, key: `${LOCAL_PREFIX}${name}` };
}

// Finner lagringsnøkkelen for en URL vi selv har lagret, ellers null.
export function storageKeyFromUrl(url: string): string | null {
  if (url.startsWith("/uploads/")) return `${LOCAL_PREFIX}${url.slice("/uploads/".length)}`;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return parsed.pathname.slice(1);
  } catch {}
  return null;
}

export async function deleteStoredFiles(keys: (string | null | undefined)[]) {
  const valid = keys.filter((k): k is string => Boolean(k));
  const local = valid.filter((k) => k.startsWith(LOCAL_PREFIX));
  const remote = valid.filter((k) => !k.startsWith(LOCAL_PREFIX));

  await Promise.all([
    remote.length > 0 && blobConfigured() ? del(remote) : null,
    ...local.map((k) =>
      unlink(path.join(LOCAL_DIR, k.slice(LOCAL_PREFIX.length))).catch(() => {}),
    ),
  ]);
}
