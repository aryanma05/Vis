import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkEnv, envProblems } from "@/lib/env";

const status = (env: Record<string, string>, key: string) => checkEnv(env).find((c) => c.key === key)?.status;

describe("sjekk av oppsettet", () => {
  test("mangler database og hemmelighet i produksjon", () => {
    const env = { NODE_ENV: "production" };
    assert.equal(status(env, "DATABASE_URL"), "error");
    assert.equal(status(env, "BETTER_AUTH_SECRET"), "error");
    assert.equal(status(env, "BREVO_API_KEY / RESEND_API_KEY"), "error");
  });

  test("kort hemmelighet godtas ikke", () => {
    assert.equal(status({ NODE_ENV: "production", BETTER_AUTH_SECRET: "kort" }, "BETTER_AUTH_SECRET"), "error");
    assert.equal(status({ BETTER_AUTH_SECRET: "x".repeat(40) }, "BETTER_AUTH_SECRET"), "ok");
  });

  test("Stripe uten webhook-hemmelighet er en feil", () => {
    assert.equal(status({ STRIPE_SECRET_KEY: "sk_test_123" }, "STRIPE_WEBHOOK_SECRET"), "error");
    assert.equal(status({}, "STRIPE_SECRET_KEY"), "info");
  });

  test("komplett oppsett har ingen problemer", () => {
    const env = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      BETTER_AUTH_SECRET: "x".repeat(40),
      BETTER_AUTH_URL: "https://vis.no",
      ADMIN_EMAILS: "a@vis.no",
      BREVO_API_KEY: "k",
      EMAIL_FROM: "Vis <hei@vis.no>",
      CONTACT_EMAIL: "hei@vis.no",
      GITHUB_TOKEN: "t",
      CRON_SECRET: "c",
      STRIPE_SECRET_KEY: "sk_live_1",
      STRIPE_WEBHOOK_SECRET: "whsec_1",
      STRIPE_PRICE_PRO_MONTHLY: "price_1",
      STRIPE_PRICE_PRO_YEARLY: "price_2",
      STRIPE_PRICE_BUSINESS_MONTHLY: "price_3",
      TRUSTED_IP_HEADER: "cf-connecting-ip",
    };
    assert.deepEqual(envProblems(env), []);
  });

  test("IP-headeren må settes i produksjon (unntatt på Vercel)", () => {
    assert.equal(status({ NODE_ENV: "production" }, "TRUSTED_IP_HEADER"), "warn");
    assert.equal(status({ NODE_ENV: "production", VERCEL: "1" }, "TRUSTED_IP_HEADER"), "info");
    assert.equal(status({}, "TRUSTED_IP_HEADER"), "info");
    assert.equal(status({ NODE_ENV: "production", TRUSTED_IP_HEADER: "true-client-ip" }, "TRUSTED_IP_HEADER"), "ok");
  });

  test("viser aldri verdiene", () => {
    const text = JSON.stringify(checkEnv({ BETTER_AUTH_SECRET: "superhemmelig-verdi-som-er-lang-nok-123" }));
    assert.ok(!text.includes("superhemmelig"));
  });
});
