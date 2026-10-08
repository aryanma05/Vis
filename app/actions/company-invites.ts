"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { getCompanyById } from "@/lib/companies";
import { acceptInvite, createOwnerTransfer, declineInvite, inviteToCompany, resendInvite, revokeInvite } from "@/lib/company-invites";
import { COMPANY_ROLES, type CompanyRole } from "@/lib/company-permissions";
import { getCurrentUser, requireUserForAction } from "@/lib/session";

async function adminPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}/admin` : "/bedrifter";
}

type InviteValues = { target?: string; kind?: string; role?: string; title?: string };

// Inviter med @brukernavn eller e-post, til tilgang (rolle) eller teamet på bedriftssiden.
export async function inviteAction(companyId: string, values: InviteValues) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const role = (COMPANY_ROLES as readonly string[]).includes(String(values?.role)) ? (String(values?.role) as CompanyRole) : "member";
    const result = await inviteToCompany(user.id, String(companyId), {
      target: String(values?.target ?? ""),
      kind: values?.kind === "employee" ? "employee" : "member",
      role,
      title: values?.title ? String(values.title) : null,
    });
    revalidatePath(await adminPath(String(companyId)));
    return result;
  }, "company.invite");
}

export async function transferOwnershipAction(companyId: string, userId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await createOwnerTransfer(user.id, String(companyId), String(userId));
    revalidatePath(await adminPath(String(companyId)));
  }, "company.owner-transfer");
}

export async function revokeInviteAction(inviteId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await revokeInvite(user.id, String(inviteId));
    revalidatePath(await adminPath(companyId));
  }, "company.invite-revoke");
}

export async function resendInviteAction(inviteId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await resendInvite(user.id, String(inviteId));
    revalidatePath(await adminPath(companyId));
  }, "company.invite-resend");
}

type InviteRef = { inviteId?: string; token?: string };
const ref = (v: InviteRef | undefined) => ({ inviteId: v?.inviteId ? String(v.inviteId) : null, token: v?.token ? String(v.token) : null });

export async function acceptInviteAction(values: InviteRef & { showOnPage?: boolean }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await acceptInvite(user.id, { ...ref(values), showOnPage: values?.showOnPage === true });
    revalidatePath("/varsler");
    revalidatePath("/invitasjoner");
    revalidatePath(`/bedrift/${result.companySlug}`, "layout");
    return result;
  }, "company.invite-accept");
}

// Virker uten innlogging når lenken (token) er med.
export async function declineInviteAction(values: InviteRef) {
  return runAction(async () => {
    const user = await getCurrentUser();
    await declineInvite(user?.id ?? null, ref(values));
    revalidatePath("/varsler");
    revalidatePath("/invitasjoner");
  }, "company.invite-decline");
}
