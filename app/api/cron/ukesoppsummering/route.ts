import { timingSafeEqual } from "node:crypto";
import { sendWeeklyDigests } from "@/lib/digest";

// Planlagt jobb: kall med «Authorization: Bearer <CRON_SECRET>», f.eks. fra en Cron Job
// hos Render eller cron-job.org, mandager kl. 07–09 hver time. Hver kjøring sender en
// porsjon; svaret sier om det er flere igjen.
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Ikke tilgang" }, { status: 401 });
  const result = await sendWeeklyDigests();
  return Response.json(result);
}

export const GET = run;
export const POST = run;
