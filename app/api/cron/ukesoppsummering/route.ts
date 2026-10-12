import { cronAuthorized } from "@/lib/cron";
import { sendWeeklyDigests } from "@/lib/digest";

// Planlagt jobb: kall med «Authorization: Bearer <CRON_SECRET>», f.eks. fra en Cron Job
// hos Render eller cron-job.org, én gang hver dag (f.eks. kl. 08). Hver kjøring sender en
// porsjon på maks 100, så oppsummeringene spres utover uka; svaret sier om det er flere igjen.
export const maxDuration = 300;

async function run(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Ikke tilgang" }, { status: 401 });
  const result = await sendWeeklyDigests();
  return Response.json(result);
}

export const GET = run;
export const POST = run;
