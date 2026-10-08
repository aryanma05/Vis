import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("aktivitetslogg", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const member = `test-${randomUUID()}`;
  const candidate = `test-${randomUUID()}`;
  const outsider = `test-${randomUUID()}`;
  const companyId = randomUUID();
  const applicationId = randomUUID();

  // Rader med en bestemt alder, rett i tabellen (audit() skriver alltid «nå»).
  async function insertAt(action: string, daysAgo: number, label = action) {
    const { db, schema } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.insert(schema.companyAudit).values({ companyId, actorId: owner, action, label, createdAt: sql`now() - make_interval(days => ${daysAgo})` });
  }

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of [owner, member, candidate, outsider]) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    await db.insert(schema.company).values({ id: companyId, slug: `logg-${companyId.slice(0, 8)}`, name: "Loggfirma", createdById: owner });
    await db.insert(schema.companyMember).values([
      { companyId, userId: owner, role: "owner" },
      { companyId, userId: member, role: "member" },
    ]);
  });

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from company where id = ${companyId}`);
    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    for (const id of [owner, member, candidate, outsider]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("i en transaksjon skrives raden sammen med resten, og forsvinner hvis den rulles tilbake", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { audit } = await import("@/lib/audit");
    await db.transaction(async (tx) => {
      await audit({ companyId, actorId: owner, action: "member.role_changed", targetType: "user", targetId: member, subjectUserId: member, meta: { from: "member", to: "reviewer" } }, tx);
    });
    await assert.rejects(
      db.transaction(async (tx) => {
        await audit({ companyId, actorId: owner, action: "member.removed", targetType: "user", targetId: member }, tx);
        throw new Error("rull tilbake");
      }),
      /rull tilbake/,
    );
    const rows = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.targetId, member)));
    assert.deepEqual(rows.map((r) => r.action), ["member.role_changed"]);
    assert.deepEqual(rows[0].meta, { from: "member", to: "reviewer" });
    assert.equal(rows[0].subjectUserId, member);
  });

  test("uten transaksjon skrives raden i bakgrunnen, og lange tekster i meta kuttes", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { audit } = await import("@/lib/audit");
    // Objekter og lister er ikke lov i meta (bare id-er, tall, statuser og ja/nei), og tas ikke med.
    const meta = { rows: 12, format: "x".repeat(100), filters: { q: "fritekst" } } as unknown as Record<string, number>;
    await audit({ companyId, actorId: owner, action: "list.exported", targetType: "list", targetId: "liste-1", meta });
    let row: typeof schema.companyAudit.$inferSelect | undefined;
    for (let i = 0; i < 50 && !row; i++) {
      [row] = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "list.exported")));
      if (!row) await new Promise((r) => setTimeout(r, 20));
    }
    assert.ok(row, "raden ble skrevet");
    assert.equal(row.meta.rows, 12);
    assert.equal(String(row.meta.format).length, 64);
    assert.equal("filters" in row.meta, false);
  });

  test("«åpnet en søknad» logges én gang per person og dag", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { auditViewOnce } = await import("@/lib/audit");
    await auditViewOnce(companyId, member, applicationId, candidate);
    await auditViewOnce(companyId, member, applicationId, candidate);
    await auditViewOnce(companyId, owner, applicationId, candidate);
    const views = await db
      .select()
      .from(schema.companyAudit)
      .where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "application.viewed")));
    assert.equal(views.length, 2, "én per person");
    assert.ok(views.every((v) => v.targetId === applicationId && v.subjectUserId === candidate && v.targetType === "application"));

    // En visning i går stopper ikke dagens.
    const other = randomUUID();
    await db.insert(schema.companyAudit).values({ companyId, actorId: member, action: "application.viewed", targetType: "application", targetId: other, createdAt: new Date(Date.now() - 2 * 86_400_000) });
    await auditViewOnce(companyId, member, other, candidate);
    const forOther = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.targetId, other)));
    assert.equal(forOther.length, 2);
  });

  test("hele loggen: 30 dager på Gratis, 24 måneder med Bedrift, og bare for eier og admin", async () => {
    const { listAudit } = await import("@/lib/audit");
    await insertAt("company.updated", 10, "ti dager");
    await insertAt("company.updated", 40, "førti dager");
    await insertAt("company.updated", 400, "fire hundre dager");

    const free = (await listAudit(owner, companyId, { scope: "full", group: "innstillinger" })).map((r) => r.label);
    assert.ok(free.includes("ti dager"));
    assert.ok(!free.includes("førti dager") && !free.includes("fire hundre dager"), "Gratis ser bare 30 dager");

    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
    const business = (await listAudit(owner, companyId, { scope: "full", group: "innstillinger" })).map((r) => r.label);
    assert.ok(["ti dager", "førti dager", "fire hundre dager"].every((l) => business.includes(l)), "Bedrift ser 24 måneder");

    await assert.rejects(listAudit(member, companyId, { scope: "full" }), /Rollen din/);
    await assert.rejects(listAudit(outsider, companyId, { scope: "feed" }), /ikke tilgang/);
  });

  test("filter, person og «Vis flere»", async () => {
    const { listAudit } = await import("@/lib/audit");
    const exports = await listAudit(owner, companyId, { scope: "full", group: "eksport" });
    assert.ok(exports.length > 0 && exports.every((r) => r.action === "list.exported" || r.action === "audit.exported"));

    // Et ukjent filter fra adressen gir hele loggen, ikke en feil.
    const unknown = await listAudit(owner, companyId, { scope: "full", group: "toString" as never });
    assert.ok(unknown.length > exports.length);

    const byMember = await listAudit(owner, companyId, { scope: "full", actorId: member });
    assert.ok(byMember.length > 0 && byMember.every((r) => r.actor?.id === member));

    const [first, second] = await listAudit(owner, companyId, { scope: "full", limit: 2 });
    const next = await listAudit(owner, companyId, { scope: "full", limit: 1, before: first.createdAt });
    assert.ok(next[0].createdAt <= first.createdAt);
    assert.equal(next[0].id === first.id, false);
    assert.ok(second);
  });

  test("aktiviteten under Oversikt: alle roller, bare det som hører hjemme der", async () => {
    const { listAudit } = await import("@/lib/audit");
    await insertAt("job.published", 1, "Frontend-utvikler");
    await insertAt("job.published", 45, "gammel stilling");
    const feed = await listAudit(member, companyId, { scope: "feed" });
    assert.deepEqual(
      feed.map((r) => r.action),
      ["job.published"],
      "visninger, roller og eksport vises ikke i aktiviteten, og bare 30 dager",
    );
    assert.equal(feed[0].label, "Frontend-utvikler");
    assert.equal(feed[0].actor?.id, owner);
  });

  test("rader eldre enn 24 måneder slettes", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { purgeAudit } = await import("@/lib/audit");
    await insertAt("company.updated", 800, "for gammel");
    assert.ok((await purgeAudit()) >= 1);
    const labels = (await db.select({ label: schema.companyAudit.label }).from(schema.companyAudit).where(eq(schema.companyAudit.companyId, companyId))).map((r) => r.label);
    assert.ok(!labels.includes("for gammel"));
    assert.ok(labels.includes("fire hundre dager"));
  });

  test("tilgangssjekken: medlemskap, rolle, tofaktor og databehandleravtale, i den rekkefølgen", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { getCompanyGate, requireCompanyPermission, requireTermsAccepted } = await import("@/lib/company-access");
    const setCompany = (values: Partial<typeof schema.company.$inferInsert>) => db.update(schema.company).set(values).where(eq(schema.company.id, companyId));

    assert.equal(await getCompanyGate(outsider, companyId), null);
    await assert.rejects(requireCompanyPermission(outsider, companyId, "company.view"), /Du har ikke tilgang til denne bedriften/);
    await assert.rejects(requireCompanyPermission(member, companyId, "audit.view"), /Rollen din gir ikke tilgang til dette/);
    assert.equal(await requireCompanyPermission(member, companyId, "jobs.draft"), "member");

    // Krev tofaktor: alt unntatt company.view og members.view stoppes for dem uten.
    await setCompany({ require2fa: true });
    try {
      assert.deepEqual(await getCompanyGate(member, companyId), { role: "member", needs2fa: true, termsAccepted: false });
      await assert.rejects(requireCompanyPermission(member, companyId, "jobs.draft"), /krever tofaktorinnlogging/);
      await assert.rejects(requireCompanyPermission(member, companyId, "audit.view"), /Rollen din/, "rollen sjekkes før tofaktor");
      assert.equal(await requireCompanyPermission(member, companyId, "members.view"), "member");
      await db.update(schema.user).set({ twoFactorEnabled: true }).where(eq(schema.user.id, member));
      assert.equal(await requireCompanyPermission(member, companyId, "jobs.draft"), "member");
    } finally {
      await setCompany({ require2fa: false });
    }

    // Databehandleravtalen: bare for publisering, kandidatsøk og kontakt.
    await assert.rejects(requireCompanyPermission(member, companyId, "jobs.publish"), /Godta databehandleravtalen/);
    await assert.rejects(requireCompanyPermission(member, companyId, "candidates.contact"), /Godta databehandleravtalen/);
    await assert.rejects(requireTermsAccepted(companyId), /Godta databehandleravtalen/);
    await setCompany({ termsAcceptedAt: new Date(), termsAcceptedById: owner, termsVersion: "2026-10" });
    assert.equal(await requireCompanyPermission(member, companyId, "jobs.publish"), "member");
    await requireTermsAccepted(companyId);
  });
});
