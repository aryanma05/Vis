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
import { UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";
import { storeImage } from "@/lib/storage";

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
