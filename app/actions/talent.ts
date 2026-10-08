"use server";

import { revalidatePath } from "next/cache";
import type { SavedSearchFilters } from "@/db/schema";
import { runAction } from "@/lib/action";
import { getCompanyById, requireBusiness, requireCompanyRole } from "@/lib/companies";
import { sendContactRequest } from "@/lib/contact";
import { createSavedSearch, deleteSavedSearch, setSavedSearchNotify } from "@/lib/saved-searches";
import { requireUserForAction } from "@/lib/session";
import { createTalentList, deleteTalentList, setTalentListMember } from "@/lib/talent";

async function companyPath(companyId: string) {
  const c = await getCompanyById(companyId);
  return c ? `/bedrift/${c.slug}` : "/bedrifter";
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
