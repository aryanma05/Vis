"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { applyToJob, setApplicationNote, setApplicationStatus, withdrawApplication } from "@/lib/applications";
import { getCompanyById } from "@/lib/companies";
import type { ApplicationStage } from "@/lib/constants";
import { requireUserForAction } from "@/lib/session";

async function adminPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}/admin` : "/bedrifter";
}

// «Søk med Vis-profilen». Profilen, e-posten og prosjektene deles med bedriften.
export async function applyToJobAction(jobId: string, input: { message?: string; projectIds?: string[] }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await applyToJob(user, String(jobId), {
      message: input?.message ? String(input.message) : null,
      projectIds: Array.isArray(input?.projectIds) ? input.projectIds.map(String) : [],
    });
    revalidatePath(`/stillinger/${jobId}`);
    revalidatePath("/soknader");
    return result;
  }, "application.create");
}

export async function withdrawApplicationAction(applicationId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const jobId = await withdrawApplication(user.id, String(applicationId));
    revalidatePath(`/stillinger/${jobId}`);
    revalidatePath("/soknader");
  }, "application.withdraw");
}

export async function setApplicationStatusAction(applicationId: string, status: ApplicationStage) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await setApplicationStatus(user.id, String(applicationId), status);
    revalidatePath(await adminPath(companyId), "layout");
  }, "application.status");
}

export async function setApplicationNoteAction(applicationId: string, note: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setApplicationNote(user.id, String(applicationId), note ? String(note) : null);
  }, "application.note");
}
