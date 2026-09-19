"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { applyCvImport, cvInput, discardCvImport, importCv, saveCv } from "@/lib/cv";
import {
  addCvPage,
  deleteCvDocument,
  parseStoredCv,
  setCvDocumentVisibility,
  uploadCvDocument,
} from "@/lib/cv-document";
import { fail, UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { fieldErrors, parsedCv, type ParsedCv } from "@/lib/validation";

// Skjemafelt: file (PDF, .docx eller bilde, maks 4 MB). Returnerer et utkast til gjennomgang.
export async function importCvAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Velg en fil.");
    return importCv(user.id, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  });
}

export async function applyCvImportAction(
  importId: string,
  options: { mode?: "replace" | "merge"; edited?: ParsedCv } = {},
) {
  if (options.edited && !parsedCv.safeParse(options.edited).success) return fail("Ugyldig CV-utkast.");

  return runAction(async () => {
    const user = await requireUserForAction();
    await applyCvImport(user.id, importId, {
      mode: options.mode === "merge" ? "merge" : "replace",
      edited: options.edited,
    });
    revalidatePath(`/profil/${user.username}`);
  });
}

export async function discardCvImportAction(importId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await discardCvImport(user.id, importId);
  });
}

// Manuell redigering: sender hele CV-en (erfaring, utdanning, ferdigheter).
export async function saveCvAction(cv: unknown) {
  const parsed = cvInput.safeParse(cv);
  if (!parsed.success) return fail("Sjekk feltene i CV-en.", fieldErrors(parsed.error));

  return runAction(async () => {
    const user = await requireUserForAction();
    await saveCv(user.id, parsed.data);
    revalidatePath(`/profil/${user.username}`);
  });
}

/* -------------------------------------------------------------------------- */
/*  CV-dokumentet som vises på profilen                                       */
/* -------------------------------------------------------------------------- */

const size = (formData: FormData) => ({
  width: Number(formData.get("width")) || 0,
  height: Number(formData.get("height")) || 0,
});

// Skjemafelt: file (PDF eller bilde), width/height (for bilder).
export async function uploadCvDocumentAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Velg en fil.");
    const result = await uploadCvDocument(user.id, file, size(formData));
    revalidatePath(`/profil/${user.username}`);
    return result;
  });
}

// Skjemafelt: page (bilde av én PDF-side), index, width, height.
export async function addCvPageAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const page = formData.get("page");
    if (!(page instanceof File)) throw new UserFacingError("Mangler side.");
    const result = await addCvPage(user.id, Number(formData.get("index")), page, size(formData));
    revalidatePath(`/profil/${user.username}`);
    return result;
  });
}

export async function setCvVisibilityAction(isPublic: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setCvDocumentVisibility(user.id, Boolean(isPublic));
    revalidatePath(`/profil/${user.username}`);
  });
}

export async function deleteCvDocumentAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteCvDocument(user.id);
    revalidatePath(`/profil/${user.username}`);
  });
}

// Leser den opplastede CV-en og returnerer et utkast til skjemaet.
export async function parseStoredCvAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    return parseStoredCv(user.id);
  });
}
