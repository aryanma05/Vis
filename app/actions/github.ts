"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { importGithubRepo, listImportableRepos, lookupGithub, syncProjectReadme } from "@/lib/github";
import { requireUserForAction } from "@/lib/session";

export async function listGithubReposAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    return listImportableRepos(user.id);
  });
}

// Et GitHub-brukernavn eller en repo-lenke. Krever ikke at GitHub er koblet til.
export async function lookupGithubAction(query: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return lookupGithub(user.id, String(query).slice(0, 300));
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

export async function syncProjectReadmeAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await syncProjectReadme(user.id, String(projectId));
    revalidatePath(`/prosjekt/${projectId}`);
  });
}
