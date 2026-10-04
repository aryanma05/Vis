import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { log } from "@/lib/log";
import { UserFacingError } from "@/lib/result";

// Skjermbilder av nettsiden til et prosjekt. Siden lastes i en nettleser i full
// desktop-bredde, og vi tar opptil tre bilder nedover siden (toppen og videre ned),
// så prosjektet får bilder med en gang. Brukeren kan fjerne, sortere og beskjære dem
// etterpå.
//
// Hvor nettleseren kjører:
// - SCREENSHOT_BROWSER_PATH satt: en lokal Chrome/Chromium (gratis og uten grense,
//   f.eks. i Docker eller under utvikling).
// - Ellers: Microlink (microlink.io). Gratis for 50 sider i døgnet uten nøkkel; med
//   MICROLINK_API_KEY brukes betalt kvote.
//
// Under utvikling (npm run dev) kan du også ta bilder av prosjekter som kjører på din
// egen maskin, f.eks. localhost:5173. Da brukes SCREENSHOT_BROWSER_PATH eller Google
// Chrome på maskinen. I produksjon blokkeres lokale adresser, så ingen kan bruke
// serveren til å se inn i nettverket den står i.

export const MAX_SCREENSHOTS = 3;

const VIEWPORT = { width: 1440, height: 900 };
const NAVIGATION_TIMEOUT = 25_000;
const SERVICE_TIMEOUT = 45_000;
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;

const ALLOW_LOCAL = process.env.NODE_ENV !== "production";

export type Screenshot = { bytes: Buffer; width: number; height: number };
// Tittel og beskrivelse fra siden (<title>, og:title, meta description), til å fylle ut skjemaet.
export type PageMeta = { title: string | null; description: string | null };

const cleanMeta = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/* -------------------------------------------------------------------------- */
/*  Hvilke adresser vi tar bilder av                                          */
/* -------------------------------------------------------------------------- */

function isPrivateIp(ip: string) {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(v);
  }
  return false;
}

function isPrivateHostname(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(h)) return isPrivateIp(h);
  return h === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(h) || !h.includes(".");
}

// Slår opp navnet og sjekker at det ikke peker inn i et lokalt nett.
export async function resolvesToPrivate(host: string) {
  if (isPrivateHostname(host)) return true;
  if (isIP(host.replace(/^\[|\]$/g, ""))) return false;
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address));
  } catch {
    return true;
  }
}

// Gjør «vis.no» om til «https://vis.no/» (og «localhost:5173» til «http://localhost:5173/»)
// og avviser alt som ikke er en offentlig nettside, unntatt lokale adresser under utvikling.
export function normalizeProjectUrl(input: string): string {
  let text = String(input ?? "").trim();
  if (!text) throw new UserFacingError("Skriv inn lenken til prosjektet først.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) && !/^https?:\/\//i.test(text)) {
    throw new UserFacingError("Lenken må starte med http:// eller https://.");
  }
  const hasScheme = /^https?:\/\//i.test(text);
  if (!hasScheme) text = `https://${text}`;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new UserFacingError("Det ser ikke ut som en gyldig lenke.");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new UserFacingError("Lenken må starte med http:// eller https://.");
  }
  if (isPrivateHostname(url.hostname)) {
    if (!ALLOW_LOCAL) throw new UserFacingError("Lenken må gå til en offentlig nettside.");
    // Lokale utviklingsservere svarer som regel bare på http.
    if (!hasScheme) url.protocol = "http:";
  }
  url.hash = "";
  return url.toString();
}

/* -------------------------------------------------------------------------- */
/*  Ta bildene                                                                */
/* -------------------------------------------------------------------------- */

// Høyst to nettlesere samtidig, så serveren ikke går tom for minne.
let running = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// Tar skjermbilder av en offentlig nettside. Returnerer WebP-bilder i 16:10.
export async function captureScreenshots(input: string, options: { max?: number } = {}): Promise<Screenshot[]> {
  return (await capturePage(input, options)).shots;
}

