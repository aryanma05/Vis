"use server";

import { runAction } from "@/lib/action";
import type { ReportReason } from "@/lib/constants";
import { createReport, type ReportTarget } from "@/lib/reports";
import { requireUserForAction } from "@/lib/session";

export async function reportAction(input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string }) {
  return runAction(async () => {
    const user = await requireUserForAction();
    await createReport(user.id, {
      targetType: input.targetType,
      targetId: String(input.targetId),
      reason: input.reason,
      details: input.details ? String(input.details) : null,
    });
  }, "report");
}
