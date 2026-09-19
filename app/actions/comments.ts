"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { addComment, deleteComment, editComment } from "@/lib/comments";
import { requireUserForAction } from "@/lib/session";

export async function addCommentAction(projectId: string, body: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const id = await addComment(user.id, String(projectId), String(body ?? ""));
    revalidatePath(`/prosjekt/${projectId}`);
    return { id };
  });
}

export async function editCommentAction(commentId: string, body: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const projectId = await editComment(user.id, String(commentId), String(body ?? ""));
    revalidatePath(`/prosjekt/${projectId}`);
  });
}

export async function deleteCommentAction(commentId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const projectId = await deleteComment(user.id, String(commentId));
    revalidatePath(`/prosjekt/${projectId}`);
  });
}