// Skjermbilder pluss tittel og beskrivelse fra siden.
export async function capturePage(input: string, { max = MAX_SCREENSHOTS }: { max?: number } = {}): Promise<{ shots: Screenshot[]; meta: PageMeta }> {
  const url = normalizeProjectUrl(input);
  const count = Math.max(1, Math.min(max, MAX_SCREENSHOTS));
  const browserPath = process.env.SCREENSHOT_BROWSER_PATH?.trim() || null;
  // Microlink når ikke maskinen din, så lokale adresser må tas med en lokal nettleser.
  const local = isPrivateHostname(new URL(url).hostname);

  const { frames, meta } = await withSlot(() =>
    browserPath || local ? captureWithBrowser(url, browserPath, count) : captureWithMicrolink(url, count),
  );

  const shots: Screenshot[] = [];
  for (const [i, frame] of frames.entries()) {
    const image = sharp(frame);
    // Hopp over flater som er helt ensfarget (f.eks. tomt nederst på siden), men behold det første bildet.
    if (i > 0) {
      const { channels } = await image.stats();
      if (channels.slice(0, 3).every((c) => c.stdev < 4)) continue;
    }
    const { data, info } = await image.webp({ quality: 86, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    shots.push({ bytes: data, width: info.width, height: info.height });
  }
  if (shots.length === 0) throw new UserFacingError("Siden ser tom ut. Sjekk at lenken virker.");
  return { shots, meta };
}

// Lokal Chrome/Chromium via Playwright. Siden blar nedover én skjermhøyde om gangen,
// så bilder som lastes inn når man blar, rekker å komme frem. Uten executablePath
// brukes Google Chrome som er installert på maskinen.
async function captureWithBrowser(url: string, executablePath: string | null, count: number): Promise<{ frames: Buffer[]; meta: PageMeta }> {
  const { chromium } = await import("playwright-core");
  let browser;
  try {
    browser = await chromium.launch({
      ...(executablePath ? { executablePath } : { channel: "chrome" }),
      // Som root (vanlig i containere) starter ikke Chromium med sandkasse.
      args: process.getuid?.() === 0 ? ["--no-sandbox"] : [],
    });
  } catch (error) {
    log.warn("screenshots.launch", { error, executablePath });
    throw new UserFacingError(
      executablePath
        ? "Fikk ikke startet nettleseren i SCREENSHOT_BROWSER_PATH. Sjekk at stien stemmer."
        : "For å ta skjermbilder av localhost trenger du Google Chrome på maskinen, eller SCREENSHOT_BROWSER_PATH i .env.local.",
    );
  }

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      locale: "nb-NO",
      serviceWorkers: "block",
    });

    // I produksjon: ingen forespørsler til lokale adresser, heller ikke via omdirigeringer
    // eller ressurser på siden. Under utvikling er det nettopp det vi vil ta bilder av.
    if (!ALLOW_LOCAL) {
      const checked = new Map<string, Promise<boolean>>();
      await context.route("**/*", async (route) => {
        const target = new URL(route.request().url());
        if (target.protocol === "data:" || target.protocol === "blob:") return route.continue();
        if (target.protocol !== "http:" && target.protocol !== "https:") return route.abort();
        if (!checked.has(target.hostname)) checked.set(target.hostname, resolvesToPrivate(target.hostname));
        return (await checked.get(target.hostname)) ? route.abort("blockedbyclient") : route.continue();
      });
    }

    const page = await context.newPage();
    let response;
    try {
      response = await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT });
    } catch (error) {
      log.warn("screenshots.navigate", { error, url });
      throw new UserFacingError(
        isPrivateHostname(new URL(url).hostname)
          ? "Fikk ikke åpnet siden. Sjekk at prosjektet kjører på den adressen."
          : "Fikk ikke åpnet siden. Sjekk at lenken virker og at siden er offentlig.",
      );
    }
    if (response && response.status() >= 400) {
      throw new UserFacingError(`Siden svarte med feil ${response.status()}. Sjekk at lenken virker.`);
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.addStyleTag({ content: "html{scrollbar-width:none}::-webkit-scrollbar{display:none}" }).catch(() => {});
    const raw = await page
      .evaluate(() => {
        const meta = (selector: string) => document.querySelector<HTMLMetaElement>(selector)?.content ?? null;
        return {
          title: meta('meta[property="og:title"]') ?? document.title,
          description: meta('meta[property="og:description"]') ?? meta('meta[name="description"]'),
        };
      })
      .catch(() => ({ title: null, description: null }));
    const meta = { title: cleanMeta(raw.title, 100), description: cleanMeta(raw.description, 200) };

    const frames: Buffer[] = [];
    let lastY = -1;
    for (let i = 0; i < count; i++) {
      const y = await page.evaluate((top) => {
        window.scrollTo({ top, behavior: "instant" });
        return Math.round(window.scrollY);
      }, i * VIEWPORT.height);
      // Kortere side enn antall bilder: stopp når vi ikke kommer lenger ned.
      if (i > 0 && y - lastY < VIEWPORT.height * 0.5) break;
      lastY = y;
      await page.waitForTimeout(i === 0 ? 700 : 900);
      frames.push(await page.screenshot({ type: "png" }));
    }
    return { frames, meta };
  } finally {
    await browser.close().catch(() => {});
  }
}

