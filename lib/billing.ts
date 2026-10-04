import "server-only";

import { cache } from "react";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { log } from "@/lib/log";
import { enforce } from "@/lib/rate-limit";
import { UserFacingError } from "@/lib/result";
import { siteUrl } from "@/lib/site";
import {
  cancelSubscription,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  retrieveCheckoutSession,
  retrievePrice,
  retrieveSubscription,
  stripeConfigured,
  StripeError,
  type StripeEvent,
  type StripeSubscription,
} from "@/lib/stripe";

const { billingCustomer, planGrant, stripeEvent, subscription } = schema;

export type OwnerType = "user" | "company";
export type PaidPlan = "pro" | "business";
export type Interval = "month" | "year";

// Statuser som gir tilgang. «past_due» betyr at et kort feilet, og Stripe prøver igjen
// noen dager; tilgangen beholdes så lenge.
const ACTIVE = ["active", "trialing", "past_due"];

/* -------------------------------------------------------------------------- */
/*  Priser                                                                    */
/* -------------------------------------------------------------------------- */

export const PRICE_ENV = {
  "pro:month": "STRIPE_PRICE_PRO_MONTHLY",
  "pro:year": "STRIPE_PRICE_PRO_YEARLY",
  "business:month": "STRIPE_PRICE_BUSINESS_MONTHLY",
} as const;
type PriceKey = keyof typeof PRICE_ENV;

// Det som vises før Stripe er satt opp. Når pris-ID-ene finnes, hentes prisen fra Stripe.
const FALLBACK: Record<PriceKey, number> = { "pro:month": 59, "pro:year": 590, "business:month": 1490 };

const priceId = (plan: PaidPlan, interval: Interval) => process.env[PRICE_ENV[`${plan}:${interval}` as PriceKey] ?? ""]?.trim() || null;

function planOfPrice(id: string | null | undefined): { plan: PaidPlan; interval: Interval } | null {
  if (!id) return null;
  for (const [key, env] of Object.entries(PRICE_ENV)) {
    if (process.env[env]?.trim() === id) {
      const [plan, interval] = key.split(":") as [PaidPlan, Interval];
      return { plan, interval };
    }
  }
  return null;
}

export type DisplayPrice = { amount: number; currency: string; available: boolean };
let priceCache: { at: number; prices: Record<PriceKey, DisplayPrice> } | null = null;

// Prisene til prissiden, i kroner. Mellomlagres en time.
export async function getDisplayPrices(): Promise<Record<PriceKey, DisplayPrice>> {
  if (priceCache && Date.now() - priceCache.at < 60 * 60_000) return priceCache.prices;
  const entries = await Promise.all(
    (Object.keys(PRICE_ENV) as PriceKey[]).map(async (key) => {
      const [plan, interval] = key.split(":") as [PaidPlan, Interval];
      const id = priceId(plan, interval);
      if (!id || !stripeConfigured()) return [key, { amount: FALLBACK[key], currency: "nok", available: false }] as const;
      try {
        const price = await retrievePrice(id);
        return [key, { amount: (price.unit_amount ?? 0) / 100, currency: price.currency, available: price.active }] as const;
      } catch (error) {
        log.warn("billing.price", { error, key });
        return [key, { amount: FALLBACK[key], currency: "nok", available: false }] as const;
      }
    }),
  );
  const prices = Object.fromEntries(entries) as Record<PriceKey, DisplayPrice>;
  priceCache = { at: Date.now(), prices };
  return prices;
}

/* -------------------------------------------------------------------------- */
/*  Hvilken plan har noen?                                                    */
/* -------------------------------------------------------------------------- */

export type PlanState = {
  plan: "free" | PaidPlan;
  source: "stripe" | "grant" | null;
  status: string | null;
  interval: string | null;
  renewsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  grantUntil: Date | null;
};

const FREE: PlanState = { plan: "free", source: null, status: null, interval: null, renewsAt: null, cancelAtPeriodEnd: false, grantUntil: null };

