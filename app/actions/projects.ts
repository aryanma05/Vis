"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, runAction } from "@/lib/action";
import {
  addProjectImages,
  addProjectScreenshots,
  createProject,
  deleteProject,
  deleteProjectImage,
  isUuid,
  reorderProjectImages,
  setProjectPinned,
  setProjectStatus,
  updateImageAlt,
  updateProject,
} from "@/lib/projects";
import { UserFacingError, type ActionResult } from "@/lib/result";
import { leaveProject, notifyProjectMembers } from "@/lib/project-members";
import { addProjectUpdate, deleteProjectUpdate } from "@/lib/project-updates";
import { enforce } from "@/lib/rate-limit";
import { capturePage, MAX_SCREENSHOTS } from "@/lib/screenshots";
import { requireUserForAction } from "@/lib/session";
import { projectInput } from "@/lib/validation";

function readProjectForm(formData: FormData) {
  return projectInput.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    repoUrl: formData.get("repoUrl"),
    demoUrl: formData.get("demoUrl"),
    videoUrl: formData.get("videoUrl"),
    role: formData.get("role"),
    projectDate: formData.get("projectDate"),
    tags: formData.getAll("tags").length > 1 ? formData.getAll("tags") : formData.get("tags"),
    status: formData.get("status") ?? undefined,
    progress: formData.get("progress"),
    members: formData.get("members"),
  });
}

function revalidateProject(projectId: string, username: string) {
  revalidatePath(`/prosjekt/${projectId}`);
  revalidatePath(`/profil/${username}`);
  revalidatePath("/");
}

// Skjemafelter: title, summary, description, repoUrl, demoUrl, projectDate,
// tags (kommaseparert eller flere felt), status ("draft" | "published"),
// progress ("completed" | "in_progress"), members (kommaseparerte brukernavn), images (filer, valgfritt).
export async function createProjectAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = readProjectForm(formData);
  if (!parsed.success) return invalidInput(parsed.error);

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

    await notifyProjectMembers(user.id, id);
    revalidateProject(id, user.username);
    return { id };
  });
}

export async function updateProjectAction(projectId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = readProjectForm(formData);
  if (!parsed.success) return invalidInput(parsed.error);

  return runAction(async () => {
    const user = await requireUserForAction();
    await updateProject(user.id, projectId, parsed.data);
    await notifyProjectMembers(user.id, projectId);
    revalidateProject(projectId, user.username);
    return { id: projectId };
  });
}

export async function setProjectStatusAction(projectId: string, status: "draft" | "published") {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (status !== "draft" && status !== "published") throw new Error("Ugyldig status");
    await setProjectStatus(user.id, projectId, status);
    await notifyProjectMembers(user.id, projectId);
    revalidateProject(projectId, user.username);
  });
}

// Et medlem fjerner seg selv fra prosjektet.
export async function leaveProjectAction(projectId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (!isUuid(String(projectId))) throw new UserFacingError("Fant ikke prosjektet.");
    await leaveProject(user.id, String(projectId));
    revalidatePath(`/prosjekt/${projectId}`);
  }, "project.leave");
}

export async function setProjectPinnedAction(projectId: string, pinned: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setProjectPinned(user.id, projectId, Boolean(pinned));
    revalidateProject(projectId, user.username);
  }, "project.pin");
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
    const projectId = await deleteProjectImage(user.id, imageId);
    revalidateProject(projectId, user.username);
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

// Skjermbilder av en nettside, til skjemaet. Bildene lagres ikke her: de legges i
// skjemaet som nye bilder, så brukeren kan fjerne, sortere og beskjære dem før lagring.
export async function captureScreenshotsAction(url: string, max: number = MAX_SCREENSHOTS) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (typeof url !== "string" || url.length > 500) throw new UserFacingError("Lenken er for lang.");
    await enforce("screenshots", user.id);
    const { shots, meta } = await capturePage(url, { max: Math.max(1, Math.min(Number(max) || MAX_SCREENSHOTS, MAX_SCREENSHOTS)) });
    return {
      shots: shots.map((shot) => ({ base64: shot.bytes.toString("base64"), type: "image/webp", width: shot.width, height: shot.height })),
      meta,
    };
  }, "project.screenshots");
}

// Tar skjermbilder av prosjektets lenke og lagrer dem på prosjektet med en gang
// (brukes etter import, der prosjektet allerede finnes).
export async function addProjectScreenshotsAction(projectId: string, url: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (typeof url !== "string" || url.length > 500) throw new UserFacingError("Lenken er for lang.");
    await enforce("screenshots", user.id);
    const images = await addProjectScreenshots(user.id, String(projectId), url);
    revalidateProject(String(projectId), user.username);
    return images;
  }, "project.screenshots");
}

export async function addProjectUpdateAction(projectId: string, body: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await addProjectUpdate(user.id, String(projectId), String(body ?? ""));
    revalidatePath(`/prosjekt/${projectId}`);
  }, "project.update.add");
}

export async function deleteProjectUpdateAction(updateId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const projectId = await deleteProjectUpdate(user.id, String(updateId));
    if (projectId) revalidatePath(`/prosjekt/${projectId}`);
  }, "project.update.delete");
}
