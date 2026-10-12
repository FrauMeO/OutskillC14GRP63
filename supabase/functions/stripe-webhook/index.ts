// Supabase Edge Function: receives Stripe events and mirrors subscriptions into our tables.
// NOT DEPLOYED. Deploy with verify_jwt OFF, because Stripe sends no Supabase token:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// The Stripe signature (STRIPE_WEBHOOK_SECRET, raw body, 5 minute tolerance) is the only gate, and every
// request without a valid one gets 400 before anything else happens.
//
// Design:
//  * Unknown event types return 200 at once and touch nothing.
//  * Each event id is recorded in stripe_events first; a repeat delivery returns 200 without work.
//    If our work fails, the record is removed and we return 500 so Stripe retries.
//  * Stripe does not promise event order, so for every subscription event we re-read the subscription
//    from Stripe and store THAT (the current truth), not the possibly stale payload.
//  * Nothing here logs a body, an email or card data: only event id and type.
import {
  isHandledEvent,
  subscriptionIdFromEvent,
  subscriptionToRow,
  userIdFromMetadata,
  verifyStripeSignature,
  isUuid,
} from '../_shared/stripeCore.ts';
import { StripeError, serviceClient, stripe } from '../_shared/stripe.ts';

const text = (body: string, status: number) => new Response(body, { status });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('Use POST.', 405);

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return text('Not configured.', 500);

  const raw = await req.text(); // the raw body: never parse before verifying
  const ok = await verifyStripeSignature(raw, req.headers.get('Stripe-Signature'), secret, Math.floor(Date.now() / 1000));
  if (!ok) return text('Bad signature.', 400);

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return text('Bad request.', 400);
  }
  const eventId = typeof event.id === 'string' ? event.id : '';
  const type = typeof event.type === 'string' ? event.type : '';
  if (!eventId || !type) return text('Bad request.', 400);

  // Not one of ours: acknowledge so Stripe stops retrying; do nothing.
  if (!isHandledEvent(type)) return text('ok', 200);

  const db = serviceClient();

  // Idempotency: the first delivery wins the insert; repeats see the existing row.
  const { data: inserted, error: insertError } = await db
    .from('stripe_events')
    .upsert({ event_id: eventId, type }, { onConflict: 'event_id', ignoreDuplicates: true })
    .select('event_id');
  if (insertError) {
    console.error('stripe-webhook: could not record event', eventId);
    return text('Try again.', 500);
  }
  if (!inserted || inserted.length === 0) return text('ok', 200); // already handled

  try {
    await handle(db, type, event.data?.object);
    return text('ok', 200);
  } catch (e) {
    console.error('stripe-webhook: failed', eventId, type, e instanceof StripeError ? `${e.status} ${e.code}` : 'error');
    await db.from('stripe_events').delete().eq('event_id', eventId); // let Stripe retry
    return text('Try again.', 500);
  }
});

type Db = ReturnType<typeof serviceClient>;

async function handle(db: Db, type: string, object: unknown) {
  const obj = (object ?? {}) as Record<string, unknown>;

  // Remember which Stripe customer belongs to which person (from our own client_reference_id).
  if (type === 'checkout.session.completed') {
    const userId = obj.client_reference_id;
    const customerId = obj.customer;
    if (isUuid(userId) && typeof customerId === 'string') {
      const { error } = await db
        .from('customers')
        .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw new Error('customers write failed');
    }
  }

  const subId = subscriptionIdFromEvent(type, object);
  if (!subId) return; // e.g. a one-time payment checkout, or an invoice with no subscription

  // The current state straight from Stripe. If it has vanished (404) fall back to the payload for deletions.
  let sub: unknown;
  try {
    sub = await stripe('GET', `/subscriptions/${encodeURIComponent(subId)}`);
  } catch (e) {
    if (e instanceof StripeError && e.status === 404 && type === 'customer.subscription.deleted') sub = object;
    else throw e;
  }

  let userId = userIdFromMetadata(sub);
  if (!userId) {
    const customerId = (sub as { customer?: unknown }).customer;
    if (typeof customerId === 'string') {
      const { data } = await db.from('customers').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
      userId = data?.user_id ?? null;
    }
  }

  const row = subscriptionToRow(
    sub,
    userId,
    { standard: Deno.env.get('STRIPE_PRICE_STANDARD_MONTHLY'), caregiver: Deno.env.get('STRIPE_PRICE_CAREGIVER_YEARLY') },
    new Date(),
  );
  if (!row) return; // not a subscription of ours (unknown plan or person): ignore

  const { error } = await db.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw new Error('subscriptions write failed');
}
