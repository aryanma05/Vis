import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

try {
  process.loadEnvFile(".env.local");
} catch {}
const skip = !process.env.DATABASE_URL && "DATABASE_URL er ikke satt";

// Serverens nøkkel leses når modulen lastes, så den settes før importen under.
process.env.GITHUB_TOKEN = "server-token";

type Call = { url: string; auth: string | null };

// Bytter ut fetch med en falsk GitHub. `respond` får adressen og nøkkelen som ble brukt.
function fakeGithub(respond: (url: string, auth: string | null) => Response) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const auth = new Headers(init?.headers).get("authorization");
    calls.push({ url, auth });
    return respond(url, auth);
  }) as typeof fetch;
  return calls;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const repo = (fullName: string) => ({
  id: 42,
  name: fullName.split("/")[1],
  full_name: fullName,
  description: "En liten app",
  html_url: `https://github.com/${fullName}`,
  homepage: null,
  language: "TypeScript",
  topics: ["hacktoberfest", "nextjs"],
  stargazers_count: 3,
  fork: false,
  archived: false,
  private: false,
  pushed_at: "2026-01-01T00:00:00Z",
  created_at: "2025-05-01T00:00:00Z",
  default_branch: "main",
  owner: { login: fullName.split("/")[0] },
});

describe("GitHub-import", { skip }, () => {
  const realFetch = globalThis.fetch;
  after(async () => {
    globalThis.fetch = realFetch;
    const { db } = await import("@/db");
    await db.$client.end();
  });

  test("forstår brukernavn, repo-lenker og git-adresser", async () => {
    const { parseGithubInput } = await import("@/lib/github");
    assert.deepEqual(parseGithubInput("ola"), { kind: "user", login: "ola" });
    assert.deepEqual(parseGithubInput("https://github.com/ola/app/tree/main/src"), { kind: "repo", fullName: "ola/app" });
    assert.deepEqual(parseGithubInput("git@github.com:ola/app.git"), { kind: "repo", fullName: "ola/app" });
    assert.equal(parseGithubInput("ikke et navn!"), null);
  });

  test("henter README fra raw.githubusercontent.com og bruker serverens nøkkel", async () => {
    const calls = fakeGithub((url) => {
      if (url === "https://api.github.com/repos/ola/app") return json(repo("ola/app"));
      if (url === "https://raw.githubusercontent.com/ola/app/HEAD/README.md") return new Response("# app\n\nHei ![skjerm](docs/skjerm.png)");
      if (url.endsWith("/languages")) return json({ TypeScript: 900, Shell: 100 });
      if (url.includes("/commits/main")) return new Response("abc123");
      if (url.endsWith("/graphql")) return json({ data: { repository: { usesCustomOpenGraphImage: false } } });
      return json({ message: "Not Found" }, 404);
    });
    const { buildRepoImport } = await import("@/lib/github");
    const draft = await buildRepoImport("ola/app", null);

    assert.equal(draft.input.title, "App");
    assert.match(draft.input.description, /^Hei/);
    assert.deepEqual(draft.input.tags, ["TypeScript", "nextjs"]);
    assert.equal(draft.images[0].url, "https://raw.githubusercontent.com/ola/app/abc123/docs/skjerm.png");
    // README-en kom ikke fra API-et, og API-kallene brukte serverens nøkkel.
    assert.ok(!calls.some((c) => c.url.endsWith("/readme")));
    assert.ok(calls.filter((c) => c.url.startsWith("https://api.github.com/repos")).every((c) => c.auth === "Bearer server-token"));
  });

  test("ugyldig GITHUB_TOKEN faller tilbake til anonym, og nådd grense gir en tydelig melding", async () => {
    const reset = Math.floor(Date.now() / 1000) + 20 * 60;
    const calls = fakeGithub((url, auth) => {
      if (auth) return json({ message: "Bad credentials" }, 401);
      return json({ message: "API rate limit exceeded for 1.2.3.4." }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) });
    });
    const { buildRepoImport, GithubRateLimited } = await import("@/lib/github");

    await assert.rejects(buildRepoImport("kari/annet", null), (error: unknown) => {
      assert.ok(error instanceof GithubRateLimited);
      assert.match((error as Error).message, /Prøv igjen om (19|20) min\./);
      return true;
    });
    assert.deepEqual(
      calls.map((c) => c.auth),
      ["Bearer server-token", null],
    );

    // Neste forsøk spør ikke GitHub før grensen er nullstilt.
    calls.length = 0;
    await assert.rejects(buildRepoImport("kari/tredje", null), GithubRateLimited);
    assert.equal(calls.length, 0);
  });
});
