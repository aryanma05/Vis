import "server-only";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CvPage } from "@/db/schema";
import { importCv } from "@/lib/cv";
import { UserFacingError } from "@/lib/result";
import {
  deleteStoredFiles,
  isPdf,
  readStoredFile,
  setStoredFilesPrivate,
  type StoredFile,
  sniffImageType,
  storeImage,
  storePdf,
} from "@/lib/storage";

const { cvDocument } = schema;

export const MAX_CV_PAGES = 6;

export type CvDocument = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  pages: CvPage[];
  isPublic: boolean;
  updatedAt: Date;
};

// Skjult CV vises bare for eieren.
export async function getCvDocument(userId: string, viewerId?: string | null): Promise<CvDocument | null> {
  const [row] = await db.select().from(cvDocument).where(eq(cvDocument.userId, userId)).limit(1);
  if (!row) return null;
  if (!row.isPublic && viewerId !== userId) return null;
  return {
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    pages: row.pages,
    isPublic: row.isPublic,
    updatedAt: row.updatedAt,
  };
}

const clampSize = (n: number) => Math.min(Math.max(Math.round(Number(n) || 0), 1), 10_000);

function allKeys(row: { fileKey: string; pages: CvPage[] }) {
  return [...new Set([row.fileKey, ...row.pages.map((p) => p.key)])];
}

// Laster opp originalen (PDF eller bilde) og erstatter en eventuell tidligere CV.
// Et bilde er sin egen side. For PDF sender nettleseren sidene etterpå med addCvPage.
export async function uploadCvDocument(
  userId: string,
  file: File,
  imageSize?: { width: number; height: number },
) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const folder = `cv/${userId}`;
  const [previous] = await db.select().from(cvDocument).where(eq(cvDocument.userId, userId)).limit(1);
  // En ny CV arver synligheten til den forrige (ny CV er synlig som standard).
  const options = { ownerId: userId, isPrivate: previous ? !previous.isPublic : false };

  let stored: StoredFile;
  let pages: CvPage[] = [];
  let mimeType: string;

  if (isPdf(head)) {
    stored = await storePdf(file, folder, options);
    mimeType = "application/pdf";
  } else if (sniffImageType(head)) {
    stored = await storeImage(file, folder, options);
    // Bildet er gjort om (se lib/storage.ts), så typen kan være en annen enn originalen.
    mimeType = stored.contentType ?? sniffImageType(head)!;
    pages = [
      { url: stored.url, key: stored.key, width: clampSize(imageSize?.width ?? 1600), height: clampSize(imageSize?.height ?? 2263) },
    ];
  } else {
    throw new UserFacingError("Last opp CV-en som PDF eller bilde (JPG, PNG, WebP).");
  }

  const values = {
    fileUrl: stored.url,
    fileKey: stored.key,
    fileName: file.name.slice(0, 200) || "cv",
    mimeType,
    pages,
  };
  await db
    .insert(cvDocument)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: cvDocument.userId, set: values });

  if (previous) await deleteStoredFiles(allKeys(previous));
  return { mimeType, url: stored.url };
}

// Én side av en PDF, ferdig gjort om til bilde i nettleseren.
export async function addCvPage(userId: string, index: number, file: File, size: { width: number; height: number }) {
  const [row] = await db.select().from(cvDocument).where(eq(cvDocument.userId, userId)).limit(1);
  if (!row || row.mimeType !== "application/pdf") throw new UserFacingError("Last opp CV-en først.");
  if (!Number.isInteger(index) || index < 0 || index >= MAX_CV_PAGES) {
    throw new UserFacingError(`Vi viser maks ${MAX_CV_PAGES} sider.`);
  }

  const stored = await storeImage(file, `cv/${userId}`, { ownerId: userId, isPrivate: !row.isPublic });
  const page = { url: stored.url, key: stored.key, width: clampSize(size.width), height: clampSize(size.height) };

  const pages = [...row.pages];
  const replaced = pages[index];
  pages[index] = page;
  await db.update(cvDocument).set({ pages: pages.filter(Boolean) }).where(eq(cvDocument.userId, userId));
  if (replaced) await deleteStoredFiles([replaced.key]);
  return page;
}

export async function setCvDocumentVisibility(userId: string, isPublic: boolean) {
  const [row] = await db
    .update(cvDocument)
    .set({ isPublic })
    .where(eq(cvDocument.userId, userId))
    .returning({ fileKey: cvDocument.fileKey, pages: cvDocument.pages });
  // En skjult CV skal heller ikke kunne åpnes med en gammel lenke til filen.
  if (row) await setStoredFilesPrivate(allKeys(row), !isPublic);
}

export async function deleteCvDocument(userId: string) {
  const [row] = await db.select().from(cvDocument).where(eq(cvDocument.userId, userId)).limit(1);
  if (!row) return;
  await db.delete(cvDocument).where(eq(cvDocument.userId, userId));
  await deleteStoredFiles(allKeys(row));
}

// Leser den opplastede CV-en med språkmodellen, så feltene kan fylles ut automatisk.
export async function parseStoredCv(userId: string) {
  const [row] = await db.select().from(cvDocument).where(eq(cvDocument.userId, userId)).limit(1);
  if (!row) throw new UserFacingError("Last opp CV-en først.");
  const bytes = await readStoredFile({ url: row.fileUrl, key: row.fileKey });
  return importCv(userId, { name: row.fileName, type: row.mimeType, bytes });
}
