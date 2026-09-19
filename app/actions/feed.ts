"use server";

import { runAction } from "@/lib/action";
import { getLatestProjects } from "@/lib/projects";

export async function loadMoreProjectsAction(cursor: string) {
  return runAction(() => getLatestProjects({ limit: 24, cursor: String(cursor) }));
}
