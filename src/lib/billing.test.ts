import { describe, expect, it } from 'vitest';
import {
  PRICE_CAREGIVER_YEARLY,
  PRICE_STANDARD_MONTHLY,
  caregiverCardView,
  cleanName,
  isNativeApp,
  isStripeUrl,
  parseEntitlement,
  parseSubscriptions,
  planView,
  type Entitlement,
} from './billing';
import { validateBirth } from './signup';

const ent = (over: Partial<Entitlement> = {}): Entitlement => ({
  plan: 'standard', hasStandard: false, hasCaregiver: false, billingEnforced: false, status: 'beta', ...over,
});

describe('prices are exactly the ones Miah set', () => {
  it('has the two constants', () => {
    expect(PRICE_STANDARD_MONTHLY).toBe('$2.99 a month');
    expect(PRICE_CAREGIVER_YEARLY).toBe('$34.99 a year');
  });
});

describe('parseEntitlement', () => {
  const row = { plan: 'standard', has_standard: true, has_caregiver: false, billing_enforced: false, status: 'beta' };
  it('reads the one-row table (control)', () => {
    expect(parseEntitlement([row])).toEqual({ plan: 'standard', hasStandard: true, hasCaregiver: false, billingEnforced: false, status: 'beta' });
    expect(parseEntitlement(row)?.plan).toBe('standard');
  });
  it('refuses anything malformed', () => {
    expect(parseEntitlement([])).toBeNull();
    expect(parseEntitlement(null)).toBeNull();
    expect(parseEntitlement([{ ...row, plan: 'gold' }])).toBeNull();
    expect(parseEntitlement([{ ...row, has_standard: 'yes' }])).toBeNull();
  });
  it('parses subscriptions and drops unknown plans', () => {
    const subs = parseSubscriptions([
      { plan: 'caregiver_yearly', status: 'active', current_period_end: '2027-01-01T00:00:00Z', cancel_at_period_end: true },
      { plan: 'mystery', status: 'active' },
    ]);
    expect(subs).toEqual([{ plan: 'caregiver_yearly', status: 'active', currentPeriodEnd: '2027-01-01T00:00:00Z', cancelAtPeriodEnd: true }]);
  });
});

describe('native detection', () => {
  it('is true only when Capacitor says so', () => {
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(isNativeApp({})).toBe(false);
    expect(isNativeApp(undefined)).toBe(false);
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => { throw new Error('x'); } } })).toBe(false);
  });
});

describe('only Stripe pages are followed', () => {
  it('accepts Stripe checkout and portal, refuses everything else', () => {
    expect(isStripeUrl('https://checkout.stripe.com/c/pay/cs_test_1')).toBe(true);
    expect(isStripeUrl('https://billing.stripe.com/p/session/x')).toBe(true);
    expect(isStripeUrl('http://checkout.stripe.com/x')).toBe(false);
    expect(isStripeUrl('https://checkout.stripe.com.evil.example/x')).toBe(false);
    expect(isStripeUrl('javascript:alert(1)')).toBe(false);
    expect(isStripeUrl(undefined)).toBe(false);
  });
});

