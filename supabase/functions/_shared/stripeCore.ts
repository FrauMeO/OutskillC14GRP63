// Pure helpers for the billing edge functions. No Deno or network calls here, so vitest can test them.
// No Stripe SDK: plain fetch to the REST API and a hand-checked webhook signature (docs/billing.md, section 1).

// The Stripe API version the code was written against (the current one on docs.stripe.com/api/versioning
// on 2026-10-12). The webhook endpoint in the Stripe dashboard must be created with the SAME version,
// because the shape of the events follows the endpoint's version, not the request's.
export const STRIPE_API_VERSION = '2026-09-30.endive';

export type PlanKey = 'standard_monthly' | 'caregiver_yearly';
export const PLAN_KEYS: readonly PlanKey[] = ['standard_monthly', 'caregiver_yearly'];

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === 'string' && (PLAN_KEYS as readonly string[]).includes(v);
}

// ---- where the browser may be sent (never taken from the client) ----
export const SITE = 'https://buildyourpillars.com';
export const SUCCESS_URL = `${SITE}/plan?checkout=success`;
export const CANCEL_URL = `${SITE}/plan?checkout=cancelled`;
export const PORTAL_RETURN_URL = `${SITE}/plan`;
const ALLOWED_ORIGINS = [SITE, 'https://www.buildyourpillars.com', 'http://localhost:5173'];

export function allowedOrigin(origin: string | null): string {
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE;
}

// ---- Stripe's form encoding: nested objects become a[b][c]=v, arrays become a[0]=v ----
export type Form = { [k: string]: string | number | boolean | null | undefined | Form | Form[] | string[] };