export async function getPlanState(ownerType: OwnerType, ownerId: string): Promise<PlanState> {
  const paid: PaidPlan = ownerType === "user" ? "pro" : "business";
  const [sub] = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.ownerType, ownerType),
        eq(subscription.ownerId, ownerId),
        inArray(subscription.status, ACTIVE),
        // Litt slingring etter periodeslutt, i tilfelle webhooken om fornyelse er forsinket.
        or(isNull(subscription.currentPeriodEnd), gt(subscription.currentPeriodEnd, sql`now() - interval '3 days'`)),
      ),
    )
    .orderBy(desc(subscription.currentPeriodEnd))
    .limit(1);
  if (sub) {
    return {
      plan: paid,
      source: "stripe",
      status: sub.status,
      interval: sub.interval,
      renewsAt: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      grantUntil: null,
    };
  }
  const [grant] = await db
    .select()
    .from(planGrant)
    .where(and(eq(planGrant.ownerType, ownerType), eq(planGrant.ownerId, ownerId), or(isNull(planGrant.until), gt(planGrant.until, sql`now()`))))
    .limit(1);
  if (grant) return { ...FREE, plan: grant.plan, source: "grant", grantUntil: grant.until };
  return FREE;
}

// Én oppslag per forespørsel.
export const getUserPlan = cache((userId: string) => getPlanState("user", userId));
export const getCompanyPlan = cache((companyId: string) => getPlanState("company", companyId));

export async function isPro(userId: string | null | undefined) {
  if (!userId) return false;
  return (await getUserPlan(userId)).plan === "pro";
}

export async function hasBusiness(companyId: string) {
  return (await getCompanyPlan(companyId)).plan === "business";
}

/* -------------------------------------------------------------------------- */
/*  Kjøp og administrasjon                                                    */
/* -------------------------------------------------------------------------- */

async function ensureCustomer(ownerType: OwnerType, ownerId: string, info: { email?: string; name?: string }) {
  const [existing] = await db
    .select({ id: billingCustomer.stripeCustomerId })
    .from(billingCustomer)
    .where(and(eq(billingCustomer.ownerType, ownerType), eq(billingCustomer.ownerId, ownerId)))
    .limit(1);
  if (existing) return existing.id;

  const customer = await createCustomer({ ...info, metadata: { ownerType, ownerId } });
  await db.insert(billingCustomer).values({ ownerType, ownerId, stripeCustomerId: customer.id }).onConflictDoNothing();
  // To samtidige kjøp: bruk den som ble lagret først.
  const [saved] = await db
    .select({ id: billingCustomer.stripeCustomerId })
    .from(billingCustomer)
    .where(and(eq(billingCustomer.ownerType, ownerType), eq(billingCustomer.ownerId, ownerId)))
    .limit(1);
  return saved.id;
}

function friendly(error: unknown): never {
  if (error instanceof UserFacingError) throw error;
  if (error instanceof StripeError) {
    log.error("billing.stripe", { error, status: error.status, code: error.code });
    throw new UserFacingError(error.status === 503 ? "Betaling er ikke satt opp ennå." : "Betalingstjenesten svarte ikke som forventet. Prøv igjen om litt.");
  }
  throw error;
}

// Lager en Stripe Checkout-side og returnerer adressen dit brukeren sendes.
export async function startCheckout({
  userId,
  email,
  name,
  plan,
  interval,
  company,
}: {
  userId: string;
  email: string;
  name: string;
  plan: PaidPlan;
  interval: Interval;
  company?: { id: string; name: string; slug: string } | null;
}) {
  if (!stripeConfigured()) throw new UserFacingError("Betaling er ikke satt opp ennå. Ta kontakt, så hjelper vi deg.");
  const price = priceId(plan, interval);
  if (!price) throw new UserFacingError("Denne planen kan ikke kjøpes ennå.");
  if (plan === "business" && !company) throw new UserFacingError("Velg hvilken bedrift abonnementet gjelder.");

  const ownerType: OwnerType = plan === "pro" ? "user" : "company";
  const ownerId = plan === "pro" ? userId : company!.id;
  const current = await getPlanState(ownerType, ownerId);
  if (current.source === "stripe") throw new UserFacingError("Abonnementet er allerede aktivt. Endre det under Administrer betaling.");
  await enforce("checkout", userId);

  try {
    const customer = await ensureCustomer(ownerType, ownerId, plan === "pro" ? { email, name } : { email, name: company!.name });
    const metadata = { ownerType, ownerId, plan, userId };
    const back = plan === "pro" ? "/priser" : `/bedrift/${company!.slug}/admin?fane=abonnement`;
    const session = await createCheckoutSession({
      customer,
      priceId: price,
      successUrl: `${siteUrl()}/betaling/takk?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}${back}${back.includes("?") ? "&" : "?"}avbrutt=1`,
      metadata,
      clientReferenceId: `${ownerType}:${ownerId}`,
    });
    if (!session.url) throw new UserFacingError("Fikk ikke laget betalingssiden. Prøv igjen.");
    log.info("billing.checkout", { userId, plan, interval, ownerType, ownerId });
    return session.url;
  } catch (error) {
    friendly(error);
  }
}

