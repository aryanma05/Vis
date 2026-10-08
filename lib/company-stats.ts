import "server-only";

import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isUuid } from "@/lib/projects";

const { companyInvite, job, jobApplication } = schema;

// Tall til administrasjonen: Oversikt, nøkkeltall og Spart med Vis. P4 fyller inn resten.

export type AdminBadges = { freshApplicants: number; newSinceYesterday: number; waitingOver7: number; pendingInvites: number };

// Tallene på fanene og i toppen av administrasjonen: søkere i Ny, nye siste døgn, søkere som
// har ventet over 7 dager i Ny, og invitasjoner som venter på svar. Én spørring.
export async function getAdminBadges(companyId: string): Promise<AdminBadges> {
  if (!isUuid(companyId)) return { freshApplicants: 0, newSinceYesterday: 0, waitingOver7: 0, pendingInvites: 0 };
  const rows = await db.execute<AdminBadges>(sql`
    select
      count(*) filter (where a.status = 'ny')::int as "freshApplicants",
      count(*) filter (where a.status <> 'trukket' and a.created_at > now() - interval '1 day')::int as "newSinceYesterday",
      count(*) filter (where a.status = 'ny' and a.status_changed_at < now() - interval '7 days')::int as "waitingOver7",
      (select count(*)::int from ${companyInvite} i
        where i.company_id = ${companyId} and i.status = 'pending' and i.expires_at > now()) as "pendingInvites"
    from ${jobApplication} a
    join ${job} j on j.id = a.job_id
    where j.company_id = ${companyId}`);
  const row = rows[0];
  return {
    freshApplicants: Number(row?.freshApplicants ?? 0),
    newSinceYesterday: Number(row?.newSinceYesterday ?? 0),
    waitingOver7: Number(row?.waitingOver7 ?? 0),
    pendingInvites: Number(row?.pendingInvites ?? 0),
  };
}
