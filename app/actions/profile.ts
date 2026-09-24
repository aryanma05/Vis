"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { setAvatar, updateProfile } from "@/lib/profiles";
import { fail } from "@/lib/result";
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
  });
}

// Skjemafelt: avatar (bilde).
export async function uploadAvatarAction(formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const file = formData.get("avatar");
    if (!(file instanceof File)) throw new Error("Mangler fil");
    const stored = await storeImage(file, `avatars/${user.id}`, { ownerId: user.id });
    await setAvatar(user.id, stored.url);
    // Slett forrige opplastede bilde (ikke GitHub-avataren, den ligger hos GitHub).
    if (user.image) await deleteStoredFiles([storageKeyFromUrl(user.image)]);
    revalidatePath(`/profil/${user.username}`);
    return { url: stored.url };
  });
}

