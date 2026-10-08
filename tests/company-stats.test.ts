import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("innsikt: visninger, oversikt og sletting av stillinger", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const reviewer = `test-${randomUUID()}`;
  const kari = `test-${randomUUID()}`;
  const ola = `test-${randomUUID()}`;
  const per = `test-${randomUUID()}`;
  const outsider = `test-${randomUUID()}`;
  const users = [owner, reviewer, kari, ola, per, outsider];
  const companyId = randomUUID();
  let jobId = "";

  // Søknad rett i tabellen, med en bestemt alder og status.
  async function apply(userId: string, values: Record<string, unknown> = {}, forJob = jobId) {
    const { db, schema } = await import("@/db");
    const [row] = await db
      .insert(schema.jobApplication)
      .values({ jobId: forJob, userId, ...values })
      .returning({ id: schema.jobApplication.id });
    return row.id;
  }

  // audit() uten transaksjon skrives rett etter svaret; vent til raden er der.
  async function auditRows(action: string) {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    for (let i = 0; i < 20; i++) {
      const rows = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, action)));
      if (rows.length > 0) return rows;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return [];
  }

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of users) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    await db.insert(schema.company).values({ id: companyId, slug: `innsikt-${companyId.slice(0, 8)}`, name: "Innsiktfirma", createdById: owner, termsAcceptedAt: new Date() });
    await db.insert(schema.companyMember).values([
      { companyId, userId: owner, role: "owner" },
      { companyId, userId: reviewer, role: "reviewer" },
    ]);
    const { createJob } = await import("@/lib/jobs");
    jobId = await createJob(owner, companyId, { title: "Frontend-utvikler", applyMode: "vis", replacedPaidAd: true }, true);
  });

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from company where id = ${companyId}`);
    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    for (const id of users) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("en visning teller på stillingen og på dagen i Oslo-tid; egne visninger og utkast telles ikke", async () => {
    const { db, schema } = await import("@/db");
    const { eq, sql } = await import("drizzle-orm");
    const { countJobView, createJob } = await import("@/lib/jobs");
    await countJobView(jobId, outsider);
    await countJobView(jobId);
    await countJobView(jobId, owner);
    await countJobView("ikke-en-id");

    const [j] = await db.select({ views: schema.job.views }).from(schema.job).where(eq(schema.job.id, jobId));
    assert.equal(j.views, 2);
    const days = await db
      .select({ day: sql<string>`to_char(${schema.jobViewDay.day}, 'YYYY-MM-DD')`, views: schema.jobViewDay.views })
      .from(schema.jobViewDay)
      .where(eq(schema.jobViewDay.jobId, jobId));
    const osloToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
    assert.deepEqual(days, [{ day: osloToday, views: 2 }], "én rad per dag, oppdatert i stedet for ny");

    const draft = await createJob(owner, companyId, { title: "Utkast", applyMode: "vis" }, false);
    await countJobView(draft);
    assert.equal((await db.select().from(schema.jobViewDay).where(eq(schema.jobViewDay.jobId, draft))).length, 0);
  });

  test("publisering, lukking og sletting krever riktig rolle, og logges", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { createJob, deleteJob, setJobStatus, updateJob } = await import("@/lib/jobs");
    // Vurderer kan lage utkast, men ikke publisere, endre en publisert stilling eller slette.
    const draft = await createJob(reviewer, companyId, { title: "Backend-utvikler", applyMode: "vis" }, false);
    await assert.rejects(createJob(reviewer, companyId, { title: "Designer", applyMode: "vis" }, true), /Rollen din/);
    await assert.rejects(setJobStatus(reviewer, draft, "published"), /Rollen din/);
    await assert.rejects(updateJob(reviewer, jobId, { title: "Endret", applyMode: "vis" }), /Rollen din/);
    await assert.rejects(setJobStatus(reviewer, jobId, "closed"), /Rollen din/);
    await assert.rejects(deleteJob(reviewer, draft), /Rollen din/);
    await assert.rejects(createJob(outsider, companyId, { title: "Utenfra", applyMode: "vis" }, false), /tilgang/);

    // Lukket får closedAt, publisert igjen nullstiller den.
    const other = await createJob(owner, companyId, { title: "Sommerjobb", applyMode: "vis" }, false);
    await setJobStatus(owner, other, "closed");
    const [closed] = await db.select({ closedAt: schema.job.closedAt }).from(schema.job).where(eq(schema.job.id, other));
    assert.ok(closed.closedAt);
    assert.equal((await auditRows("job.closed")).length, 1);
    await deleteJob(owner, other);
    await deleteJob(owner, draft);

    const published = await auditRows("job.published");
    assert.equal(published[0]?.targetId, jobId);
    assert.equal(published[0]?.label, "Frontend-utvikler");
    assert.deepEqual(published[0]?.meta, { replacedPaidAd: true });
  });

  test("oversikten teller søkere, svartid, trakten og Spart med Vis, bare for medlemmer", async () => {
    const { db, schema } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const { getAttention, getFeed, getOverview } = await import("@/lib/company-stats");
    const { computeRoi } = await import("@/lib/roi");

    await apply(kari, { status: "ny", statusChangedAt: sql`now() - interval '8 days'`, createdAt: sql`now() - interval '8 days'` });
    await apply(ola, { status: "intervju", firstResponseAt: sql`now() - interval '1 day'`, createdAt: sql`now() - interval '3 days'` });
    await apply(per, { status: "tilbud", firstResponseAt: sql`now()`, createdAt: sql`now() - interval '1 day'`, hiredAt: sql`now()`, agencyAvoided: true });
    await apply(outsider, { status: "trukket" });
    await db.insert(schema.companyAudit).values([
      { companyId, actorId: owner, action: "application.status", meta: { to: "intervju" } },
      { companyId, actorId: owner, action: "application.status", meta: { to: "ny" } },
      { companyId, actorId: owner, action: "application.bulk_status", meta: { n: 3, to: "avslag" } },
    ]);

    await assert.rejects(getOverview(outsider, companyId), /tilgang/);
    const o = await getOverview(owner, companyId, { days: 365 });
    assert.equal(o.days, 30, "Gratis ser bare 30 dager");
    assert.equal(o.applicants.current, 3, "trukne søknader telles ikke");
    assert.equal(o.applicants.spark.length, 30);
    assert.equal(o.views.current, 2);
    assert.equal(o.conversion.current, 150);
    assert.deepEqual(o.funnel, { views: 2, applicants: 3, interview: 2, offer: 1, hired: 1 });
    // Median av 2 dager (Ola) og 1 dag (Per).
    assert.equal(o.response.current, 1.5);

    const expected = computeRoi({ applications: 3, hires: 1, interviews: 0, messages: 4, replacedAds: 1, agencyHires: 1 });
    assert.equal(o.roi.kroner, expected.kroner);
    assert.equal(o.roi.hours, expected.hours);
    assert.equal(o.roi.agency, expected.agency);
    assert.deepEqual(o.roi.parts, [], "Gratis får bare hovedtallet");
    assert.equal(o.roi.input, null);
    assert.ok(o.roi.spark.at(-1)! >= o.roi.kroner, "sparklinen ender på det som er spart (før avrunding)");
    assert.equal(o.jobs, null);

    const attention = await getAttention(owner, companyId, "/b");
    assert.deepEqual(attention.find((a) => a.key === "waiting"), { key: "waiting", count: 1, href: "/b?fane=sokere&for=venter" });
    assert.equal(attention.find((a) => a.key === "terms"), undefined);
    // Vurderere ser ikke invitasjoner og sletting, men ser søkere som venter.
    const forReviewer = await getAttention(reviewer, companyId, "/b");
    assert.ok(forReviewer.some((a) => a.key === "waiting"));
    assert.ok(!forReviewer.some((a) => a.key === "expiring" || a.key === "invites"));

    const feed = await getFeed(reviewer, companyId);
    assert.equal(feed.filter((f) => f.kind === "application").length, 3, "nye søknader, ikke trukne");
    assert.ok(feed.some((f) => f.kind === "audit" && f.action === "job.published"));
    assert.ok(feed.every((f, i) => i === 0 || feed[i - 1].createdAt >= f.createdAt), "nyeste først");
    await assert.rejects(getFeed(outsider, companyId), /tilgang/);

    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
    const full = await getOverview(owner, companyId, { days: 90 });
    assert.equal(full.days, 90);
    assert.equal(full.applicants.spark.length, 90);
    assert.ok(full.roi.parts.length > 0);
    assert.deepEqual(full.roi.input, { applications: 3, hires: 1, interviews: 0, messages: 4, replacedAds: 1, agencyHires: 1 });
    const row = full.jobs?.find((j) => j.id === jobId);
    assert.ok(row);
    assert.equal(row.applicants, 3);
    assert.equal(row.fresh, 1);
    assert.equal(row.views, 2);
    assert.deepEqual(row.funnel, { views: 2, applicants: 3, interview: 2, offer: 1, hired: 1 });
    assert.equal((await getOverview(owner, companyId, { days: 365 })).daily.length, 53, "12 måneder vises per uke");
  });

  test("«Slik regner vi» kan bare endres av eier og administrator, og bare avvik lagres", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { getUsage, setRoiSettings } = await import("@/lib/company-stats");
    await assert.rejects(setRoiSettings(reviewer, companyId, { hourlyCost: 800 }), /Rollen din/);
    const values = await setRoiSettings(owner, companyId, { hourlyCost: "800", salary: 650_000, agencyFee: 1e6 });
    assert.equal(values.hourlyCost, 800);
    assert.equal(values.agencyFee, 0.4);
    const [c] = await db.select({ roiSettings: schema.company.roiSettings }).from(schema.company).where(eq(schema.company.id, companyId));
    assert.deepEqual(c.roiSettings, { hourlyCost: 800, agencyFee: 0.4 });

    const usage = await getUsage(reviewer, companyId);
    assert.equal(usage.seats, 2);
    assert.equal(usage.maxSeats, 25);
    assert.equal(usage.activeJobs, 1);
    assert.ok(usage.total.kroner >= 0);
    await setRoiSettings(owner, companyId, {});
  });

  test("sletter man en stilling, får kandidater med åpne søknader beskjed før søknadene forsvinner", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { createJob, deleteJob } = await import("@/lib/jobs");
    const doomed = await createJob(owner, companyId, { title: "Data scientist", applyMode: "vis" }, false);
    await apply(kari, { status: "intervju" }, doomed);
    await apply(ola, { status: "avslag" }, doomed);
    await apply(per, { status: "trukket" }, doomed);

    await assert.rejects(deleteJob(reviewer, doomed), /Rollen din/);
    await deleteJob(owner, doomed);

    const notices = await db
      .select({ userId: schema.notification.userId, data: schema.notification.data })
      .from(schema.notification)
      .where(and(eq(schema.notification.type, "application"), eq(schema.notification.actorId, owner)));
    const forJob = notices.filter((n) => n.data?.jobId === doomed);
    assert.deepEqual(forJob.map((n) => n.userId), [kari], "bare åpne søknader (ikke avslått eller trukket)");
    assert.equal(forJob[0].data?.event, "job_closed");
    assert.equal(forJob[0].data?.jobTitle, "Data scientist");
    assert.equal(forJob[0].data?.companyName, "Innsiktfirma");
    assert.equal((await db.select().from(schema.jobApplication).where(eq(schema.jobApplication.jobId, doomed))).length, 0);

    const [logged] = (await auditRows("job.deleted")).filter((r) => r.targetId === doomed);
    assert.deepEqual(logged.meta, { notified: 1 });
    assert.equal(logged.label, "Data scientist");
  });
});
