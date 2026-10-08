import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { WAITING_DAYS } from "@/lib/applications";
import { hasBusiness } from "@/lib/billing";
import { can } from "@/lib/company-permissions";
import { log } from "@/lib/log";
import { emailProviderConfigured, notificationEmail, sendEmailInBackground } from "@/lib/mailer";
import { resolvePrefs } from "@/lib/notifications";
import { isUuid } from "@/lib/projects";
import { check } from "@/lib/rate-limit";

const { company, companyMember, job, jobApplication, profile, user } = schema;

// Søkerflyten: daglig påminnelse om søkere som venter på svar.

type Waiting = { companyId: string; name: string; slug: string; n: number };

const plural = (n: number) => (n === 1 ? "1 søker har" : `${n} søkere har`);

// Planlagt jobb (Bedrift): «N søkere har ventet over 7 dager», til dem som kan flytte søkere
// (eier, administratorer og rekrutterere). Maks én e-post per person per døgn (regelen
// companyDigest), samlet for alle bedriftene personen er med i, og bare til dem som har
// notificationPrefs.companyDigest på. Bare tall og bedriftsnavn, ingen kandidater.
// companyId begrenser kjøringen til én bedrift (tester). Gir antall e-poster som ble sendt.
export async function sendResponseDigests({ companyId }: { companyId?: string } = {}): Promise<number> {
  if (!emailProviderConfigured && process.env.NODE_ENV === "production") return 0;
  if (companyId !== undefined && !isUuid(companyId)) return 0;

  const rows = await db
    .select({ companyId: company.id, name: company.name, slug: company.slug, n: sql<number>`count(*)::int` })
    .from(jobApplication)
    .innerJoin(job, eq(job.id, jobApplication.jobId))
    .innerJoin(company, eq(company.id, job.companyId))
    .where(
      and(
        eq(jobApplication.status, "ny"),
        sql`${jobApplication.statusChangedAt} < now() - make_interval(days => ${WAITING_DAYS})`,
        companyId ? eq(company.id, companyId) : undefined,
      ),
    )
    .groupBy(company.id, company.name, company.slug);

  const waiting: Waiting[] = [];
  for (const r of rows) if (Number(r.n) > 0 && (await hasBusiness(r.companyId))) waiting.push({ ...r, n: Number(r.n) });
  if (waiting.length === 0) return 0;

  const members = await db
    .select({ userId: companyMember.userId, companyId: companyMember.companyId, role: companyMember.role, email: user.email, emailVerified: user.emailVerified, prefs: profile.notificationPrefs })
    .from(companyMember)
    .innerJoin(user, eq(user.id, companyMember.userId))
    .leftJoin(profile, eq(profile.userId, companyMember.userId))
    .where(
      inArray(
        companyMember.companyId,
        waiting.map((w) => w.companyId),
      ),
    );

  // Én e-post per person, med alle bedriftene der noen venter.
  const byCompany = new Map(waiting.map((w) => [w.companyId, w]));
  const perUser = new Map<string, { email: string; companies: Waiting[] }>();
  for (const m of members) {
    if (!m.emailVerified || !can(m.role, "applications.move") || !resolvePrefs(m.prefs).companyDigest) continue;
    const w = byCompany.get(m.companyId);
    if (!w) continue;
    const entry = perUser.get(m.userId) ?? { email: m.email, companies: [] };
    entry.companies.push(w);
    perUser.set(m.userId, entry);
  }

  let sent = 0;
  for (const [userId, { email, companies }] of perUser) {
    try {
      // Teller bare når e-posten faktisk sendes; maks én per døgn.
      if (!(await check("companyDigest", userId)).ok) continue;
      companies.sort((a, b) => b.n - a.n);
      const total = companies.reduce((sum, c) => sum + c.n, 0);
      const [first] = companies;
      const where = companies.length === 1 ? `hos ${first.name}` : `hos ${companies.map((c) => `${c.name} (${c.n})`).join(", ")}`;
      sendEmailInBackground(
        notificationEmail({
          to: email,
          subject: `${plural(total)} ventet over ${WAITING_DAYS} dager`,
          heading: `${plural(total)} ventet over ${WAITING_DAYS} dager`,
          intro: `${plural(total)} stått i Ny i over ${WAITING_DAYS} dager ${where}. Et kort svar, også et nei, gjør mye for hvordan kandidatene ser på dere. Med «Velg» kan dere svare mange på en gang.`,
          path: `/bedrift/${first.slug}/admin?fane=sokere&for=venter`,
          button: "Se søkerne som venter",
        }),
      );
      sent++;
    } catch (error) {
      log.error("pipeline.digest", { error, userId });
    }
  }
  log.info("pipeline.digest", { sent, companies: waiting.length });
  return sent;
}
