"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { applyToJob, markHired, setApplicationStatus, unmarkHired, withdrawApplication } from "@/lib/applications";
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
      projectIds: Array.isArray(input?.projectIds) ? input.projectIds.slice(0, 20).map(String) : [],
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

// Flytter én søker. templateId: malen som sendes (tom = bedriftens standard for statusen).
export async function setApplicationStatusAction(applicationId: string, status: ApplicationStage, templateId?: string | null) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await setApplicationStatus(user.id, String(applicationId), String(status) as ApplicationStage, { templateId: templateId ? String(templateId) : null });
    revalidatePath(await adminPath(companyId), "layout");
  }, "application.status");
}

export async function markHiredAction(applicationId: string, agencyAvoided: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await markHired(user.id, String(applicationId), { agencyAvoided: Boolean(agencyAvoided) });
    revalidatePath(await adminPath(companyId), "layout");
  }, "application.hired");
}

export async function unmarkHiredAction(applicationId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await unmarkHired(user.id, String(applicationId));
    revalidatePath(await adminPath(companyId), "layout");
  }, "application.unhired");
}
