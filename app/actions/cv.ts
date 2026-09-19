"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { applyCvImport, cvInput, discardCvImport, importCv, saveCv } from "@/lib/cv";
import { fail, UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { fieldErrors, parsedCv, type ParsedCv } from "@/lib/validation";

// Skjemafelt: file (PDF eller .docx, maks 4 MB). Returnerer et utkast til gjennomgang.
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
