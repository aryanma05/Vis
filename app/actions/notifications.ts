"use server";

import { runAction } from "@/lib/action";
import { markAllRead } from "@/lib/notifications";
import { requireUserForAction } from "@/lib/session";

export async function markNotificationsReadAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    await markAllRead(user.id);
  });
}
