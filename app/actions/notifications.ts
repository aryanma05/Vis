"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { markAllRead, markRead, resolvePrefs, setNotificationPrefs } from "@/lib/notifications";
import { requireUserForAction } from "@/lib/session";

export async function markNotificationsReadAction() {
  return runAction(async () => {
    const user = await requireUserForAction();
    await markAllRead(user.id);
    revalidatePath("/", "layout");
  }, "notifications.read-all");
}

export async function markNotificationReadAction(id: string) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await markRead(user.id, String(id));
  }, "notifications.read");
}

export async function setNotificationPrefsAction(prefs: { comment?: boolean; reply?: boolean; mention?: boolean; follow?: boolean }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setNotificationPrefs(
      user.id,
      resolvePrefs({
        comment: Boolean(prefs.comment),
        reply: Boolean(prefs.reply),
        mention: Boolean(prefs.mention),
        follow: Boolean(prefs.follow),
      }),
    );
  }, "notifications.prefs");
}
