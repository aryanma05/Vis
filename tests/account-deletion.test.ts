import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("sletting av konto med abonnement og bedrifter", { skip }, () => {
  const alone = `test-${randomUUID()}`;
  const colleague = `test-${randomUUID()}`;

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from subscription where owner_id = ${alone}`);
    await db.execute(sql`delete from company where created_by_id in (${alone}, ${colleague})`);
    for (const id of [alone, colleague]) await db.execute(sql`delete from "user" where id = ${id}`);
    await db.$client.end();
  });

  test("bedrifter får ny eier, eller slettes når ingen andre er medlem", async () => {
    const { db, schema } = await import("@/db");
    const { and, eq } = await import("drizzle-orm");
    for (const id of [alone, colleague]) {
      await db.insert(schema.user).values({ id, name: "Test", email: `${id}@test.no`, emailVerified: true, username: id.slice(0, 30) });
    }
    const { createCompany, releaseCompaniesOf } = await import("@/lib/companies");
    const solo = await createCompany(alone, { name: `Solo ${alone.slice(-6)}`, acceptTerms: true });
    const shared = await createCompany(alone, { name: `Delt ${alone.slice(-6)}`, acceptTerms: true });
    await db.insert(schema.companyMember).values({ companyId: shared.id, userId: colleague, role: "member" });

    await releaseCompaniesOf(alone);
    assert.equal((await db.select().from(schema.company).where(eq(schema.company.id, solo.id))).length, 0);
    const [promoted] = await db
      .select({ role: schema.companyMember.role })
      .from(schema.companyMember)
      .where(and(eq(schema.companyMember.companyId, shared.id), eq(schema.companyMember.userId, colleague)));
    assert.equal(promoted.role, "owner");
  });

  test("et aktivt abonnement som ikke kan avsluttes stopper slettingen", async (t) => {
    if (process.env.STRIPE_SECRET_KEY) return t.skip("Stripe er satt opp; testen ville kalt Stripe");
    const { db, schema } = await import("@/db");
    const { prepareAccountDeletion } = await import("@/lib/account");
    await db.insert(schema.subscription).values({ id: `sub_test_${randomUUID()}`, ownerType: "user", ownerId: alone, plan: "pro", status: "active" });
    await assert.rejects(prepareAccountDeletion(alone), /avsluttet abonnementet/);
  });
});