// Microlink tar ett bilde av hele siden, som vi deler opp i skjermhøyder.
async function captureWithMicrolink(url: string, count: number): Promise<{ frames: Buffer[]; meta: PageMeta }> {
  const key = process.env.MICROLINK_API_KEY?.trim();
  const api = new URL(key ? "https://pro.microlink.io/" : "https://api.microlink.io/");
  api.searchParams.set("url", url);
  // Bare tittel og beskrivelse, ikke resten av metadataene (raskere).
  api.searchParams.set("meta", JSON.stringify({ title: true, description: true }));
  api.searchParams.set("screenshot.fullPage", "true");
  api.searchParams.set("screenshot.type", "png");
  api.searchParams.set("viewport.width", String(VIEWPORT.width));
  api.searchParams.set("viewport.height", String(VIEWPORT.height));
  api.searchParams.set("viewport.deviceScaleFactor", "1");

  let res: Response;
  try {
    res = await fetch(api, { headers: key ? { "x-api-key": key } : {}, signal: AbortSignal.timeout(SERVICE_TIMEOUT) });
  } catch (error) {
    log.warn("screenshots.microlink", { error, url });
    throw new UserFacingError("Skjermbildetjenesten svarte ikke. Prøv igjen om litt.");
  }
  if (res.status === 429) {
    throw new UserFacingError("Skjermbildetjenesten har nådd grensen for i dag. Prøv igjen senere, eller last opp bilder selv.");
  }

  const json = (await res.json().catch(() => null)) as {
    status?: string;
    message?: string;
    data?: { screenshot?: { url?: string }; title?: string; description?: string };
  } | null;
  const shotUrl = json?.data?.screenshot?.url;
  if (!res.ok || json?.status !== "success" || !shotUrl || !/^https:\/\//.test(shotUrl)) {
    log.warn("screenshots.microlink", { status: res.status, message: json?.message, url });
    throw new UserFacingError("Fikk ikke tatt skjermbilder av siden. Sjekk at lenken virker og at siden er offentlig.");
  }

  const image = await fetch(shotUrl, { signal: AbortSignal.timeout(SERVICE_TIMEOUT) });
  const length = Number(image.headers.get("content-length") ?? 0);
  if (!image.ok || length > MAX_DOWNLOAD_BYTES) throw new UserFacingError("Fikk ikke hentet skjermbildet. Prøv igjen.");
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new UserFacingError("Siden er for lang til å ta bilder av.");

  return {
    frames: await sliceFullPage(bytes, count),
    meta: { title: cleanMeta(json?.data?.title, 100), description: cleanMeta(json?.data?.description, 200) },
  };
}

// Deler et helsidebilde i biter med samme form som skjermen (16:10).
async function sliceFullPage(bytes: Buffer, count: number): Promise<Buffer[]> {
  const { width = 0, height = 0 } = await sharp(bytes, { limitInputPixels: 300_000_000 }).metadata();
  if (!width || !height) throw new UserFacingError("Fikk ikke lest skjermbildet.");
  const frameHeight = Math.round((width * VIEWPORT.height) / VIEWPORT.width);

  const frames: Buffer[] = [];
  for (let top = 0; frames.length < count && top < height; top += frameHeight) {
    // Det som er igjen nederst er for lite til et eget bilde.
    if (top > 0 && height - top < frameHeight * 0.6) break;
    const y = Math.min(top, Math.max(0, height - frameHeight));
    frames.push(
      await sharp(bytes, { limitInputPixels: 300_000_000 })
        .extract({ left: 0, top: y, width, height: Math.min(frameHeight, height - y) })
        .png()
        .toBuffer(),
    );
  }
  return frames;
}
