"use server";

import { runAction } from "@/lib/action";
import { getFollowingProjects, getLatestProjects } from "@/lib/projects";
import { requireUserForAction } from "@/lib/session";

export async function loadMoreProjectsAction(cursor: string, source: "latest" | "following" = "latest") {
  return runAction(async () => {
    if (source === "following") {
      const user = await requireUserForAction();
      return getFollowingProjects(user.id, { limit: 24, cursor: String(cursor) });
    }
    return getLatestProjects({ limit: 24, cursor: String(cursor) });
  }, "feed.more");
}
