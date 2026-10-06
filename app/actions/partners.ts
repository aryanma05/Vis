"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { setPartnerStatus } from "@/lib/partners";
import { requireUserForAction } from "@/lib/session";

// Vis eller skjul deg på partnersiden, og hva du vil lage (lagres som «Hva ser du etter?»).
export async function setPartnerStatusAction(input: { listed: boolean; lookingFor?: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await setPartnerStatus(user.id, Boolean(input?.listed), typeof input?.lookingFor === "string" ? input.lookingFor : undefined);
    revalidatePath("/partnere");
    revalidatePath(`/profil/${user.username}`);
  }, "partners.status");
}
