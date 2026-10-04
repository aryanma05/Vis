"use server";

import { runAction } from "@/lib/action";
import { sendContactRequest } from "@/lib/contact";
import { requireUserForAction } from "@/lib/session";

export async function sendContactAction(recipientId: string, input: { reason: string; message: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await sendContactRequest(user, String(recipientId), { reason: String(input?.reason ?? ""), message: String(input?.message ?? "") });
  }, "contact.send");
}
