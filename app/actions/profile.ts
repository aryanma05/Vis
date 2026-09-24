"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { CV_TEMPLATES, type CvTemplate } from "@/lib/constants";
import { setAvatar, setCvTemplate, updateProfile } from "@/lib/profiles";
import { fail, UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { deleteStoredFiles, storageKeyFromUrl, storeImage } from "@/lib/storage";
import { fieldErrors, profileInput } from "@/lib/validation";

export async function updateProfileAction(input: unknown) {
  const parsed = profileInput.safeParse(input);
  if (!parsed.success) return fail("Sjekk feltene i skjemaet.", fieldErrors(parsed.error));

  return runAction(async () => {
    const user = await requireUserForAction();
    await updateProfile(user.id, parsed.data);
    revalidatePath(`/profil/${user.username}`);
    revalidatePath("/", "layout");
  }, "profile.update");
}

// Skjemafelt: avatar (bilde).
export async function uploadAvatarAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Velg et bilde.");
    const stored = await storeImage(file, `avatars/${user.id}`, { ownerId: user.id });
    await setAvatar(user.id, stored.url);
    // Slett forrige opplastede bilde (ikke GitHub-avataren, den ligger hos GitHub).
    if (user.image) await deleteStoredFiles([storageKeyFromUrl(user.image)]);
    revalidatePath("/", "layout");
    return { url: stored.url };
  }, "profile.avatar");
}

export async function removeAvatarAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setAvatar(user.id, null);
    if (user.image) await deleteStoredFiles([storageKeyFromUrl(user.image)]);
    revalidatePath("/", "layout");
  }, "profile.avatar-remove");
}

export async function setCvTemplateAction(template: CvTemplate) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (!CV_TEMPLATES.includes(template)) throw new UserFacingError("Ukjent mal.");
    await setCvTemplate(user.id, template);
    revalidatePath(`/profil/${user.username}`);
    revalidatePath(`/profil/${user.username}/cv`);
  }, "profile.cv-template");
}