export function formEncode(obj: Form, prefix = ''): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') parts.push(formEncode(item as Form, `${key}[${i}]`));
        else parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === 'object') {
      parts.push(formEncode(v as Form, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

// One checkout session per person, plan and calendar day (UTC). A double-click returns the same
// session instead of making a second one. The user id is a random UUID, not personal data.
export function checkoutIdempotencyKey(userId: string, plan: PlanKey, now: Date): string {
  return `byp-checkout-${plan}-${userId}-${now.toISOString().slice(0, 10)}`;
}
export function customerIdempotencyKey(userId: string): string {
  return `byp-customer-${userId}`;
}

// ---- who may buy what (decided on the server, never by the client) ----
export type UserPlan = 'free_60_plus' | 'standard' | 'unknown';
export type CheckoutDecision = { ok: true } | { ok: false; status: number; message: string };

export function decideCheckout(args: {
  plan: PlanKey;
  userPlan: UserPlan;
  hasActiveShare: boolean;
  alreadySubscribed: boolean;
  billingEnforced: boolean;
  testMode: boolean;
}): CheckoutDecision {
  const { plan, userPlan, hasActiveShare, alreadySubscribed, billingEnforced, testMode } = args;
  // Beta: with a live Stripe key nobody can be charged until Miah switches billing on.
  if (!billingEnforced && !testMode) {
    return { ok: false, status: 409, message: 'We are not charging for plans yet. Everything is free while we are in beta.' };
  }
  if (alreadySubscribed) {
    return { ok: false, status: 409, message: 'You already have this plan. You can manage it from the Your plan page.' };
  }
  if (plan === 'standard_monthly') {
    if (userPlan === 'free_60_plus') {
      return { ok: false, status: 409, message: 'Build Your Pillars is free for everyone aged 60 and over. You do not need a plan.' };
    }
    if (userPlan === 'unknown') {
      return { ok: false, status: 409, message: 'Please tell us your birth month and year first, so we charge the right amount.' };
    }
    return { ok: true };
  }
  // caregiver_yearly: only with an active, accepted share from the older person.
  if (!hasActiveShare) {
    return { ok: false, status: 403, message: 'A caregiver plan is available once the person you support has said yes to sharing with you.' };
  }
  return { ok: true };
}

// ---- webhook signature (https://docs.stripe.com/webhooks#verify-manually) ----
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export const SIGNATURE_TOLERANCE_SECONDS = 300;

// Uses the RAW body text. Only the v1 scheme counts (v0 is a test decoy). A zero or missing tolerance
// is never allowed: a valid signature older than five minutes (or dated in the future) is rejected.
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Promise<boolean> {
  if (!header || !secret || toleranceSeconds <= 0) return false;
  let t = '';
  const v1: string[] = [];
  for (const piece of header.split(',')) {
    const i = piece.indexOf('=');
    if (i < 0) continue;
    const k = piece.slice(0, i).trim();
    const v = piece.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || v1.length === 0) return false;
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return v1.some((sig) => safeEqual(sig, expected));
}

// ---- events we act on ----
export const HANDLED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const;

export function isHandledEvent(type: unknown): boolean {
  return typeof type === 'string' && (HANDLED_EVENTS as readonly string[]).includes(type);
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});

// The id of the subscription an event is about, or null.
export function subscriptionIdFromEvent(type: string, object: unknown): string | null {
  const o = asObj(object);
  if (type.startsWith('customer.subscription.')) return typeof o.id === 'string' ? o.id : null;
  if (type === 'checkout.session.completed') {
    if (o.mode !== 'subscription') return null;
    return typeof o.subscription === 'string' ? o.subscription : null;
  }
  if (type === 'invoice.payment_failed') {
    // Newer API versions put it under parent.subscription_details; older ones had invoice.subscription.
    const viaParent = asObj(asObj(o.parent).subscription_details).subscription;
    if (typeof viaParent === 'string') return viaParent;
    return typeof o.subscription === 'string' ? o.subscription : null;
  }
  return null;
}

export type SubscriptionRow = {
  stripe_subscription_id: string;
  user_id: string;
  plan: PlanKey;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

// Newer API versions moved current_period_end onto the subscription items.
function periodEnd(sub: Obj): string | null {
  const items = asObj(sub.items).data;
  const first = Array.isArray(items) ? asObj(items[0]) : {};
  const seconds = typeof first.current_period_end === 'number' ? first.current_period_end
    : typeof sub.current_period_end === 'number' ? sub.current_period_end : null;
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

function priceIdOf(sub: Obj): string | null {
  const items = asObj(sub.items).data;
  const first = Array.isArray(items) ? asObj(items[0]) : {};
  const price = asObj(first.price);
  return typeof price.id === 'string' ? price.id : null;
}

// userId: from our own metadata, or looked up from the customer. plan: metadata first, else the Price id.
// Returns null when the subscription is not one of ours (wrong plan or no user), so the caller skips it.
export function subscriptionToRow(
  subscription: unknown,
  userId: string | null,
  prices: { standard: string | undefined; caregiver: string | undefined },
  now: Date,
): SubscriptionRow | null {
  const sub = asObj(subscription);
  const id = typeof sub.id === 'string' ? sub.id : null;
  const status = typeof sub.status === 'string' ? sub.status : null;
  if (!id || !status || !isUuid(userId)) return null;
  const meta = asObj(sub.metadata);
  const price = priceIdOf(sub);
  let plan: PlanKey | null = null;
  if (price && prices.standard && price === prices.standard) plan = 'standard_monthly';
  else if (price && prices.caregiver && price === prices.caregiver) plan = 'caregiver_yearly';
  else if (isPlanKey(meta.plan)) plan = meta.plan;
  if (!plan) return null;
  return {
    stripe_subscription_id: id,
    user_id: userId,
    plan,
    status,
    current_period_end: periodEnd(sub),
    cancel_at_period_end: sub.cancel_at_period_end === true,
    updated_at: now.toISOString(),
  };
}

export function userIdFromMetadata(subscription: unknown): string | null {
  const v = asObj(asObj(subscription).metadata).user_id;
  return isUuid(v) ? v : null;
}
