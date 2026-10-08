import { purgeAudit } from "@/lib/audit";
import { expireInvites } from "@/lib/company-invites";
import { cronAuthorized } from "@/lib/cron";
import { purgeOldSlots, sendInterviewReminders } from "@/lib/interviews";
import { log } from "@/lib/log";
import { sendResponseDigests } from "@/lib/pipeline";
import { runRetention } from "@/lib/retention";
import { sendSavedSearchAlerts } from "@/lib/saved-searches";

// Planlagt jobb, én gang i døgnet (f.eks. kl. 07): varsler om nye kandidater i lagrede søk,
// sletter det som har passert lagringstiden (søknader, lister, logg, gamle intervjutider),
// rydder invitasjoner, og sender oppsummeringer og påminnelser. Jobbene kjører hver for seg,
// så én som feiler stopper ikke de andre. Kall med «Authorization: Bearer <CRON_SECRET>».
export const maxDuration = 300;

const JOBS = {
  alerts: sendSavedSearchAlerts,
  retention: runRetention,
  invites: expireInvites,
  digests: sendResponseDigests,
  reminders: sendInterviewReminders,
  slots: purgeOldSlots,
  audit: purgeAudit,
} satisfies Record<string, () => Promise<unknown>>;

async function run(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Ikke tilgang" }, { status: 401 });
  const names = Object.keys(JOBS) as (keyof typeof JOBS)[];
  const results = await Promise.allSettled(names.map((name) => JOBS[name]()));
  const counts: Record<string, unknown> = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled") counts[names[i]] = result.value;
    else {
      counts[names[i]] = null;
      log.error("cron.daglig", { job: names[i], error: result.reason });
    }
  });
  return Response.json(counts);
}

export const GET = run;
export const POST = run;
