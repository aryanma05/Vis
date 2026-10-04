import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { encodeForm, signWebhook, verifyWebhook } from "@/lib/stripe";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("Stripe uten nettverk", () => {
  test("skjemakoding med hakeparenteser", () => {
    const body = encodeForm({ mode: "subscription", line_items: [{ price: "price_1", quantity: 1 }], metadata: { userId: "u 1" }, skip: undefined }).join("&");
    assert.equal(body, "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5BuserId%5D=u%201");
  });

  test("godtar en riktig signert webhook", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });
    const event = verifyWebhook(payload, signWebhook(payload, "whsec_test"), "whsec_test");
    assert.equal(event.id, "evt_1");
  });

  test("avviser feil hemmelighet, endret innhold og gamle hendelser", () => {
    const payload = JSON.stringify({ id: "evt_2", type: "x", data: { object: {} } });
    assert.throws(() => verifyWebhook(payload, signWebhook(payload, "annen"), "whsec_test"), /Signaturen/);
    assert.throws(() => verifyWebhook(`${payload} `, signWebhook(payload, "whsec_test"), "whsec_test"), /Signaturen/);
    const old = Math.floor(Date.now() / 1000) - 3600;
    assert.throws(() => verifyWebhook(payload, signWebhook(payload, "whsec_test", old), "whsec_test"), /for gammel/);
    assert.throws(() => verifyWebhook(payload, null, "whsec_test"), /Mangler/);
  });
});

describe("abonnementer i databasen", { skip }, () => {
  const ids: string[] = [];

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from subscription where owner_id like 'test-%'`);
    await db.execute(sql`delete from plan_grant where owner_id like 'test-%'`);
    await db.execute(sql`delete from stripe_event where id like 'evt_test_%'`);
    for (const id of ids) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("et aktivt abonnement gir Pro, et avsluttet gjør det ikke", async () => {
    const { getPlanState, syncSubscription } = await import("@/lib/billing");
    const owner = `test-${randomUUID()}`;
    const sub = {
      id: `sub_test_${randomUUID()}`,
      customer: "cus_test",
      status: "active",
      cancel_at_period_end: false,
      metadata: { ownerType: "user", ownerId: owner, plan: "pro" },
      items: { data: [{ price: { id: "price_x", unit_amount: 5900, currency: "nok", recurring: { interval: "month" as const }, product: "p", active: true }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] },
    };
    await syncSubscription(sub);
    assert.equal((await getPlanState("user", owner)).plan, "pro");
    await syncSubscription({ ...sub, status: "canceled" });
    assert.equal((await getPlanState("user", owner)).plan, "free");
  });

  test("Pro gitt av admin, med og uten sluttdato", async () => {
    const { db, schema } = await import("@/db");
    const { getPlanState, grantPlan, revokeGrant } = await import("@/lib/billing");
    const adminId = `test-admin-${randomUUID()}`;
    await db.insert(schema.user).values({ id: adminId, name: "Admin", email: `${adminId}@test.no`, username: adminId.slice(0, 30) });
    ids.push(adminId);
    const owner = `test-${randomUUID()}`;
    await grantPlan(adminId, "user", owner, 30, "ambassadør");
    const state = await getPlanState("user", owner);
    assert.equal(state.plan, "pro");
    assert.equal(state.source, "grant");
    await revokeGrant(adminId, "user", owner);
    assert.equal((await getPlanState("user", owner)).plan, "free");
  });

  test("samme webhook-hendelse behandles bare én gang", async () => {
    const { handleStripeEvent } = await import("@/lib/billing");
    const event = { id: `evt_test_${randomUUID()}`, type: "invoice.paid", data: { object: {} } };
    assert.equal(await handleStripeEvent(event), "ok");
    assert.equal(await handleStripeEvent(event), "duplikat");
  });
});
