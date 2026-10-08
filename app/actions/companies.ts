"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  addCompanyMember,
  addEmployee,
  createCompany,
  deleteCompany,
  getCompanyById,
  removeCompanyMember,
  removeEmployee,
  requireCompanyRole,
  setCompanyLogo,
  updateCompany,
  type CompanyInput,
} from "@/lib/companies";
import { sendContactRequest } from "@/lib/contact";
import { createJob, deleteJob, setJobStatus, updateJob, type JobInput } from "@/lib/jobs";
import { UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { storeImage } from "@/lib/storage";
import { createTalentList, deleteTalentList, setTalentListMember } from "@/lib/talent";
import { requireBusiness } from "@/lib/companies";
import { createSavedSearch, deleteSavedSearch, setSavedSearchNotify } from "@/lib/saved-searches";
import type { SavedSearchFilters } from "@/db/schema";

const companyInput = (v: Partial<CompanyInput> | undefined): CompanyInput => ({
  name: String(v?.name ?? ""),
  slug: v?.slug ? String(v.slug) : undefined,
  website: v?.website ? String(v.website) : null,
  about: v?.about ? String(v.about) : null,
  location: v?.location ? String(v.location) : null,
  size: v?.size ? String(v.size) : null,
});

async function companyPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}` : "/bedrifter";
}

export async function createCompanyAction(values: Partial<CompanyInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return createCompany(user.id, companyInput(values));
  }, "company.create");
}

export async function updateCompanyAction(companyId: string, values: Partial<CompanyInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await updateCompany(user.id, String(companyId), companyInput(values));
    revalidatePath(await companyPath(String(companyId)));
  }, "company.update");
}

export async function uploadCompanyLogoAction(companyId: string, formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await requireCompanyRole(user.id, String(companyId), ["owner", "admin"]);
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new UserFacingError("Velg et bilde.");
    const stored = await storeImage(file, `companies/${companyId}`, { ownerId: user.id });
    await setCompanyLogo(user.id, String(companyId), stored.url);
    revalidatePath(await companyPath(String(companyId)));
    return { url: stored.url };
  }, "company.logo");
}

export async function deleteCompanyAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteCompany(user.id, String(companyId));
  }, "company.delete");
}

export async function addCompanyMemberAction(companyId: string, username: string, role: "admin" | "member") {
  return runAction(async () => {
    const user = await requireUserForAction();
    await addCompanyMember(user.id, String(companyId), String(username ?? ""), role === "admin" ? "admin" : "member");
  }, "company.member-add");
}

export async function removeCompanyMemberAction(companyId: string, userId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await removeCompanyMember(user.id, String(companyId), String(userId));
  }, "company.member-remove");
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
    if (!["draft", "published", "closed"].includes(status)) throw new UserFacingError("Ukjent status.");
    const companyId = await setJobStatus(user.id, String(jobId), status);
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

/* Kandidater */

export async function createTalentListAction(companyId: string, name: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return { id: await createTalentList(user.id, String(companyId), String(name ?? "")) };
  }, "talent.list-create");
}

export async function deleteTalentListAction(listId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteTalentList(user.id, String(listId));
  }, "talent.list-delete");
}

export async function setTalentListMemberAction(listId: string, userId: string, on: boolean, note?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setTalentListMember(user.id, String(listId), String(userId), Boolean(on), note ?? null);
  }, "talent.member");
}

// Bedriften tar kontakt med en kandidat. Kandidaten har selv slått på «Synlig for
// bedrifter», så det trengs ikke at «Kontakt meg» er på.
export async function contactCandidateAction(companyId: string, candidateId: string, input: { reason: string; message: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await requireCompanyRole(user.id, String(companyId));
    await requireBusiness(String(companyId));
    await sendContactRequest(user, String(candidateId), { reason: String(input?.reason ?? ""), message: String(input?.message ?? ""), companyId: String(companyId) });
  }, "talent.contact");
}

/* Lagrede søk */

export async function createSavedSearchAction(companyId: string, name: string, filters: Partial<SavedSearchFilters>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await createSavedSearch(user.id, String(companyId), String(name ?? ""), {
      q: filters?.q ? String(filters.q) : undefined,
      location: filters?.location ? String(filters.location) : null,
      openTo: filters?.openTo ? (String(filters.openTo) as SavedSearchFilters["openTo"]) : null,
      field: filters?.field ? String(filters.field) : null,
      student: Boolean(filters?.student),
    });
    revalidatePath(`${await companyPath(String(companyId))}/admin`);
    return { id };
  }, "saved-search.create");
}

export async function deleteSavedSearchAction(searchId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await deleteSavedSearch(user.id, String(searchId));
    revalidatePath(`${await companyPath(companyId)}/admin`);
  }, "saved-search.delete");
}

export async function setSavedSearchNotifyAction(searchId: string, notify: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await setSavedSearchNotify(user.id, String(searchId), Boolean(notify));
    revalidatePath(`${await companyPath(companyId)}/admin`);
  }, "saved-search.notify");
}

/* Teamet på bedriftssiden */

export async function addEmployeeAction(companyId: string, username: string, title?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await addEmployee(user.id, String(companyId), String(username ?? ""), title ? String(title) : null);
    revalidatePath(await companyPath(String(companyId)), "layout");
  }, "company.employee-add");
}

// Fjerner en person fra teamet. Uten userId fjerner man seg selv.
export async function removeEmployeeAction(companyId: string, userId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await removeEmployee(user.id, String(companyId), userId ? String(userId) : user.id);
    revalidatePath(await companyPath(String(companyId)), "layout");
  }, "company.employee-remove");
}
