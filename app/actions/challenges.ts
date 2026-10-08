"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { createChallenge, deleteChallenge, setChallengeStatus, setEntryHighlighted, submitEntry, updateChallenge, withdrawEntry, type ChallengeInput } from "@/lib/challenges";
import { getCompanyById } from "@/lib/companies";
import { UserFacingError } from "@/lib/result";
import { requireUserForAction } from "@/lib/session";

const input = (v: Partial<ChallengeInput> | undefined): ChallengeInput => ({
  title: String(v?.title ?? ""),
  description: String(v?.description ?? ""),
  reward: v?.reward ? String(v.reward) : null,
  deadline: v?.deadline ? String(v.deadline) : null,
  tags: Array.isArray(v?.tags) ? v.tags.map(String) : [],
});

async function revalidateCompany(companyId: string) {
  const c = await getCompanyById(companyId);
  revalidatePath("/utfordringer");
  if (c) revalidatePath(`/bedrift/${c.slug}`, "layout");
}

export async function createChallengeAction(companyId: string, values: Partial<ChallengeInput>, publish: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await createChallenge(user.id, String(companyId), input(values), Boolean(publish));
    await revalidateCompany(String(companyId));
    return { id };
  }, "challenge.create");
}

export async function updateChallengeAction(challengeId: string, values: Partial<ChallengeInput>) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await updateChallenge(user.id, String(challengeId), input(values));
    revalidatePath(`/utfordringer/${challengeId}`);
    await revalidateCompany(companyId);
  }, "challenge.update");
}

export async function setChallengeStatusAction(challengeId: string, status: "draft" | "published" | "closed") {
  return runAction(async () => {
    const user = await requireUserForAction();
    if (!["draft", "published", "closed"].includes(status)) throw new UserFacingError("Ukjent status.");
    const companyId = await setChallengeStatus(user.id, String(challengeId), status);
    revalidatePath(`/utfordringer/${challengeId}`);
    await revalidateCompany(companyId);
  }, "challenge.status");
}

export async function deleteChallengeAction(challengeId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const companyId = await deleteChallenge(user.id, String(challengeId));
    await revalidateCompany(companyId);
  }, "challenge.delete");
}

export async function submitEntryAction(challengeId: string, projectId: string, note?: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await submitEntry(user.id, String(challengeId), String(projectId), note ? String(note) : null);
    revalidatePath(`/utfordringer/${challengeId}`);
    return result;
  }, "challenge.entry");
}

export async function withdrawEntryAction(challengeId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await withdrawEntry(user.id, String(challengeId));
    revalidatePath(`/utfordringer/${challengeId}`);
  }, "challenge.withdraw");
}

export async function setEntryHighlightedAction(entryId: string, highlighted: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const challengeId = await setEntryHighlighted(user.id, String(entryId), Boolean(highlighted));
    revalidatePath(`/utfordringer/${challengeId}`);
  }, "challenge.highlight");
}
