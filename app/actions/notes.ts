"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { addNote, deleteNote } from "@/lib/application-notes";
import { requireUserForAction } from "@/lib/session";

export async function addNoteAction(applicationId: string, body: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    const result = await addNote(user.id, String(applicationId), String(body ?? ""));
    revalidatePath("/bedrift/[slug]/admin/soker/[id]", "page");
    return result;
  }, "application.note");
}

export async function deleteNoteAction(noteId: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await deleteNote(user.id, String(noteId));
    revalidatePath("/bedrift/[slug]/admin/soker/[id]", "page");
  }, "application.note-delete");
}