// Stripe sin kundeportal: bytte kort, se kvitteringer, si opp.
export async function openPortal(ownerType: OwnerType, ownerId: string, returnPath: string) {
  const [customer] = await db
    .select({ id: billingCustomer.stripeCustomerId })
    .from(billingCustomer)
    .where(and(eq(billingCustomer.ownerType, ownerType), eq(billingCustomer.ownerId, ownerId)))
    .limit(1);
  if (!customer) throw new UserFacingError("Fant ingen betalinger å administrere.");
  try {
    return (await createPortalSession({ customer: customer.id, returnUrl: `${siteUrl()}${returnPath}` })).url;
  } catch (error) {
    friendly(error);
  }
}

/* -------------------------------------------------------------------------- */
/*  Synkronisering fra Stripe                                                 */
/* -------------------------------------------------------------------------- */

async function ownerOf(sub: StripeSubscription): Promise<{ ownerType: OwnerType; ownerId: string } | null> {
  const { ownerType, ownerId } = sub.metadata ?? {};
  if ((ownerType === "user" || ownerType === "company") && ownerId) return { ownerType, ownerId };
  const [row] = await db
    .select({ ownerType: billingCustomer.ownerType, ownerId: billingCustomer.ownerId })
    .from(billingCustomer)
    .where(eq(billingCustomer.stripeCustomerId, sub.customer))
    .limit(1);
  return row ?? null;
}

// Lagrer abonnementet slik Stripe beskriver det nå.
export async function syncSubscription(sub: StripeSubscription) {
  const owner = await ownerOf(sub);
  if (!owner) {
    log.warn("billing.sync.unknown-owner", { subscription: sub.id, customer: sub.customer });
    return;
  }
  const item = sub.items?.data?.[0];
  const known = planOfPrice(item?.price?.id);
  const plan: PaidPlan = (sub.metadata?.plan as PaidPlan) || known?.plan || (owner.ownerType === "user" ? "pro" : "business");
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;
  const values = {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    plan,
    priceId: item?.price?.id ?? null,
    status: sub.status,
    interval: item?.price?.recurring?.interval ?? known?.interval ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
  await db.insert(subscription).values({ id: sub.id, ...values }).onConflictDoUpdate({ target: subscription.id, set: values });
  log.info("billing.sync", { subscription: sub.id, status: sub.status, ...owner, plan });
}

// Etter Checkout: hent abonnementet med en gang, så brukeren slipper å vente på webhooken.
export async function confirmCheckout(sessionId: string, userId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null;
  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.metadata?.userId !== userId) return null;
    if (session.subscription) await syncSubscription(await retrieveSubscription(session.subscription));
    return { plan: (session.metadata.plan as PaidPlan) ?? null, ownerType: session.metadata.ownerType as OwnerType, ownerId: session.metadata.ownerId };
  } catch (error) {
    log.warn("billing.confirm", { error, sessionId });
    return null;
  }
}

