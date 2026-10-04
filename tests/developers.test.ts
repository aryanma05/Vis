import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("API-nøkler og webhooks", { skip }, () => {
  const owner = `test-${randomUUID()}`;
  const other = `test-${randomUUID()}`;
  const received: { headers: IncomingHttpHeaders; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.writeHead(200).end("ok");
    });
  });
  let companyId = "";

  before(async () => {
    const { db, schema } = await import("@/db");
    for (const id of [owner, other]) {
      await db.insert(schema.user).values({ id, name: "Test", email: `${id}@test.no`, username: id.slice(0, 30) });
    }
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { createCompany } = await import("@/lib/companies");
    companyId = (await createCompany(owner, { name: `Testfirma ${owner.slice(-6)}` })).id;
  });

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    server.close();
    await db.execute(sql`delete from company where id = ${companyId}`);
    await db.execute(sql`delete from plan_grant where owner_id = ${companyId}`);
    for (const id of [owner, other]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("en nøkkel virker til den trekkes tilbake, og bare eieren kan trekke den", async () => {
    const { authenticateApiKey, createApiKey, listApiKeys, revokeApiKey } = await import("@/lib/api-keys");
    const key = await createApiKey(owner, "  Nettsiden min  ");
    assert.match(key, /^vis_[A-Za-z0-9_-]{30,}$/);
    assert.equal((await authenticateApiKey(`Bearer ${key}`))?.userId, owner);
    assert.equal(await authenticateApiKey(`Bearer ${key}x`), null);
    assert.equal(await authenticateApiKey(key), null);

    const [listed] = await listApiKeys(owner);
    assert.equal(listed.name, "Nettsiden min");
    assert.equal(listed.prefix, key.slice(0, 10));

    await revokeApiKey(other, listed.id);
    assert.ok(await authenticateApiKey(`Bearer ${key}`), "en annen bruker kan ikke trekke nøkkelen");
    await revokeApiKey(owner, "ikke-en-uuid");
    await revokeApiKey(owner, listed.id);
    assert.equal(await authenticateApiKey(`Bearer ${key}`), null);
  });

  test("høyst fem aktive nøkler", async () => {
    const { createApiKey, MAX_KEYS } = await import("@/lib/api-keys");
    for (let i = 0; i < MAX_KEYS; i++) await createApiKey(other, `nøkkel ${i}`);
    await assert.rejects(createApiKey(other, "en for mye"), /opptil 5/);
  });

  test("webhooks krever Bedrift og en trygg adresse", async () => {
    const { createWebhook } = await import("@/lib/webhooks");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    await assert.rejects(createWebhook(owner, companyId, { url, events: ["job.published"] }), /Bedrift/);

    const { grantPlan } = await import("@/lib/billing");
    await grantPlan(owner, "company", companyId, 30, "test");
    await assert.rejects(createWebhook(other, companyId, { url, events: ["job.published"] }));
    await assert.rejects(createWebhook(owner, companyId, { url: "http://example.com/hook", events: ["job.published"] }), /https/);
    await assert.rejects(createWebhook(owner, companyId, { url: "https://user:pw@example.com/", events: ["job.published"] }), /brukernavn/);
    await assert.rejects(createWebhook(owner, companyId, { url, events: ["finnes.ikke"] }), /minst én/);
  });

  test("leveringen er signert og logges", async () => {
    const { createWebhook, dispatchWebhook, listDeliveries, listWebhooks, sendTestWebhook } = await import("@/lib/webhooks");
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    const { secret } = await createWebhook(owner, companyId, { url, events: ["job.published"] });
    const [hook] = await listWebhooks(owner, companyId);
    assert.ok(!("secret" in hook), "hemmeligheten vises ikke i listen");

    const result = await sendTestWebhook(owner, hook.id);
    assert.deepEqual(result, { ok: true, status: 200 });
    const ping = received.at(-1)!;
    assert.equal(ping.headers["vis-event"], "ping");
    const { t, v1 } = Object.fromEntries(String(ping.headers["vis-signature"]).split(",").map((p) => p.split("=")));
    assert.equal(v1, createHmac("sha256", secret).update(`${t}.${ping.body}`).digest("hex"));
    assert.equal(JSON.parse(ping.body).type, "ping");

    // Bare hendelser webhooken lytter etter blir sendt.
    const before = received.length;
    await dispatchWebhook(companyId, "job.closed", { job: { id: "x" } });
    assert.equal(received.length, before);
    await dispatchWebhook(companyId, "job.published", { job: { id: "y" } });
    assert.equal(received.length, before + 1);
    assert.equal(JSON.parse(received.at(-1)!.body).data.job.id, "y");

    const deliveries = await listDeliveries(owner, hook.id);
    assert.equal(deliveries.length, 2);
    assert.ok(deliveries.every((d) => d.ok && d.statusCode === 200));
  });
});
