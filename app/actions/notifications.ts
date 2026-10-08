"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { getNotificationPrefs, markAllRead, markRead, resolvePrefs, setNotificationPrefs } from "@/lib/notifications";
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

export async function setNotificationPrefsAction(prefs: {
  comment?: boolean;
  reply?: boolean;
  mention?: boolean;
  follow?: boolean;
  digest?: boolean;
  contact?: boolean;
  companyDigest?: boolean;
}) {
  return runAction(async () => {
    const user = await requireUserForAction();
    // Sendes ikke companyDigest med (f.eks. for dem som ikke er i en bedrift), beholdes det som var.
    const companyDigest = prefs?.companyDigest === undefined ? (await getNotificationPrefs(user.id)).companyDigest : Boolean(prefs.companyDigest);
    await setNotificationPrefs(
      user.id,
      resolvePrefs({
        comment: Boolean(prefs?.comment),
        reply: Boolean(prefs?.reply),
        mention: Boolean(prefs?.mention),
        follow: Boolean(prefs?.follow),
        digest: Boolean(prefs?.digest),
        contact: Boolean(prefs?.contact),
        companyDigest,
      }),
    );
  }, "notifications.prefs");
}