describe('plan wording', () => {
  it('says free for everyone 60 and over, with no button, in every state', () => {
    for (const billingEnforced of [false, true]) {
      for (const native of [false, true]) {
        const v = planView(ent({ plan: 'free_60_plus', hasStandard: true, billingEnforced }), { native });
        expect(v.headline).toBe('Free for everyone 60 and over');
        expect(v.cta).toBe('none');
        expect(JSON.stringify(v)).not.toMatch(/\$/);
      }
    }
  });
  it('says free while we are in beta for an under-60 person, with the price and no button (web)', () => {
    const v = planView(ent(), { native: false });
    expect(v.headline).toBe('$2.99 a month, free while we are in beta');
    expect(v.detail).toMatch(/Nothing is charged yet/);
    expect(v.cta).toBe('none');
  });
  it('offers the plan only when billing is on and the person has none (web)', () => {
    const v = planView(ent({ billingEnforced: true, status: 'none' }), { native: false });
    expect(v.cta).toBe('subscribe_standard');
    expect(v.headline).toContain(PRICE_STANDARD_MONTHLY);
  });
  it('shows an active plan with a manage link, and says when it will end', () => {
    const sub = { plan: 'standard_monthly' as const, status: 'active', currentPeriodEnd: '2027-01-15T12:00:00Z', cancelAtPeriodEnd: true };
    const v = planView(ent({ billingEnforced: true, hasStandard: true, status: 'active' }), { native: false, subscription: sub });
    expect(v.showManageLink).toBe(true);
    expect(v.detail).toMatch(/set to end/);
    expect(v.detail).toMatch(/2027/);
  });
  it('is gentle when a payment fails', () => {
    const sub = { plan: 'standard_monthly' as const, status: 'past_due', currentPeriodEnd: null, cancelAtPeriodEnd: false };
    const v = planView(ent({ billingEnforced: true, status: 'past_due' }), { native: false, subscription: sub });
    expect(v.headline).toBe('Your last payment did not go through');
    expect(v.detail).toMatch(/No problem/);
    expect(v.cta).toBe('manage');
  });
  it('asks a legacy account for birth month and year, never the day', () => {
    const v = planView(ent({ plan: 'unknown' }), { native: false });
    expect(v.cta).toBe('ask_birth');
    expect(v.detail).toMatch(/never ask for the day/);
  });
  it('has no countdown, urgency or guilt wording anywhere', () => {
    const views = [
      planView(ent(), { native: false }),
      planView(ent({ billingEnforced: true }), { native: false }),
      planView(ent({ plan: 'unknown' }), { native: false }),
      planView(ent({ billingEnforced: true }), { native: true }),
    ];
    for (const v of views) expect(JSON.stringify(v)).not.toMatch(/hurry|last chance|only \d|expires? (in|soon)|don't miss|limited time|act now|days? left/i);
  });
});

describe('native builds sell nothing', () => {
  it('shows no price, no purchase button and the plain pointer to the website, billing on', () => {
    const v = planView(ent({ billingEnforced: true, status: 'none' }), { native: true });
    expect(v.cta).toBe('none');
    expect(v.ctaLabel).toBeNull();
    expect(v.detail).toBe('Manage your plan on buildyourpillars.com');
    expect(JSON.stringify(v)).not.toMatch(/\$|subscribe|choose this plan/i);
  });
  it('shows no price in beta either', () => {
    const v = planView(ent(), { native: true });
    expect(JSON.stringify(v)).not.toMatch(/\$/);
    expect(v.cta).toBe('none');
  });
  it('shows no manage link and no price for an active plan', () => {
    const sub = { plan: 'standard_monthly' as const, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false };
    const v = planView(ent({ billingEnforced: true, hasStandard: true }), { native: true, subscription: sub });
    expect(v.showManageLink).toBe(false);
    expect(v.cta).toBe('none');
    expect(JSON.stringify(v)).not.toMatch(/\$/);
  });
  it('control: the same state on the web does show the price and a button', () => {
    const v = planView(ent({ billingEnforced: true, status: 'none' }), { native: false });
    expect(v.ctaLabel).not.toBeNull();
    expect(JSON.stringify(v)).toMatch(/\$/);
  });
});

describe('caregiver card', () => {
  it('uses the exact sentence from the brief', () => {
    const v = caregiverCardView('Anna', ent({ billingEnforced: true }), false);
    expect(v).toMatchObject({ show: true, cta: 'subscribe_caregiver' });
    if (v.show) expect(v.text).toBe('You can follow Anna with a caregiver plan, $34.99 a year. Anna has already said yes.');
  });
  it('is only informational in beta', () => {
    const v = caregiverCardView('Anna', ent(), false);
    expect(v).toMatchObject({ show: true, cta: 'none' });
    if (v.show) expect(v.note).toMatch(/free while we are in beta/);
  });
  it('disappears once the caregiver plan is active', () => {
    expect(caregiverCardView('Anna', ent({ billingEnforced: true, hasCaregiver: true }), false)).toEqual({ show: false });
  });
  it('has no price or button in a native build', () => {
    const v = caregiverCardView('Anna', ent({ billingEnforced: true }), true);
    expect(JSON.stringify(v)).not.toMatch(/\$|subscribe/i);
    expect(v).toMatchObject({ show: true, cta: 'none' });
  });
  it('cleans the name', () => {
    expect(cleanName('  Anna   B ')).toBe('Anna B');
    expect(cleanName('')).toBe('this person');
    expect(cleanName(null)).toBe('this person');
    expect(cleanName('x'.repeat(100))).toHaveLength(40);
  });
});

describe('birth prompt rules (shared with sign-up)', () => {
  const today = new Date(2026, 9, 12);
  it('refuses under 16 and accepts exactly 16 (boundary)', () => {
    expect(validateBirth(10, 2010, today).ok).toBe(true);
    expect(validateBirth(11, 2010, today).ok).toBe(false);
  });
  it('puts someone born in October 1966 on the free plan, November 1966 on the paid plan', () => {
    expect(validateBirth(10, 1966, today)).toMatchObject({ ok: true, plan: 'free_60_plus' });
    expect(validateBirth(11, 1966, today)).toMatchObject({ ok: true, plan: 'standard' });
  });
});
