import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Liten Stripe-klient over REST-API-et (ingen ekstra pakke). Bare det Vis trenger:
// kunder, Checkout, kundeportalen, abonnementer, priser og sjekk av webhooks.
// Nøklene ligger i STRIPE_SECRET_KEY og STRIPE_WEBHOOK_SECRET.

const API = "https://api.stripe.com/v1";
// Fast API-versjon, så svarene ikke endrer form når Stripe lanserer en ny versjon.
const API_VERSION = "2025-08-27.basil";

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export class StripeError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

type Params = Record<string, unknown>;

// Stripe vil ha skjemakoding med hakeparenteser: line_items[0][price]=…, metadata[userId]=…
export function encodeForm(params: Params, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...encodeForm(item as Params, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      out.push(...encodeForm(value as Params, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

export async function stripe<T>(method: "GET" | "POST" | "DELETE", path: string, params: Params = {}, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Betaling er ikke satt opp (STRIPE_SECRET_KEY).", 503);
  const body = encodeForm(params).join("&");
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
  if (!res.ok) throw new StripeError(json.error?.message ?? `Stripe svarte ${res.status}`, res.status, json.error?.code);
  return json;
}

/* -------------------------------------------------------------------------- */
/*  Typer (bare feltene vi bruker)                                            */
/* -------------------------------------------------------------------------- */

export type StripeCustomer = { id: string };
export type StripePrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: "month" | "year" } | null;
  product: string;
  active: boolean;
};
export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  items: { data: { price: StripePrice; current_period_end?: number }[] };
  current_period_end?: number;
};
export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
  status: string;
};
export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/* -------------------------------------------------------------------------- */
/*  Kall                                                                      */
/* -------------------------------------------------------------------------- */

export const createCustomer = (params: { email?: string; name?: string; metadata: Record<string, string> }) =>
  stripe<StripeCustomer>("POST", "/customers", params);

export const createCheckoutSession = (params: {
  customer: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  clientReferenceId: string;
}) =>
  stripe<StripeCheckoutSession>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: params.customer,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.clientReferenceId,
    metadata: params.metadata,
    subscription_data: { metadata: params.metadata },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Norske kunder forventer kvittering med MVA; Stripe Tax kan slås på i dashbordet.
    customer_update: { address: "auto", name: "auto" },
    locale: "nb",
  });

export const retrieveCheckoutSession = (id: string) => stripe<StripeCheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`);

export const createPortalSession = (params: { customer: string; returnUrl: string }) =>
  stripe<{ url: string }>("POST", "/billing_portal/sessions", { customer: params.customer, return_url: params.returnUrl, locale: "nb" });

export const retrieveSubscription = (id: string) => stripe<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(id)}`);

// Avslutter abonnementet med en gang (ikke ved periodens slutt), f.eks. når kontoen slettes.
export const cancelSubscription = (id: string) => stripe<StripeSubscription>("DELETE", `/subscriptions/${encodeURIComponent(id)}`);

export const retrievePrice = (id: string) => stripe<StripePrice>("GET", `/prices/${encodeURIComponent(id)}`);

/* -------------------------------------------------------------------------- */
/*  Webhooks                                                                  */
/* -------------------------------------------------------------------------- */

// Sjekker Stripe-Signature (t=…,v1=…) mot STRIPE_WEBHOOK_SECRET, med fem minutters slingring.
export function verifyWebhook(payload: string, header: string | null, secret: string, toleranceSeconds = 300, now = Date.now()): StripeEvent {
  if (!header) throw new StripeError("Mangler Stripe-Signature.", 400);
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const timestamp = Number(parts.t);
  const signatures = header
    .split(",")
    .filter((p) => p.trim().startsWith("v1="))
    .map((p) => p.trim().slice(3));
  if (!timestamp || signatures.length === 0) throw new StripeError("Ugyldig Stripe-Signature.", 400);
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) throw new StripeError("Webhooken er for gammel.", 400);

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const ok = signatures.some((sig) => {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!ok) throw new StripeError("Signaturen stemmer ikke.", 400);
  return JSON.parse(payload) as StripeEvent;
}

// Til tester: lager en gyldig signatur for et innhold.
export function signWebhook(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}
