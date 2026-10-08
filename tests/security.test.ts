import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  adminNeeds2fa,
  authThrottleFor,
  checkAuthBody,
  identifierKey,
  isAdminUser,
  isBlockedAuthPath,
} from "@/lib/auth-rules";
import { authError } from "@/lib/auth-errors";
import { contentSecurityPolicy } from "@/lib/csp";
import { isPdf, sniffImageType } from "@/lib/file-signatures";
import { ipFromHeaders } from "@/lib/request-ip";
import { safeInternalPath } from "@/lib/safe-path";

// Sikkerhetsreglene som ikke trenger database. Tilgang mellom brukere testes i
// tests/access-control.test.ts (krever en testdatabase).

describe("Better Auth sine admin-endepunkter er stengt", () => {
  test("alle stier under /admin blokkeres, også med store bokstaver", () => {
    for (const path of ["/admin/impersonate-user", "/admin/set-user-password", "/admin/list-users", "/admin/set-role", "/ADMIN/remove-user", "/admin"]) {
      assert.equal(isBlockedAuthPath(path), true, path);
    }
  });

  test("vanlige innloggingsstier slipper gjennom", () => {
    for (const path of ["/sign-in/email", "/get-session", "/two-factor/verify-totp", "/administrator", "/update-user"]) {
      assert.equal(isBlockedAuthPath(path), false, path);
    }
  });
});

