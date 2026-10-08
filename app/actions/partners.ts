"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, runAction } from "@/lib/action";
import {
  createPartnerPost,
  deletePartnerPost,
  respondToPartnerRequest,
  sendPartnerRequest,
  setPartnerPostClosed,
  updatePartnerPost,
  withdrawPartnerRequest,
} from "@/lib/partner-posts";
import { requireUserForAction } from "@/lib/session";
import { partnerPostInput } from "@/lib/validation";

// Utlysningen vises på /partnere, på profilen og på prosjektet den peker på.
function revalidatePost(username: string, postId?: string) {
  revalidatePath("/partnere");
  if (postId) revalidatePath(`/partnere/${postId}`);
  revalidatePath(`/profil/${username}`);
}

export async function savePartnerPostAction(id: string | null, input: unknown) {
  const parsed = partnerPostInput.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  return runAction(async () => {
    const user = await requireUserForAction();
    let postId: string;
    if (id) {
      postId = String(id);
      await updatePartnerPost(user.id, postId, parsed.data);
    } else {
      postId = await createPartnerPost(user.id, parsed.data);
    }
    revalidatePost(user.username, postId);
    if (parsed.data.projectId) revalidatePath(`/prosjekt/${parsed.data.projectId}`);
    return { id: postId };
  }, "partners.post.save");
}

export async function setPartnerPostClosedAction(id: string, closed: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setPartnerPostClosed(user.id, String(id), Boolean(closed));
    revalidatePost(user.username, String(id));
  }, "partners.post.close");
}

export async function deletePartnerPostAction(id: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deletePartnerPost(user.id, String(id));
    revalidatePost(user.username);
  }, "partners.post.delete");
}

export async function sendPartnerRequestAction(postId: string, input: { commitment: string; message: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await sendPartnerRequest(user, String(postId), { commitment: String(input?.commitment ?? ""), message: String(input?.message ?? "") });
    revalidatePath(`/partnere/${postId}`);
    revalidatePath("/partnere");
  }, "partners.request.send");
}

export async function respondToPartnerRequestAction(requestId: string, accept: boolean) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const postId = await respondToPartnerRequest(user.id, String(requestId), Boolean(accept));
    revalidatePath(`/partnere/${postId}`);
    revalidatePath("/partnere");
  }, "partners.request.respond");
}

export async function withdrawPartnerRequestAction(requestId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const postId = await withdrawPartnerRequest(user.id, String(requestId));
    revalidatePath(`/partnere/${postId}`);
    revalidatePath("/partnere");
  }, "partners.request.withdraw");
}
