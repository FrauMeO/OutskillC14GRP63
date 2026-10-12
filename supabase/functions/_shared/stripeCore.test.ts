import { describe, expect, it } from 'vitest';
import {
  CANCEL_URL,
  PORTAL_RETURN_URL,
  SUCCESS_URL,
  allowedOrigin,
  checkoutIdempotencyKey,
  decideCheckout,
  formEncode,
  hmacSha256Hex,
  isHandledEvent,
  subscriptionIdFromEvent,
  subscriptionToRow,
  userIdFromMetadata,
  verifyStripeSignature,
} from './stripeCore';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_1","type":"customer.subscription.updated"}';
const NOW = 1_800_000_000;
const UID = '11111111-2222-3333-4444-555555555555';

async function header(ts: number, body = BODY, secret = SECRET) {
  return `t=${ts},v1=${await hmacSha256Hex(secret, `${ts}.${body}`)},v0=deadbeef`;
}

describe('webhook signature', () => {
  it('accepts a correct signature (control)', async () => {
    expect(await verifyStripeSignature(BODY, await header(NOW), SECRET, NOW)).toBe(true);
  });
  it('rejects a changed body, a wrong secret, a missing header and an empty secret', async () => {
    const h = await header(NOW);
    expect(await verifyStripeSignature(BODY + ' ', h, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, h, 'whsec_other', NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, null, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, h, '', NOW)).toBe(false);
  });
  it('enforces the five minute window exactly, in both directions', async () => {
    expect(await verifyStripeSignature(BODY, await header(NOW - 300), SECRET, NOW)).toBe(true);
    expect(await verifyStripeSignature(BODY, await header(NOW - 301), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, await header(NOW + 300), SECRET, NOW)).toBe(true);
    expect(await verifyStripeSignature(BODY, await header(NOW + 301), SECRET, NOW)).toBe(false);
  });
  it('never allows a tolerance of zero (that would switch the check off)', async () => {
    expect(await verifyStripeSignature(BODY, await header(NOW), SECRET, NOW, 0)).toBe(false);
  });
  it('ignores the decoy v0 scheme and accepts any matching v1 (secret rolling)', async () => {
    const good = await hmacSha256Hex(SECRET, `${NOW}.${BODY}`);
    expect(await verifyStripeSignature(BODY, `t=${NOW},v0=${good}`, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(BODY, `t=${NOW},v1=bad,v1=${good}`, SECRET, NOW)).toBe(true);
    expect(await verifyStripeSignature(BODY, `v1=${good}`, SECRET, NOW)).toBe(false);
  });
});

describe('who may buy what', () => {
  const base = { plan: 'standard_monthly' as const, userPlan: 'standard' as const, hasActiveShare: false, alreadySubscribed: false, billingEnforced: true, testMode: false };
  it('lets an under-60 person buy the monthly plan (control)', () => {
    expect(decideCheckout(base).ok).toBe(true);
  });
  it('never charges a person aged 60 or over', () => {
    const d = decideCheckout({ ...base, userPlan: 'free_60_plus' });
    expect(d).toMatchObject({ ok: false, status: 409 });
  });
  it('asks for birth month and year before charging anyone unknown', () => {
    expect(decideCheckout({ ...base, userPlan: 'unknown' })).toMatchObject({ ok: false });
  });
  it('sells the caregiver plan only with an active share', () => {
    expect(decideCheckout({ ...base, plan: 'caregiver_yearly' })).toMatchObject({ ok: false, status: 403 });
    expect(decideCheckout({ ...base, plan: 'caregiver_yearly', hasActiveShare: true }).ok).toBe(true);
  });
  it('lets a person of any age be a caregiver, including a free 60+ person', () => {
    expect(decideCheckout({ ...base, plan: 'caregiver_yearly', userPlan: 'free_60_plus', hasActiveShare: true }).ok).toBe(true);
  });
  it('does not sell twice', () => {
    expect(decideCheckout({ ...base, alreadySubscribed: true })).toMatchObject({ ok: false, status: 409 });
  });
  it('charges nobody in beta with a live key, but allows test mode', () => {
    expect(decideCheckout({ ...base, billingEnforced: false })).toMatchObject({ ok: false });
    expect(decideCheckout({ ...base, billingEnforced: false, testMode: true }).ok).toBe(true);
  });
});

describe('fixed addresses and keys', () => {
  it('only ever points at buildyourpillars.com over https', () => {
    for (const u of [SUCCESS_URL, CANCEL_URL, PORTAL_RETURN_URL]) expect(u.startsWith('https://buildyourpillars.com/')).toBe(true);
  });
  it('echoes only allowed origins', () => {
    expect(allowedOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    expect(allowedOrigin('https://evil.example')).toBe('https://buildyourpillars.com');
    expect(allowedOrigin(null)).toBe('https://buildyourpillars.com');
  });
  it('makes one idempotency key per person, plan and day', () => {
    const a = checkoutIdempotencyKey(UID, 'standard_monthly', new Date('2026-10-12T08:00:00Z'));
    expect(a).toBe(checkoutIdempotencyKey(UID, 'standard_monthly', new Date('2026-10-12T23:59:00Z')));
    expect(a).not.toBe(checkoutIdempotencyKey(UID, 'standard_monthly', new Date('2026-10-13T00:00:00Z')));
    expect(a).not.toBe(checkoutIdempotencyKey(UID, 'caregiver_yearly', new Date('2026-10-12T08:00:00Z')));
    expect(a.length).toBeLessThanOrEqual(255);
  });
  it('form-encodes nested objects and arrays the way Stripe expects', () => {
    expect(formEncode({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], metadata: { user_id: 'u', skip: undefined } }))
      .toBe('mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=u');
  });
});

describe('mapping Stripe events to rows', () => {
  const prices = { standard: 'price_std', caregiver: 'price_cg' };
  const sub = (over: Record<string, unknown> = {}) => ({
    id: 'sub_1', status: 'active', cancel_at_period_end: false, metadata: { user_id: UID },
    items: { data: [{ price: { id: 'price_std' }, current_period_end: 1_800_000_000 }] }, ...over,
  });
  it('maps a standard subscription (control)', () => {
    const row = subscriptionToRow(sub(), UID, prices, new Date('2026-10-12T00:00:00Z'));
    expect(row).toMatchObject({ stripe_subscription_id: 'sub_1', user_id: UID, plan: 'standard_monthly', status: 'active', cancel_at_period_end: false });
    expect(row?.current_period_end).toBe('2027-01-15T08:00:00.000Z');
  });
  it('decides the plan by Price id first, then by our metadata', () => {
    expect(subscriptionToRow(sub({ items: { data: [{ price: { id: 'price_cg' } }] } }), UID, prices, new Date())?.plan).toBe('caregiver_yearly');
    expect(subscriptionToRow(sub({ items: { data: [{ price: { id: 'price_x' } }] }, metadata: { user_id: UID, plan: 'caregiver_yearly' } }), UID, prices, new Date())?.plan).toBe('caregiver_yearly');
  });
  it('skips a subscription that is not ours', () => {
    expect(subscriptionToRow(sub({ items: { data: [{ price: { id: 'price_x' } }] }, metadata: {} }), UID, prices, new Date())).toBeNull();
    expect(subscriptionToRow(sub(), null, prices, new Date())).toBeNull();
    expect(subscriptionToRow(sub(), 'not-a-uuid', prices, new Date())).toBeNull();
  });
  it('keeps the raw Stripe status and the cancel flag', () => {
    expect(subscriptionToRow(sub({ status: 'past_due', cancel_at_period_end: true }), UID, prices, new Date())).toMatchObject({ status: 'past_due', cancel_at_period_end: true });
  });
  it('reads the user from metadata only when it is a real uuid', () => {
    expect(userIdFromMetadata(sub())).toBe(UID);
    expect(userIdFromMetadata({ metadata: { user_id: "1' or '1'='1" } })).toBeNull();
  });
  it('finds the subscription an event is about', () => {
    expect(subscriptionIdFromEvent('customer.subscription.deleted', { id: 'sub_9' })).toBe('sub_9');
    expect(subscriptionIdFromEvent('checkout.session.completed', { mode: 'subscription', subscription: 'sub_8' })).toBe('sub_8');
    expect(subscriptionIdFromEvent('checkout.session.completed', { mode: 'payment', subscription: null })).toBeNull();
    expect(subscriptionIdFromEvent('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_7' } } })).toBe('sub_7');
    expect(subscriptionIdFromEvent('invoice.payment_failed', { subscription: 'sub_6' })).toBe('sub_6');
    expect(subscriptionIdFromEvent('invoice.payment_failed', {})).toBeNull();
  });
  it('knows which event types it handles', () => {
    expect(isHandledEvent('invoice.payment_failed')).toBe(true);
    expect(isHandledEvent('charge.refunded')).toBe(false);
    expect(isHandledEvent(undefined)).toBe(false);
  });
});