describe("feltene Better Auth tar imot", () => {
  const signUp = { name: "Kari", email: "kari@test.no", password: "passord123" };

  test("registrering godtar bare feltene skjemaet sender", () => {
    assert.equal(checkAuthBody("/sign-up/email", signUp), null);
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, username: "kari", displayUsername: "Kari" }), null);
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, image: "https://sporing.example/p.gif" }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, role: "admin" }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, twoFactorEnabled: true }), "Ugyldig forespørsel.");
  });

  test("navnet må finnes og ha maks 100 tegn", () => {
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, name: "   " }), "Skriv inn navnet ditt.");
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, name: "x".repeat(101) }), "Navnet kan ha maks 100 tegn.");
  });

  test("visningsnavnet må være brukernavnet", () => {
    assert.equal(checkAuthBody("/sign-up/email", { ...signUp, username: "kari", displayUsername: "Admin" }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/update-user", { displayUsername: "Hvem som helst" }), "Ugyldig forespørsel.");
  });

  test("update-user kan bare endre brukernavnet (ikke navn, bilde eller rolle)", () => {
    assert.equal(checkAuthBody("/update-user", { username: "ny", displayUsername: "Ny" }), null);
    assert.equal(checkAuthBody("/update-user", { name: "x".repeat(10_000) }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/update-user", { image: "https://sporing.example/p.gif" }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/update-user", { username: "ny", role: "admin" }), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/update-user", null), "Ugyldig forespørsel.");
    assert.equal(checkAuthBody("/update-user", ["username"]), "Ugyldig forespørsel.");
  });

  test("andre stier sjekkes ikke her", () => {
    assert.equal(checkAuthBody("/sign-in/email", { email: "a@b.no", password: "x", hva: "som helst" }), null);
  });
});

describe("grenser per konto og e-postadresse", () => {
  test("innlogging telles per konto, uavhengig av store bokstaver og @", () => {
    const a = authThrottleFor("/sign-in/email", { email: "Kari@Test.no", password: "x" });
    const b = authThrottleFor("/sign-in/email", { email: " kari@test.no ", password: "y" });
    assert.deepEqual(a, b);
    assert.equal(a?.rule, "loginAccount");
    assert.deepEqual(authThrottleFor("/sign-in/username", { username: "@Kari" }), { rule: "loginAccount", key: identifierKey("kari") });
  });

  test("e-poster med kode telles per adresse", () => {
    for (const path of ["/email-otp/send-verification-otp", "/email-otp/request-password-reset", "/request-password-reset", "/send-verification-email"]) {
      assert.equal(authThrottleFor(path, { email: "kari@test.no" })?.rule, "authEmail", path);
    }
  });

  test("adressen lagres ikke i klartekst", () => {
    const key = authThrottleFor("/sign-in/email", { email: "kari@test.no" })!.key;
    assert.ok(!key.includes("kari"));
    assert.match(key, /^[0-9a-f]{32}$/);
  });

  test("ingenting å telle uten identifikator, eller på andre stier", () => {
    assert.equal(authThrottleFor("/sign-in/email", {}), null);
    assert.equal(authThrottleFor("/sign-in/email", { email: 42 }), null);
    assert.equal(authThrottleFor("/sign-in/email", null), null);
    assert.equal(authThrottleFor("/get-session", { email: "kari@test.no" }), null);
  });

  test("grensene gir egne meldinger, ikke «vent et minutt»", () => {
    assert.match(authError({ status: 429, code: "ACCOUNT_THROTTLED" }).message, /denne kontoen/);
    assert.match(authError({ status: 429, code: "EMAIL_THROTTLED" }).message, /denne adressen/);
    assert.match(authError({ status: 429 }).message, /Vent et minutt/);
  });
});

describe("hvem som er admin", () => {
  const admins = new Set(["admin@vis.no"]);

  test("rollen admin i databasen", () => {
    assert.equal(isAdminUser({ role: "admin", email: "hvem@vis.no" }, admins), true);
    assert.equal(isAdminUser({ role: "user", email: "hvem@vis.no", emailVerified: true }, admins), false);
    assert.equal(isAdminUser(null, admins), false);
  });

  test("ADMIN_EMAILS gjelder bare med bekreftet e-post", () => {
    assert.equal(isAdminUser({ email: "Admin@Vis.no", emailVerified: true }, admins), true);
    assert.equal(isAdminUser({ email: "admin@vis.no", emailVerified: false }, admins), false);
    assert.equal(isAdminUser({ email: "admin@vis.no" }, admins), false);
  });

  test("i produksjon kreves to-trinns innlogging", () => {
    assert.equal(adminNeeds2fa({ twoFactorEnabled: false }, { NODE_ENV: "production" }), true);
    assert.equal(adminNeeds2fa({}, { NODE_ENV: "production" }), true);
    assert.equal(adminNeeds2fa({ twoFactorEnabled: true }, { NODE_ENV: "production" }), false);
    assert.equal(adminNeeds2fa({ twoFactorEnabled: false }, { NODE_ENV: "development" }), false);
  });
});

describe("klientens IP-adresse", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  test("uten TRUSTED_IP_HEADER brukes første verdi i X-Forwarded-For", () => {
    assert.equal(ipFromHeaders(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }), {}), "203.0.113.5");
    assert.equal(ipFromHeaders(h({}), {}), "lokal");
  });

  test("TRUSTED_IP_HEADER går foran en forfalsket X-Forwarded-For", () => {
    const headers = h({ "x-forwarded-for": "1.2.3.4, 198.51.100.7", "cf-connecting-ip": "198.51.100.7" });
    assert.equal(ipFromHeaders(headers, { TRUSTED_IP_HEADER: "CF-Connecting-IP" }), "198.51.100.7");
  });

  test("mangler den betrodde headeren, brukes resten som før", () => {
    assert.equal(ipFromHeaders(h({ "x-forwarded-for": "203.0.113.5" }), { TRUSTED_IP_HEADER: "true-client-ip" }), "203.0.113.5");
  });

  test("på Vercel brukes X-Real-IP", () => {
    assert.equal(ipFromHeaders(h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.9" }), { VERCEL: "1" }), "203.0.113.9");
  });
});

describe("Content-Security-Policy", () => {
  const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

  test("produksjon: ingen eval, ingen innramming, ingen plugins, bare egne skjemaer", () => {
    const csp = contentSecurityPolicy({ NODE_ENV: "production" });
    assert.ok(!directive(csp, "script-src").includes("'unsafe-eval'"));
    assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
    assert.equal(directive(csp, "object-src"), "object-src 'none'");
    assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
    assert.equal(directive(csp, "form-action"), "form-action 'self'");
    assert.equal(directive(csp, "connect-src"), "connect-src 'self'");
    assert.ok(csp.includes("upgrade-insecure-requests"));
  });

  test("skript bare fra appen selv, og statistikken når den er slått på", () => {
    const none = contentSecurityPolicy({ NODE_ENV: "production" });
    assert.ok(!/https:/.test(directive(none, "script-src")));
    const plausible = contentSecurityPolicy({ NODE_ENV: "production", NEXT_PUBLIC_PLAUSIBLE_DOMAIN: "vis.no" });
    assert.ok(directive(plausible, "script-src").includes("https://plausible.io"));
    assert.ok(directive(plausible, "connect-src").includes("https://plausible.io"));
    const own = contentSecurityPolicy({ NODE_ENV: "production", NEXT_PUBLIC_UMAMI_WEBSITE_ID: "x", NEXT_PUBLIC_UMAMI_SRC: "https://stats.vis.no/script.js" });
    assert.ok(directive(own, "script-src").includes("https://stats.vis.no"));
  });

  test("videospillerne som kan bygges inn er tillatt i iframes", () => {
    const frames = directive(contentSecurityPolicy({ NODE_ENV: "production" }), "frame-src");
    for (const host of ["https://www.youtube-nocookie.com", "https://player.vimeo.com", "https://www.loom.com", "https://www.figma.com"]) {
      assert.ok(frames.includes(host), host);
    }
  });

  test("utvikling tillater eval og websocket (hot reload)", () => {
    const csp = contentSecurityPolicy({ NODE_ENV: "development" });
    assert.ok(directive(csp, "script-src").includes("'unsafe-eval'"));
    assert.ok(directive(csp, "connect-src").includes("ws:"));
    assert.ok(!csp.includes("upgrade-insecure-requests"));
  });
});

describe("åpne videresendinger", () => {
  test("bare interne stier godtas", () => {
    assert.equal(safeInternalPath("/profil/rediger"), "/profil/rediger");
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "", null, undefined]) {
      assert.equal(safeInternalPath(bad), null, String(bad));
    }
  });
});

describe("filtyper avgjøres av innholdet", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  test("HTML, SVG og skript med bildenavn avvises", () => {
    assert.equal(sniffImageType(bytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
    assert.equal(sniffImageType(bytes("<!doctype html><script>alert(1)</script>")), null);
    assert.equal(isPdf(bytes("<html>%PDF-1.7")), false);
  });

  test("ekte signaturer gjenkjennes", () => {
    assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(isPdf(bytes("%PDF-1.7\n")), true);
  });
});
