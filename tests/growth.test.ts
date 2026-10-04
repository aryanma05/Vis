import assert from "node:assert/strict";
import { describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

describe("avmelding fra ukesoppsummeringen", { skip }, () => {
  test("lenken er signert per bruker", async () => {
    const { unsubscribeUrl, verifyUnsubscribe } = await import("@/lib/digest");
    const url = new URL(unsubscribeUrl("bruker-1"));
    const token = url.searchParams.get("t")!;
    assert.equal(url.searchParams.get("u"), "bruker-1");
    assert.equal(verifyUnsubscribe("bruker-1", token), true);
    assert.equal(verifyUnsubscribe("bruker-2", token), false);
    assert.equal(verifyUnsubscribe("bruker-1", "feil"), false);
    const { db } = await import("@/db");
    await db.$client.end();
  });
});

describe("innbygging", () => {
  test("escaper HTML i navn og titler", async () => {
    const { escapeHtml } = await import("@/lib/embed");
    assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  test("merket blir bredere med lengre tekst", async () => {
    const { textWidth } = await import("@/lib/embed");
    assert.ok(textWidth("@ola · 12 prosjekter") > textWidth("@ola"));
  });
});
