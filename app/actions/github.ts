"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { importGithubRepo, listImportableRepos } from "@/lib/github";
import { requireUserForAction } from "@/lib/session";

export async function listGithubReposAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    return listImportableRepos(user.id);
  });
}

// Importerer som utkast som standard, så brukeren kan legge til bilder før publisering.
export async function importGithubRepoAction(fullName: string, { publish = false } = {}) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await importGithubRepo(user.id, String(fullName), { publish: Boolean(publish) });
    revalidatePath(`/profil/${user.username}`);
    if (publish) revalidatePath("/");
    return result;
  });
}
