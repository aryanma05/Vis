"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  adminDeleteComment,
  banUser,
  removeProject,
  requireAdminForAction,
  restoreProject,
  unbanUser,
} from "@/lib/admin";
import { resolveReport, resolveReportsFor } from "@/lib/reports";

export async function removeProjectAction(projectId: string, reason: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await removeProject(admin.id, String(projectId), String(reason ?? ""));
    await resolveReportsFor(admin.id, "project", String(projectId), "Prosjektet ble fjernet.");
    revalidatePath("/", "layout");
  }, "admin.remove-project");
}

export async function restoreProjectAction(projectId: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await restoreProject(admin.id, String(projectId));
    revalidatePath("/", "layout");
  }, "admin.restore-project");
}

export async function adminDeleteCommentAction(commentId: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    const projectId = await adminDeleteComment(admin.id, String(commentId));
    await resolveReportsFor(admin.id, "comment", String(commentId), "Kommentaren ble slettet.");
    if (projectId) revalidatePath(`/prosjekt/${projectId}`);
    revalidatePath("/admin");
  }, "admin.delete-comment");
}

export async function banUserAction(userId: string, reason: string, days?: number | null) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await banUser(admin.id, String(userId), String(reason ?? ""), days ? Number(days) : null);
    await resolveReportsFor(admin.id, "user", String(userId), "Kontoen ble stengt.");
    revalidatePath("/", "layout");
  }, "admin.ban");
}

export async function unbanUserAction(userId: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await unbanUser(admin.id, String(userId));
    revalidatePath("/", "layout");
  }, "admin.unban");
}

export async function resolveReportAction(reportId: string, status: "resolved" | "dismissed", resolution?: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await resolveReport(admin.id, String(reportId), status === "dismissed" ? "dismissed" : "resolved", resolution);
    revalidatePath("/admin");
  }, "admin.resolve");
}
