import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("redactPersonalData", () => {
  test("fjerner kandidaten og meldingen, beholder stillingen og søknadens id og status", async () => {
    const { redactPersonalData } = await import("@/lib/webhooks");
    const data = {
      application: { id: "a1", status: "ny", message: "Hei, jeg heter Kari", created: "2026-10-01" },
      job: { id: "j1", title: "Frontend" },
      candidate: { name: "Kari", email: "kari@test.no" },
    };
    assert.deepEqual(redactPersonalData(data), { application: { id: "a1", status: "ny", created: "2026-10-01" }, job: { id: "j1", title: "Frontend" } });
    assert.equal(data.candidate.name, "Kari", "originalen endres ikke");
    assert.deepEqual(redactPersonalData({ message: "ping" }), { message: "ping" });
    assert.equal(redactPersonalData(null), null);
  });
});

describe("personvern: lister, blokkering, kontakt, lagringstid og webhooks", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const admin = `test-${randomUUID()}`;
  const recruiter = `test-${randomUUID()}`;
  const candidate = `test-${randomUUID()}`;
  const other = `test-${randomUUID()}`;
  const users = [owner, admin, recruiter, candidate, other];
  const companyId = randomUUID();
  let listId = "";
  let server: Server | null = null;

  const sender = (id: string) => ({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, username: id.slice(0, 30), emailVerified: true });

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of users) {
      await db.insert(schema.user).values({ id, name: `Test ${id.slice(-4)}`, email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    for (const id of [candidate, other]) {
      await db.insert(schema.profile).values({ userId: id, headline: "Utvikler", visibleToCompanies: true });
    }
    // Rett i tabellene, så testen ikke avhenger av skjemaet for å lage bedrifter.
    await db.insert(schema.company).values({ id: companyId, slug: `pv-${companyId.slice(0, 8)}`, name: "Personvernfirma", createdById: owner });
    await db.insert(schema.companyMember).values([
      { companyId, userId: owner, role: "owner" },
      { companyId, userId: admin, role: "admin" },
      { companyId, userId: recruiter, role: "member" },
    ]);
    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
  });

  after(async () => {
    server?.close();
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from company where id = ${companyId}`);
    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    await db.execute(sql`delete from rate_bucket where key like ${`%${companyId}%`}`);
    for (const id of users) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("uten godtatt databehandleravtale kan ingen publisere, søke eller kontakte", async () => {
    const { requireCompanyPermission } = await import("@/lib/company-access");
    const { searchCandidates } = await import("@/lib/talent");
    const { sendContactRequest } = await import("@/lib/contact");
    await assert.rejects(requireCompanyPermission(owner, companyId, "jobs.publish"), /databehandleravtalen/);
    await assert.rejects(searchCandidates(owner, companyId, {}), /databehandleravtalen/);
    await assert.rejects(
      sendContactRequest(sender(owner), candidate, { reason: "jobb", message: "Hei! Vi har en spennende stilling til deg.", companyId }),
      /databehandleravtalen/,
    );

    const { acceptCompanyTerms } = await import("@/lib/company-privacy");
    await assert.rejects(acceptCompanyTerms(recruiter, companyId), /Rollen/, "bare eier og administrator godtar");
    await acceptCompanyTerms(admin, companyId);
    assert.equal(await requireCompanyPermission(owner, companyId, "jobs.publish"), "owner");
    const found = await searchCandidates(owner, companyId, {});
    assert.ok(found.some((c) => c.id === candidate));
  });

  test("CSV er bare for eier og administrator, notater bare når de ber om det, og hver eksport logges med antall rader", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    const { createTalentList, setTalentListMember, talentListCsv, CSV_FOOTER } = await import("@/lib/talent");
    listId = await createTalentList(recruiter, companyId, "Sommerjobb");
    await setTalentListMember(recruiter, listId, candidate, true, "Sterk på React");
    await setTalentListMember(recruiter, listId, other, true);

    const [member] = await db.select().from(schema.talentListMember).where(and(eq(schema.talentListMember.listId, listId), eq(schema.talentListMember.userId, candidate)));
    assert.equal(member.addedById, recruiter);
    assert.ok(member.expiresAt.getTime() > Date.now() + 360 * 24 * 3600 * 1000, "står i listen i 12 måneder");
    const notices = await db.select().from(schema.notification).where(and(eq(schema.notification.userId, candidate), eq(schema.notification.type, "talent")));
    assert.equal(notices.length, 1, "kandidaten får beskjed om at bedriften lagret dem");

    await assert.rejects(talentListCsv(recruiter, listId), /Rollen/);
    const plain = await talentListCsv(admin, listId);
    assert.equal(plain.rows, 2);
    assert.ok(!plain.csv.includes("Sterk på React"), "ingen notater uten ?notater=1");
    assert.ok(!plain.csv.includes("@test.no"), "ingen e-postadresser");
    assert.ok(plain.csv.includes(CSV_FOOTER));
    const withNotes = await talentListCsv(owner, listId, { notes: true });
    assert.ok(withNotes.csv.includes("Sterk på React"));

    let rows: (typeof schema.companyAudit.$inferSelect)[] = [];
    for (let i = 0; i < 50 && rows.length < 2; i++) {
      rows = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "list.exported")));
      if (rows.length < 2) await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.meta.rows === 2));
    assert.deepEqual(rows.map((r) => r.meta.notes).sort(), [false, true]);
  });

  test("kontakt: én melding per kandidat per 30 dager for hele bedriften, uansett hvem som sender", async () => {
    const { sendContactRequest } = await import("@/lib/contact");
    const message = "Hei! Vi har en spennende stilling som passer deg.";
    await sendContactRequest(sender(owner), candidate, { reason: "jobb", message, companyId });
    await assert.rejects(sendContactRequest(sender(recruiter), candidate, { reason: "jobb", message, companyId }), /allerede kontaktet/);
  });

  test("blokkering skjuler kandidaten i søk og lister, og kontakt gir samme svar som utilgjengelig", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { blockCompany, isBlocked, listCompanyRelations, unblockCompany } = await import("@/lib/company-privacy");
    const { getTalentList, searchCandidates, setTalentListMember } = await import("@/lib/talent");
    const { sendContactRequest } = await import("@/lib/contact");

    const relations = await listCompanyRelations(candidate);
    const rel = relations.find((r) => r.company.id === companyId);
    assert.ok(rel?.saved && rel.contacted, "kandidaten ser at bedriften har lagret og kontaktet dem");

    await assert.rejects(blockCompany(owner, companyId), /med i/, "kan ikke blokkere egen bedrift");
    await blockCompany(other, companyId);
    assert.equal(await isBlocked(other, companyId), true);

    const found = await searchCandidates(owner, companyId, {});
    assert.ok(!found.some((c) => c.id === other), "ikke i søk");
    assert.ok(found.some((c) => c.id === candidate));
    const list = await getTalentList(owner, listId);
    assert.deepEqual(list.members.map((m) => m.id), [candidate], "ikke i lister");
    const left = await db.select().from(schema.talentListMember).where(eq(schema.talentListMember.userId, other));
    assert.equal(left.length, 0, "fjernet fra listene med en gang");
    await assert.rejects(setTalentListMember(owner, listId, other, true), /ikke synlig/);
    await assert.rejects(
      sendContactRequest(sender(admin), other, { reason: "jobb", message: "Hei! Vi har en spennende stilling som passer deg.", companyId }),
      /tar ikke imot meldinger/,
    );

    // Bedriften får aldri vite det: ingen logg om blokkeringen.
    const logged = await db.select().from(schema.companyAudit).where(eq(schema.companyAudit.subjectUserId, other));
    assert.ok(!logged.some((r) => /block/.test(r.action)));

    await unblockCompany(other, companyId);
    assert.equal(await isBlocked(other, companyId), false);
  });

  test("slås «Synlig for bedrifter» av, slettes personen fra alle lister", async () => {
    const { db, schema } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { setProfileFlags } = await import("@/lib/pro");
    const before = await db.select().from(schema.talentListMember).where(eq(schema.talentListMember.userId, candidate));
    assert.equal(before.length, 1);
    // Eksporten før slettingen: listen, bedriften bak kontakten og notater på søknaden.
    const { exportUserData } = await import("@/lib/account");
    const [jobRow] = await db.insert(schema.job).values({ companyId, title: "Utvikler", status: "published", applyMode: "vis" }).returning({ id: schema.job.id });
    const [app] = await db.insert(schema.jobApplication).values({ jobId: jobRow.id, userId: candidate, message: "Hei" }).returning({ id: schema.jobApplication.id });
    await db.insert(schema.applicationNote).values({ applicationId: app.id, authorId: owner, body: "Godt prosjekt" });
    const data = await exportUserData(candidate);
    assert.equal(data.companiesAndYou.talentLists[0]?.list, "Sommerjobb");
    assert.equal(data.companiesAndYou.talentLists[0]?.note, "Sterk på React");
    assert.ok(data.contactRequests.received.some((c) => c.company === "Personvernfirma"));
    assert.deepEqual(data.companiesAndYou.applicationNotes.map((n) => n.body), ["Godt prosjekt"]);
    assert.ok(data.companiesAndYou.activity.some((a) => a.action === "list.added" && a.company === "Personvernfirma"));
    assert.ok(!JSON.stringify(data.companiesAndYou).includes(owner), "ikke hvem i bedriften");

    await setProfileFlags(candidate, { visibleToCompanies: false });
    const afterRows = await db.select().from(schema.talentListMember).where(eq(schema.talentListMember.userId, candidate));
    assert.equal(afterRows.length, 0);
    await setProfileFlags(candidate, { visibleToCompanies: true });
  });

  test("runRetention sletter utløpte søknader, og en lukket stilling forkorter bare lagringstiden", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq, sql } = await import("drizzle-orm");
    const { runRetention } = await import("@/lib/retention");
    const { jobApplication } = schema;
    const day = 24 * 3600 * 1000;

    const [open, closed] = await db
      .insert(schema.job)
      .values([
        { companyId, title: "Åpen", status: "published", applyMode: "vis" },
        { companyId, title: "Lukket", status: "closed", applyMode: "vis", closedAt: sql`now() - interval '10 days'` },
      ])
      .returning({ id: schema.job.id });
    const [expired, onOpen, onClosed, withdrawn] = await db
      .insert(jobApplication)
      .values([
        { jobId: open.id, userId: other, expiresAt: sql`now() - interval '1 day'` },
        { jobId: open.id, userId: admin },
        { jobId: closed.id, userId: other },
        { jobId: closed.id, userId: recruiter, status: "trukket", expiresAt: sql`now() + interval '20 days'` },
      ])
      .returning({ id: jobApplication.id, expiresAt: jobApplication.expiresAt });

    await runRetention();
    const left = await db.select({ id: jobApplication.id, expiresAt: jobApplication.expiresAt }).from(jobApplication).where(sql`${jobApplication.jobId} in (${open.id}, ${closed.id})`);
    const get = (id: string) => left.find((r) => r.id === id);
    assert.equal(get(expired.id), undefined, "utløpt søknad er slettet");
    assert.equal(get(onOpen.id)?.expiresAt.getTime(), onOpen.expiresAt.getTime(), "åpen stilling: uendret");
    const closedExpiry = get(onClosed.id)!.expiresAt.getTime();
    // Lukket for 10 dager siden + 6 måneder (Gratis-regelen er ikke i bruk; Bedrift har valgt 6).
    assert.ok(closedExpiry < onClosed.expiresAt.getTime() - 150 * day, "lukket stilling: kortet ned");
    assert.ok(closedExpiry > Date.now() + 160 * day);
    assert.equal(get(withdrawn.id)?.expiresAt.getTime(), withdrawn.expiresAt.getTime(), "en kortere dato forlenges aldri");

    // Gjenåpnes stillingen, eller velger bedriften 12 måneder, forlenges ingenting.
    await db.update(schema.job).set({ status: "published", closedAt: null }).where(eq(schema.job.id, closed.id));
    const { setRetentionMonths } = await import("@/lib/company-privacy");
    await setRetentionMonths(owner, companyId, 12);
    await runRetention();
    const [again] = await db.select({ expiresAt: jobApplication.expiresAt }).from(jobApplication).where(eq(jobApplication.id, onClosed.id));
    assert.equal(again.expiresAt.getTime(), closedExpiry);

    let purged: (typeof schema.companyAudit.$inferSelect)[] = [];
    purged = await db.select().from(schema.companyAudit).where(and(eq(schema.companyAudit.companyId, companyId), eq(schema.companyAudit.action, "retention.purged")));
    assert.equal(purged.length, 1);
    assert.equal(purged[0].meta.n, 1);
    await assert.rejects(setRetentionMonths(owner, companyId, 7), /3, 6 eller 12/);
    await assert.rejects(setRetentionMonths(recruiter, companyId, 3), /Rollen/);
  });

  test("webhooks: ingenting sendes uten Bedrift, og uten samtykke fjernes kandidaten", async () => {
    const { db, schema } = await import("@/db");
    const { eq, sql } = await import("drizzle-orm");
    const { dispatchWebhook } = await import("@/lib/webhooks");
    const bodies: string[] = [];
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        bodies.push(body);
        res.end("ok");
      });
    });
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const [hook] = await db
      .insert(schema.companyWebhook)
      .values({ companyId, url: `http://127.0.0.1:${port}/hook`, secret: "whsec_test", events: ["job.application"], createdById: owner })
      .returning({ id: schema.companyWebhook.id });
    const payload = { application: { id: "a1", status: "ny", message: "Hei" }, job: { id: "j1" }, candidate: { name: "Kari", email: "kari@test.no" } };

    await dispatchWebhook(companyId, "job.application", payload);
    assert.equal(bodies.length, 1);
    const sent = JSON.parse(bodies[0]);
    assert.equal(sent.data.candidate, undefined);
    assert.equal(sent.data.application.message, undefined);
    assert.equal(sent.data.application.id, "a1");

    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    await dispatchWebhook(companyId, "job.application", payload);
    assert.equal(bodies.length, 1, "ingen levering uten Bedrift");
    const deliveries = await db.select().from(schema.webhookDelivery).where(eq(schema.webhookDelivery.webhookId, hook.id));
    assert.equal(deliveries.length, 1);

    // Den som la den til, forlater bedriften: webhooken slås av.
    const { disableWebhooksCreatedBy } = await import("@/lib/webhooks");
    assert.equal(await disableWebhooksCreatedBy(companyId, owner), 1);
    const [row] = await db.select({ active: schema.companyWebhook.active }).from(schema.companyWebhook).where(eq(schema.companyWebhook.id, hook.id));
    assert.equal(row.active, false);
  });
});
