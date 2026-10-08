import { deleteOldApplications } from "@/lib/applications";
import { cronAuthorized } from "@/lib/cron";
import { sendSavedSearchAlerts } from "@/lib/saved-searches";

// Planlagt jobb, én gang i døgnet (f.eks. kl. 07): varsler bedrifter om nye kandidater i
// lagrede søk, og sletter søknader som ikke er endret på et år (personvern).
// Kall med «Authorization: Bearer <CRON_SECRET>».
export const maxDuration = 300;

async function run(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Ikke tilgang" }, { status: 401 });
  const [alerts, deletedApplications] = await Promise.all([sendSavedSearchAlerts(), deleteOldApplications()]);
  return Response.json({ alerts, deletedApplications });
}

export const GET = run;
export const POST = run;
