import "server-only";

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireBusiness, requireCompanyRole } from "@/lib/companies";
import { log } from "@/lib/log";
import { isUuid } from "@/lib/projects";
import { UserFacingError } from "@/lib/result";
import { resolvesToPrivate } from "@/lib/screenshots";

const { companyWebhook, webhookDelivery } = schema;

// Webhooks for bedrifter: vi sender en POST med JSON når noe skjer med stillingene deres.
// Hver levering er signert (Vis-Signature: t=<tid>,v1=<HMAC-SHA256 av «t.innhold»>),
// samme oppsett som Stripe, så mottakeren kan sjekke at den kommer fra oss.

export const WEBHOOK_EVENTS = {
  "job.published": "En stilling er publisert",
  "job.closed": "En stilling er lukket",
  "job.application_click": "Noen trykket «Søk på stillingen»",
} as const;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

const MAX_WEBHOOKS = 5;
const TIMEOUT_MS = 10_000;

export function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

async function assertSafeUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UserFacingError("Adressen ser ikke riktig ut.");
  }
  const local = process.env.NODE_ENV !== "production" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !local) throw new UserFacingError("Adressen må starte med https://.");
  if (url.username || url.password) throw new UserFacingError("Adressen kan ikke inneholde brukernavn eller passord.");
  if (!local && (await resolvesToPrivate(url.hostname))) throw new UserFacingError("Adressen må gå til en offentlig server.");
  return url.toString();
}

export async function listWebhooks(viewerId: string, companyId: string) {
  await requireCompanyRole(viewerId, companyId);
  const hooks = await db.select().from(companyWebhook).where(eq(companyWebhook.companyId, companyId)).orderBy(desc(companyWebhook.createdAt));
  return hooks.map(({ secret, ...rest }) => ({ ...rest, secretHint: `${secret.slice(0, 8)}…` }));
}

export async function createWebhook(viewerId: string, companyId: string, input: { url: string; events: string[] }) {
  await requireCompanyRole(viewerId, companyId, ["owner", "admin"]);
  await requireBusiness(companyId);
  const url = await assertSafeUrl(input.url);
  const events = input.events.filter((e): e is WebhookEvent => e in WEBHOOK_EVENTS);
  if (events.length === 0) throw new UserFacingError("Velg minst én hendelse.");
  const [{ n }] = await db.select({ n: count() }).from(companyWebhook).where(eq(companyWebhook.companyId, companyId));
  if (n >= MAX_WEBHOOKS) throw new UserFacingError(`Dere kan ha opptil ${MAX_WEBHOOKS} webhooks.`);
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  await db.insert(companyWebhook).values({ companyId, url, secret, events });
  return { secret };
}

export async function deleteWebhook(viewerId: string, webhookId: string) {
  const hook = await getHook(webhookId);
  await requireCompanyRole(viewerId, hook.companyId, ["owner", "admin"]);
  await db.delete(companyWebhook).where(eq(companyWebhook.id, webhookId));
}

async function getHook(webhookId: string) {
  if (!isUuid(webhookId)) throw new UserFacingError("Fant ikke webhooken.");
  const [hook] = await db.select().from(companyWebhook).where(eq(companyWebhook.id, webhookId)).limit(1);
  if (!hook) throw new UserFacingError("Fant ikke webhooken.");
  return hook;
}

// Én levering, med opptil tre forsøk (1 s og 5 s mellom). Omdirigeringer følges ikke.
async function deliver(hook: typeof companyWebhook.$inferSelect, event: string, data: unknown) {
  const body = JSON.stringify({ id: `evt_${randomUUID()}`, type: event, created: new Date().toISOString(), data });
  let status: number | null = null;
  let error: string | null = null;
  let attempts = 0;
  for (const wait of [0, 1000, 5000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    attempts++;
    try {
      await assertSafeUrl(hook.url);
      const res = await fetch(hook.url, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", "User-Agent": "Vis-Webhooks/1", "Vis-Event": event, "Vis-Signature": signPayload(body, hook.secret) },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      error = null;
      if (res.ok) break;
      if (res.status < 500 && res.status !== 429) break; // Klientfeil blir ikke bedre av å prøve igjen.
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const ok = status !== null && status >= 200 && status < 300;
  await db.insert(webhookDelivery).values({ webhookId: hook.id, event, statusCode: status, ok, attempts, error: error?.slice(0, 500) ?? null });
  await db.update(companyWebhook).set({ lastStatus: status ?? 0, lastDeliveryAt: new Date() }).where(eq(companyWebhook.id, hook.id));
  // Behold bare de siste 50 leveringene per webhook.
  await db.execute(sql`
    delete from webhook_delivery where webhook_id = ${hook.id} and id not in (
      select id from webhook_delivery where webhook_id = ${hook.id} order by created_at desc limit 50)`);
  if (!ok) log.warn("webhook.failed", { webhookId: hook.id, event, status, error });
  if (Math.random() < 0.02) await pruneDeliveries();
  return { ok, status };
}

// Sender en hendelse til alle aktive webhooks hos bedriften som lytter etter den.
// Kalles i bakgrunnen (etter at svaret er sendt), så brukeren aldri venter på mottakeren.
export async function dispatchWebhook(companyId: string, event: WebhookEvent, data: unknown) {
  try {
    const hooks = await db
      .select()
      .from(companyWebhook)
      .where(and(eq(companyWebhook.companyId, companyId), eq(companyWebhook.active, true), sql`${companyWebhook.events} ? ${event}`));
    await Promise.all(hooks.map((h) => deliver(h, event, data)));
  } catch (error) {
    log.error("webhook.dispatch", { error, companyId, event });
  }
}

export async function sendTestWebhook(viewerId: string, webhookId: string) {
  const hook = await getHook(webhookId);
  await requireCompanyRole(viewerId, hook.companyId, ["owner", "admin"]);
  return deliver(hook, "ping", { message: "Hei fra Vis! Webhooken virker." });
}

export async function listDeliveries(viewerId: string, webhookId: string) {
  const hook = await getHook(webhookId);
  await requireCompanyRole(viewerId, hook.companyId);
  return db.select().from(webhookDelivery).where(eq(webhookDelivery.webhookId, webhookId)).orderBy(desc(webhookDelivery.createdAt)).limit(20);
}

// Rydding: leveringer eldre enn 30 dager. Kjøres av og til fra deliver().
async function pruneDeliveries() {
  await db.delete(webhookDelivery).where(lt(webhookDelivery.createdAt, sql`now() - interval '30 days'`));
}
