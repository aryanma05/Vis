"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { removeCustomDomain, setCustomDomain, setProfileFlags, verifyCustomDomain } from "@/lib/pro";
import { requireUserForAction } from "@/lib/session";

export async function setProfileFlagsAction(flags: { hideVisits?: boolean; hideBranding?: boolean; visibleToCompanies?: boolean }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const pick = (v: unknown) => (typeof v === "boolean" ? v : undefined);
    await setProfileFlags(user.id, {
      hideVisits: pick(flags?.hideVisits),
      hideBranding: pick(flags?.hideBranding),
      visibleToCompanies: pick(flags?.visibleToCompanies),
    });
    revalidatePath(`/profil/${user.username}`);
  }, "pro.flags");
}

export async function setCustomDomainAction(domain: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    return setCustomDomain(user.id, String(domain ?? ""));
  }, "pro.domain");
}

export async function verifyCustomDomainAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    return verifyCustomDomain(user.id);
  }, "pro.domain-verify");
}

export async function removeCustomDomainAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    await removeCustomDomain(user.id);
  }, "pro.domain-remove");
}
