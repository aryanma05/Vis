"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  changeMemberRole,
  createCompany,
  deleteCompany,
  getCompanyById,
  leaveCompany,
  removeCompanyMember,
  removeEmployee,
  setCompanyLogo,
  setCompanySecurity,
  setShowOnPage,
  updateCompany,
  type CompanyInput,
} from "@/lib/companies";
import { requireCompanyPermission } from "@/lib/company-access";
import { COMPANY_ROLES, type CompanyRole } from "@/lib/company-permissions";
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

// Bare roller som finnes; alt annet avvises i lib.
const asRole = (role: unknown) => (COMPANY_ROLES as readonly string[]).includes(String(role)) ? (String(role) as CompanyRole) : ("" as CompanyRole);

export async function createCompanyAction(values: Partial<CompanyInput> & { acceptTerms?: boolean }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const row = await createCompany(user.id, { ...companyInput(values), acceptTerms: values?.acceptTerms === true });
    revalidatePath("/bedrifter");
    return row;
  }, "company.create");
}

export async function updateCompanyAction(companyId: string, values: Partial<CompanyInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await updateCompany(user.id, String(companyId), companyInput(values));
    revalidatePath(await companyPath(String(companyId)), "layout");
    return result;
  }, "company.update");
}

export async function uploadCompanyLogoAction(companyId: string, formData: FormData) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await requireCompanyPermission(user.id, String(companyId), "company.edit");
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
    revalidatePath("/bedrifter");
  }, "company.delete");
}

/* Tilgang */

export async function removeCompanyMemberAction(companyId: string, userId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await removeCompanyMember(user.id, String(companyId), String(userId));
    revalidatePath(await companyPath(String(companyId)), "layout");
  }, "company.member-remove");
}

export async function changeMemberRoleAction(companyId: string, userId: string, role: CompanyRole) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await changeMemberRole(user.id, String(companyId), String(userId), asRole(role));
    revalidatePath(`${await companyPath(String(companyId))}/admin`);
  }, "company.member-role");
}

export async function leaveCompanyAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await leaveCompany(user.id, String(companyId));
    revalidatePath(await companyPath(String(companyId)), "layout");
    revalidatePath("/bedrifter");
  }, "company.member-leave");
}

export async function setShowOnPageAction(companyId: string, show: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setShowOnPage(user.id, String(companyId), show === true);
    revalidatePath(await companyPath(String(companyId)), "layout");
  }, "company.show-on-page");
}

export async function setCompanySecurityAction(companyId: string, require2fa: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setCompanySecurity(user.id, String(companyId), { require2fa: require2fa === true });
    revalidatePath(`${await companyPath(String(companyId))}/admin`);
  }, "company.security");
}

/* Teamet på bedriftssiden */

// Fjerner en person fra teamet. Uten userId fjerner man seg selv.
export async function removeEmployeeAction(companyId: string, userId?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await removeEmployee(user.id, String(companyId), userId ? String(userId) : user.id);
    revalidatePath(await companyPath(String(companyId)), "layout");
  }, "company.employee-remove");
}
