"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { bulkSetApplicationStatus, rejectWaitingApplicants } from "@/lib/applications";
import { getCompanyById } from "@/lib/companies";
import type { ApplicationStage } from "@/lib/constants";
import { deleteTemplate, saveTemplate, setCompanyMessaging } from "@/lib/message-templates";
import { requireUserForAction } from "@/lib/session";

async function adminPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}/admin` : "/bedrifter";
}

/* Svarmaler og automatisk svar */

export async function saveTemplateAction(companyId: string, input: { id?: string | null; kind: string; name?: string | null; subject: string; body: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await saveTemplate(user.id, String(companyId), {
      id: input?.id ? String(input.id) : null,
      kind: String(input?.kind ?? ""),
      name: input?.name ? String(input.name) : null,
      subject: String(input?.subject ?? ""),
      body: String(input?.body ?? ""),
    });
    revalidatePath(await adminPath(String(companyId)), "layout");
    return result;
  }, "template.save");
}

export async function deleteTemplateAction(templateId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await deleteTemplate(user.id, String(templateId));
    revalidatePath(await adminPath(companyId), "layout");
  }, "template.delete");
}

export async function setCompanyMessagingAction(companyId: string, input: { autoReply: boolean; responseDays: number }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setCompanyMessaging(user.id, String(companyId), { autoReply: Boolean(input?.autoReply), responseDays: Number(input?.responseDays) });
    revalidatePath(await adminPath(String(companyId)), "layout");
  }, "company.messaging");
}

/* Massehandlinger */

// «Flytt til…» og «Avslå med mal» for de valgte søkerne (maks 100).
export async function bulkSetApplicationStatusAction(companyId: string, ids: string[], status: ApplicationStage, templateId?: string | null) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await bulkSetApplicationStatus(
      user.id,
      String(companyId),
      Array.isArray(ids) ? ids.slice(0, 101).map(String) : [],
      String(status) as ApplicationStage,
      templateId ? String(templateId) : null,
    );
    revalidatePath(await adminPath(String(companyId)), "layout");
    return result;
  }, "application.bulk");
}

// Lukkedialogen: avslag til alle som står i Ny på stillingen.
export async function rejectWaitingApplicantsAction(jobId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const { changed, companyId } = await rejectWaitingApplicants(user.id, String(jobId));
    revalidatePath(await adminPath(companyId), "layout");
    return { changed };
  }, "application.reject-waiting");
}
