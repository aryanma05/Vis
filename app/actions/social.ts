"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { REACTION_TYPES, type ReactionType } from "@/lib/constants";
import { check } from "@/lib/rate-limit";
import { toggleReaction } from "@/lib/reactions";
import { ipFromHeaders } from "@/lib/request-ip";
import { getCurrentUser, requireUserForAction } from "@/lib/session";
import { followUser, unfollowUser } from "@/lib/social";
import { recordProfileVisit } from "@/lib/pro";
import { isBot, recordProfileView, recordProjectView } from "@/lib/views";
import { UserFacingError } from "@/lib/result";

export async function followAction(userId: string, follow: boolean) {
  return runAction(async () => {
    const viewer = await requireUserForAction();
    if (follow) await followUser(viewer.id, String(userId));
    else await unfollowUser(viewer.id, String(userId));
    revalidatePath("/", "layout");
    return { following: follow };
  }, "follow");
}

export async function toggleReactionAction(projectId: string, type: ReactionType) {
  return runAction(async () => {
    const viewer = await requireUserForAction();
    if (!REACTION_TYPES.includes(type)) throw new UserFacingError("Ugyldig reaksjon.");
    return toggleReaction(viewer.id, String(projectId), type);
  }, "reaction");
}

// Kalles fra nettleseren én gang per økt og side (components/ViewTracker.tsx).
export async function recordViewAction(kind: "project" | "profile", id: string) {
  try {
    const h = await headers();
    if ((kind !== "project" && kind !== "profile") || isBot(h.get("user-agent"))) return;
    const viewer = await getCurrentUser();
    // Én visning per person (eller IP-adresse) per side per døgn, så ingen kan løfte et prosjekt
    // opp i «Populære» ved å kalle denne i en løkke.
    if (!(await check("view", `${viewer?.id ?? ipFromHeaders(h)}:${kind}:${String(id).slice(0, 64)}`)).ok) return;
    if (kind === "project") await recordProjectView(String(id), viewer?.id);
    else if (kind === "profile" && typeof id === "string" && id.length <= 64) {
      await recordProfileView(id, viewer?.id);
      await recordProfileVisit(id, viewer?.id);
    }
  } catch {
    // Telling av visninger skal aldri gi feil hos besøkende.
  }
}
