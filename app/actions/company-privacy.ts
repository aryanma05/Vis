"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { listAudit } from "@/lib/audit";
import { getCompanyById } from "@/lib/companies";
import { AUDIT_GROUPS, type AuditGroup } from "@/lib/company-labels";
import { acceptCompanyTerms, blockCompany, removeMeFromCompanyLists, setRetentionMonths, unblockCompany } from "@/lib/company-privacy";
import { requireUserForAction } from "@/lib/session";
import { setWebhookActive, setWebhookPersonalData } from "@/lib/webhooks";

async function adminPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}/admin` : "/bedrifter";
}

/* Bedriften */

export async function acceptCompanyTermsAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await acceptCompanyTerms(user.id, String(companyId));
    revalidatePath(await adminPath(String(companyId)));
  }, "privacy.terms");
}

export async function setRetentionMonthsAction(companyId: string, months: number) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setRetentionMonths(user.id, String(companyId), Number(months));
    revalidatePath(await adminPath(String(companyId)));
  }, "privacy.retention");
}

// «Vis flere» i aktivitetsloggen: neste side eldre enn before. Tilgangen sjekkes i listAudit.
export async function loadAuditAction(companyId: string, input: { group?: string | null; before?: string | null }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const group = input?.group && Object.hasOwn(AUDIT_GROUPS, String(input.group)) ? (String(input.group) as AuditGroup) : null;
    const before = input?.before ? String(input.before) : null;
    const rows = await listAudit(user.id, String(companyId), { scope: "full", group, before, limit: 50 });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }, "privacy.audit-more");
}

export async function setWebhookPersonalDataAction(webhookId: string, on: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await setWebhookPersonalData(user.id, String(webhookId), Boolean(on));
    revalidatePath(await adminPath(companyId));
  }, "webhook.personal");
}

export async function setWebhookActiveAction(webhookId: string, active: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await setWebhookActive(user.id, String(webhookId), Boolean(active));
    revalidatePath(await adminPath(companyId));
  }, "webhook.active");
}

/* Kandidaten: «Bedrifter og deg» */

const RELATIONS = "/profil/rediger/konto/bedrifter";

export async function removeMeFromCompanyListsAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const removed = await removeMeFromCompanyLists(user.id, String(companyId));
    revalidatePath(RELATIONS);
    return { removed };
  }, "privacy.remove-me");
}

export async function blockCompanyAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await blockCompany(user.id, String(companyId));
    revalidatePath(RELATIONS);
  }, "privacy.block");
}

export async function unblockCompanyAction(companyId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await unblockCompany(user.id, String(companyId));
    revalidatePath(RELATIONS);
  }, "privacy.unblock");
}
