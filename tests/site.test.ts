import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { redirectsToSite, siteUrl } from "@/lib/site";

const KEYS = ["BETTER_AUTH_URL", "RENDER_EXTERNAL_URL", "RENDER_EXTERNAL_HOSTNAME", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"];

function withEnv(env: Record<string, string>, run: () => void) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, env);
  try {
    run();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("appens adresse", () => {
  test("eget domene: www og Render-adressen sendes dit", () => {
    withEnv(
      { BETTER_AUTH_URL: "https://visplatform.no", RENDER_EXTERNAL_URL: "https://vis.onrender.com", RENDER_EXTERNAL_HOSTNAME: "vis.onrender.com" },
      () => {
        assert.equal(siteUrl(), "https://visplatform.no");
        assert.equal(redirectsToSite("visplatform.no"), false);
        assert.equal(redirectsToSite("www.visplatform.no"), true);
        assert.equal(redirectsToSite("vis.onrender.com"), true);
        assert.equal(redirectsToSite("ola.no"), false);
      },
    );
  });

  test("uten eget domene sendes ingenting videre", () => {
    withEnv({ RENDER_EXTERNAL_URL: "https://vis.onrender.com", RENDER_EXTERNAL_HOSTNAME: "vis.onrender.com" }, () => {
      assert.equal(siteUrl(), "https://vis.onrender.com");
      assert.equal(redirectsToSite("vis.onrender.com"), false);
    });
    withEnv({}, () => assert.equal(redirectsToSite("localhost"), false));
  });
});
