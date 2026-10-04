"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import {
  adminDeleteComment,
  banUser,
  removeProject,
  requireAdminForAction,
  restoreProject,
  setProjectFeatured,
  unbanUser,
} from "@/lib/admin";
import { grantPlan, revokeGrant } from "@/lib/billing";
import { setCompanyVerified } from "@/lib/companies";
import { resolveReport, resolveReportsFor } from "@/lib/reports";

export async function removeProjectAction(projectId: string, reason: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await removeProject(admin.id, String(projectId), String(reason ?? ""));
    await resolveReportsFor(admin.id, "project", String(projectId), "Prosjektet ble fjernet.");
    revalidatePath("/", "layout");
  }, "admin.remove-project");
}

export async function setFeaturedAction(projectId: string, featured: boolean) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await setProjectFeatured(admin.id, String(projectId), Boolean(featured));
    revalidatePath("/");
    revalidatePath(`/prosjekt/${projectId}`);
  }, "admin.feature-project");
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

export async function grantPlanAction(ownerType: "user" | "company", ownerId: string, days: number | null, note: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    if (ownerType !== "user" && ownerType !== "company") throw new Error("Ukjent eier");
    await grantPlan(admin.id, ownerType, String(ownerId), days && days > 0 ? Math.min(days, 3650) : null, String(note ?? ""));
    revalidatePath("/admin");
  }, "admin.grant");
}

export async function revokeGrantAction(ownerType: "user" | "company", ownerId: string) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await revokeGrant(admin.id, ownerType === "company" ? "company" : "user", String(ownerId));
    revalidatePath("/admin");
  }, "admin.revoke");
}

export async function setCompanyVerifiedAction(companyId: string, verified: boolean) {
  return runAction(async () => {
    const admin = await requireAdminForAction();
    await setCompanyVerified(admin.id, String(companyId), Boolean(verified));
    revalidatePath("/admin");
    revalidatePath("/bedrifter");
  }, "admin.company-verify");
}
