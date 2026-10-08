"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { getCompanyById } from "@/lib/companies";
import { createJob, deleteJob, setJobStatus, updateJob, type JobInput } from "@/lib/jobs";
import { UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";

async function companyPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}` : "/bedrifter";
}

/* Stillinger */

const jobInput = (v: Partial<JobInput> | undefined): JobInput => ({
  title: String(v?.title ?? ""),
  description: String(v?.description ?? ""),
  location: v?.location ? String(v.location) : null,
  remote: v?.remote ? String(v.remote) : undefined,
  type: v?.type ? String(v.type) : undefined,
  applyUrl: v?.applyUrl ? String(v.applyUrl) : null,
  applyEmail: v?.applyEmail ? String(v.applyEmail) : null,
  deadline: v?.deadline ? String(v.deadline) : null,
  tags: Array.isArray(v?.tags) ? v.tags.map(String) : [],
  applyMode: v?.applyMode === "vis" ? "vis" : "ekstern",
  replacedPaidAd: v?.replacedPaidAd === true,
});

export async function createJobAction(companyId: string, values: Partial<JobInput>, publish: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await createJob(user.id, String(companyId), jobInput(values), Boolean(publish));
    revalidatePath("/stillinger");
    revalidatePath(await companyPath(String(companyId)));
    return { id };
  }, "job.create");
}

export async function updateJobAction(jobId: string, values: Partial<JobInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await updateJob(user.id, String(jobId), jobInput(values));
    revalidatePath(`/stillinger/${jobId}`);
    revalidatePath(await companyPath(companyId));
  }, "job.update");
}

export async function setJobStatusAction(jobId: string, status: "draft" | "published" | "closed") {
  return runAction(async () => {
    const user = await requireUserForAction();
    const next = String(status);
    if (next !== "draft" && next !== "published" && next !== "closed") throw new UserFacingError("Ukjent status.");
    const companyId = await setJobStatus(user.id, String(jobId), next);
    revalidatePath("/stillinger");
    revalidatePath(`/stillinger/${jobId}`);
    revalidatePath(await companyPath(companyId));
  }, "job.status");
}

export async function deleteJobAction(jobId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await deleteJob(user.id, String(jobId));
    revalidatePath("/stillinger");
    revalidatePath(await companyPath(companyId));
  }, "job.delete");
}
