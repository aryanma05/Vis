import { handleStripeEvent } from "@/lib/billing";
import { log } from "@/lib/log";
import { StripeError, verifyWebhook } from "@/lib/stripe";

// Stripe sender hendelser hit (abonnement opprettet, fornyet, sagt opp, betaling feilet).
// Legg inn adressen https://<domenet>/api/stripe/webhook i Stripe → Developers → Webhooks,
// og kopier signeringshemmeligheten til STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook er ikke satt opp", { status: 503 });

  const payload = await request.text();
  let event;
  try {
    event = verifyWebhook(payload, request.headers.get("stripe-signature"), secret);
  } catch (error) {
    log.warn("stripe.webhook.invalid", { error });
    return new Response(error instanceof StripeError ? error.message : "Ugyldig", { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return Response.json({ received: true, result });
  } catch (error) {
    log.error("stripe.webhook.failed", { error, type: event.type, id: event.id });
    // 500 gjør at Stripe prøver igjen senere.
    return new Response("Feil under behandling", { status: 500 });
  }
}
