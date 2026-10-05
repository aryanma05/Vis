import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";

// Trenger en database (lokalt fra .env.local, i CI fra DATABASE_URL). Hoppes over uten.
try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("begrensninger i databasen", { skip }, () => {
  const key = `test:${randomUUID()}`;

  after(async () => {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from rate_bucket where key like 'test:%'`);
    // Ellers holder tilkoblingen prosessen i live, og testkjøringen blir aldri ferdig.
    await db.$client.end();
  });

  test("teller opp til grensen og stopper", async () => {
    const { hit } = await import("@/lib/rate-limit");
    const rule = { limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit(key, rule));
    assert.deepEqual(
      results.map((r) => r.ok),
      [true, true, true, false, false],
    );
    assert.equal(results[2].remaining, 0);
  });

  test("samtidige forsøk slipper ikke forbi grensen", async () => {
    const { hit } = await import("@/lib/rate-limit");
    const rule = { limit: 5, windowSeconds: 60 };
    const k = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 12 }, () => hit(k, rule)));
    assert.equal(results.filter((r) => r.ok).length, 5);
  });

  test("starter på nytt når vinduet er over", async () => {
    const { hit } = await import("@/lib/rate-limit");
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const k = `test:${randomUUID()}`;
    const rule = { limit: 1, windowSeconds: 60 };
    assert.equal((await hit(k, rule)).ok, true);
    assert.equal((await hit(k, rule)).ok, false);
    await db.execute(sql`update rate_bucket set window_start = now() - interval '2 minutes' where key = ${k}`);
    assert.equal((await hit(k, rule)).ok, true);
  });

  test("enforce gir en melding brukeren kan lese", async () => {
    const { enforce, RULES } = await import("@/lib/rate-limit");
    const id = randomUUID();
    for (let i = 0; i < RULES.contact.limit; i++) await enforce("contact", id);
    await assert.rejects(enforce("contact", id), { name: "UserFacingError", message: RULES.contact.message });
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`delete from rate_bucket where key = ${`contact:${id}`}`);
  });
});