// Når en konto eller bedrift slettes: avslutt abonnementene hos Stripe med en gang, så kortet
// ikke belastes for noe som ikke finnes lenger. Feiler det, stoppes slettingen.
export async function cancelAllSubscriptions(ownerType: OwnerType, ownerId: string) {
  const subs = await db
    .select({ id: subscription.id })
    .from(subscription)
    .where(and(eq(subscription.ownerType, ownerType), eq(subscription.ownerId, ownerId), inArray(subscription.status, [...ACTIVE, "unpaid", "incomplete"])));
  for (const sub of subs) {
    try {
      await syncSubscription(await cancelSubscription(sub.id));
    } catch (error) {
      // Allerede borte hos Stripe: da er det ingenting å avslutte.
      if (error instanceof StripeError && error.code === "resource_missing") continue;
      log.error("billing.cancel", { error, subscription: sub.id, ownerType, ownerId });
      throw new UserFacingError("Vi fikk ikke avsluttet abonnementet hos Stripe. Si det opp under Konto først, eller prøv igjen om litt.");
    }
  }
}

// Behandler en (allerede verifisert) webhook-hendelse. Samme hendelse behandles bare én gang.
export async function handleStripeEvent(event: StripeEvent) {
  const inserted = await db.insert(stripeEvent).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvent.id });
  if (inserted.length === 0) return "duplikat";

  const object = event.data.object;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const subId = object.subscription as string | null;
        if (subId) await syncSubscription(await retrieveSubscription(subId));
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        // Hent fersk versjon, så hendelser som kommer i feil rekkefølge ikke overskriver nyere data.
        await syncSubscription(await retrieveSubscription(object.id as string));
        break;
      case "invoice.payment_failed":
        log.warn("billing.payment-failed", { customer: object.customer, invoice: object.id });
        break;
      default:
        break;
    }
  } catch (error) {
    // La Stripe prøve igjen: fjern markeringen så hendelsen behandles på nytt.
    await db.delete(stripeEvent).where(eq(stripeEvent.id, event.id));
    throw error;
  }
  return "ok";
}

/* -------------------------------------------------------------------------- */
/*  Gitt av admin                                                             */
/* -------------------------------------------------------------------------- */

export async function grantPlan(adminId: string, ownerType: OwnerType, ownerId: string, days: number | null, note: string) {
  const plan: PaidPlan = ownerType === "user" ? "pro" : "business";
  const until = days ? new Date(Date.now() + days * 86_400_000) : null;
  const values = { plan, until, note: note.trim().slice(0, 300) || null, grantedById: adminId };
  await db
    .insert(planGrant)
    .values({ ownerType, ownerId, ...values })
    .onConflictDoUpdate({ target: [planGrant.ownerType, planGrant.ownerId], set: values });
  log.info("billing.grant", { adminId, ownerType, ownerId, days });
}

export async function revokeGrant(adminId: string, ownerType: OwnerType, ownerId: string) {
  await db.delete(planGrant).where(and(eq(planGrant.ownerType, ownerType), eq(planGrant.ownerId, ownerId)));
  log.info("billing.revoke", { adminId, ownerType, ownerId });
}

// Til admin: hvor mange som betaler, og omtrentlig månedlig inntekt.
export async function getBillingSummary() {
  const rows = await db
    .select({ plan: subscription.plan, interval: subscription.interval, n: sql<number>`count(*)::int` })
    .from(subscription)
    .where(inArray(subscription.status, ACTIVE))
    .groupBy(subscription.plan, subscription.interval);
  const grants = await db
    .select({ plan: planGrant.plan, n: sql<number>`count(*)::int` })
    .from(planGrant)
    .where(or(isNull(planGrant.until), gt(planGrant.until, sql`now()`)))
    .groupBy(planGrant.plan);
  const prices = await getDisplayPrices();
  let mrr = 0;
  for (const r of rows) {
    const key = `${r.plan}:${r.interval === "year" ? "year" : "month"}` as PriceKey;
    const amount = prices[key]?.amount ?? 0;
    mrr += r.interval === "year" ? (amount / 12) * r.n : amount * r.n;
  }
  const count = (plan: PaidPlan) => rows.filter((r) => r.plan === plan).reduce((n, r) => n + r.n, 0);
  const granted = (plan: PaidPlan) => grants.find((g) => g.plan === plan)?.n ?? 0;
  return { pro: count("pro"), business: count("business"), proGranted: granted("pro"), businessGranted: granted("business"), mrr: Math.round(mrr) };
}
