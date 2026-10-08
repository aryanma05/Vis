import "server-only";

import { timingSafeEqual } from "node:crypto";

// Planlagte jobber kalles med «Authorization: Bearer <CRON_SECRET>» (Cron Job hos Render
// eller cron-job.org). Uten CRON_SECRET er jobbene stengt.
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
