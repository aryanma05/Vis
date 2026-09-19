"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  addProjectImages,
  createProject,
  deleteProject,
  deleteProjectImage,
  reorderProjectImages,
  setProjectStatus,
  updateImageAlt,
  updateProject,
} from "@/lib/projects";
import { fail, type ActionResult } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { fieldErrors, projectInput } from "@/lib/validation";

function readProjectForm(formData: FormData) {
  return projectInput.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    repoUrl: formData.get("repoUrl"),
    demoUrl: formData.get("demoUrl"),
    projectDate: formData.get("projectDate"),
    tags: formData.getAll("tags").length > 1 ? formData.getAll("tags") : formData.get("tags"),
    status: formData.get("status") ?? undefined,
  });
}

function revalidateProject(projectId: string, username: string) {
  revalidatePath(`/prosjekt/${projectId}`);
  revalidatePath(`/profil/${username}`);
  revalidatePath("/");
}

// Skjemafelter: title, summary, description, repoUrl, demoUrl, projectDate,
// tags (kommaseparert eller flere felt), status ("draft" | "published"), images (filer, valgfritt).
export async function createProjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fail("Sjekk feltene i skjemaet.", fieldErrors(parsed.error));

  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await createProject(user.id, parsed.data);

    const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (images.length > 0) {
      try {
        await addProjectImages(user.id, id, images);
      } catch (error) {
        // Prosjektet er lagret; bildene kan lastes opp på nytt fra redigeringssiden.
        console.error("[createProject] bildeopplasting feilet", error);
      }
    }

    revalidateProject(id, user.username);
    return { id };
  });
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = readProjectForm(formData);
  if (!parsed.success) return fail("Sjekk feltene i skjemaet.", fieldErrors(parsed.error));

  return runAction(async () => {
    const user = await requireUserForAction();
    await updateProject(user.id, projectId, parsed.data);
    revalidateProject(projectId, user.username);
    return { id: projectId };
  });
}

export async function setProjectStatusAction(projectId: string, status: "draft" | "published") {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (status !== "draft" && status !== "published") throw new Error("Ugyldig status");
    await setProjectStatus(user.id, projectId, status);
    revalidateProject(projectId, user.username);
  });
}

export async function deleteProjectAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteProject(user.id, projectId);
    revalidateProject(projectId, user.username);
  });
}

// Skjemafelt: images (én eller flere filer).
export async function uploadProjectImagesAction(projectId: string, formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    const images = await addProjectImages(user.id, projectId, files);
    revalidateProject(projectId, user.username);
    return images;
  });
}

export async function deleteProjectImageAction(imageId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteProjectImage(user.id, imageId);
    revalidatePath("/", "layout");
  });
}

export async function reorderProjectImagesAction(projectId: string, imageIds: string[]) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await reorderProjectImages(user.id, projectId, imageIds);
    revalidateProject(projectId, user.username);
  });
}

export async function updateImageAltAction(imageId: string, alt: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await updateImageAlt(user.id, imageId, alt);
  });
}

