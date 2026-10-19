"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { markMessagesRead, sendMessage } from "@/lib/messages";
import { requireUserForAction } from "@/lib/session";

export async function sendMessageAction(recipientId: string, body: string) {
  return runAction(async () => {
    const viewer = await requireUserForAction();
    await sendMessage(viewer.id, String(recipientId), String(body ?? ""));
    revalidatePath("/meldinger", "layout");
  }, "message.send");
}

export async function markMessagesReadAction(friendId: string) {
  return runAction(async () => {
    const viewer = await requireUserForAction();
    await markMessagesRead(viewer.id, String(friendId));
  }, "message.read");
}
