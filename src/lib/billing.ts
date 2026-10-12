// Plans and billing wording (Miah, 2026-10-12). Pure, so it can be tested without a browser.
// Free from age 60; $2.99 a month for everyone else; a caregiver plan at $34.99 a year that is only
// for people the older person has already said yes to. The server decides who may buy what; this
// file only decides what to SAY and which button to show.

export const PRICE_STANDARD_MONTHLY = '$2.99 a month';
export const PRICE_CAREGIVER_YEARLY = '$34.99 a year';
export const PLAN_SITE = 'buildyourpillars.com';

export type UserPlan = 'free_60_plus' | 'standard' | 'unknown';

export type Entitlement = {
  plan: UserPlan;
  hasStandard: boolean;
  hasCaregiver: boolean;
  billingEnforced: boolean;
  status: string;
};

export type SubscriptionInfo = {
  plan: 'standard_monthly' | 'caregiver_yearly';
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

// my_entitlement() returns a one-row table, which supabase-js hands back as an array.
export function parseEntitlement(raw: unknown): Entitlement | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const plan = r.plan;
  if (plan !== 'free_60_plus' && plan !== 'standard' && plan !== 'unknown') return null;
  if (typeof r.has_standard !== 'boolean' || typeof r.has_caregiver !== 'boolean' || typeof r.billing_enforced !== 'boolean') return null;
  return {
    plan,
    hasStandard: r.has_standard,
    hasCaregiver: r.has_caregiver,
    billingEnforced: r.billing_enforced,
    status: typeof r.status === 'string' ? r.status : '',
  };
}

export function parseSubscriptions(raw: unknown): SubscriptionInfo[] {
  if (!Array.isArray(raw)) return [];
  const out: SubscriptionInfo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if ((r.plan !== 'standard_monthly' && r.plan !== 'caregiver_yearly') || typeof r.status !== 'string') continue;
    out.push({
      plan: r.plan,
      status: r.status,
      currentPeriodEnd: typeof r.current_period_end === 'string' ? r.current_period_end : null,
      cancelAtPeriodEnd: r.cancel_at_period_end === true,
    });
  }
  return out;
}

// Native builds (Capacitor) must not sell or show prices. Apple and Google have their own rules for
// digital subscriptions sold inside an app; version 1 sells on the web only (docs/billing.md, section 1).
export function isNativeApp(win: unknown = typeof window === 'undefined' ? undefined : window): boolean {
  const cap = (win as { Capacitor?: { isNativePlatform?: () => boolean } } | undefined)?.Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// Only ever send the browser to Stripe's own pages.
export function isStripeUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'checkout.stripe.com' || u.hostname === 'billing.stripe.com');
  } catch {
    return false;
  }
}

export type Cta = 'none' | 'subscribe_standard' | 'manage' | 'ask_birth';

export type PlanView = {
  headline: string;
  detail: string;
  note: string | null; // a calm extra line, for example the beta note
  cta: Cta;
  ctaLabel: string | null;
  showManageLink: boolean; // "Manage or cancel your plan" (portal), web only
};

const NATIVE_LINE = `Manage your plan on ${PLAN_SITE}`;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function planView(ent: Entitlement, opts: { native: boolean; subscription?: SubscriptionInfo | null }): PlanView {
  const { native } = opts;
  const sub = opts.subscription ?? null;
  const hasSub = sub !== null;
  const manage = !native && hasSub;

  if (ent.plan === 'free_60_plus') {
    return {
      headline: 'Free for everyone 60 and over',
      detail: 'Build Your Pillars is free for you, with everything included. There is nothing to pay.',
      note: null,
      cta: 'none',
      ctaLabel: null,
      showManageLink: false,
    };
  }

  if (ent.plan === 'unknown') {
    return {
      headline: 'One quick thing',
      detail: 'Please tell us your birth month and year. We use them only to work out your plan, and we never ask for the day.',
      note: ent.billingEnforced ? null : 'Nothing is charged yet. Everything is free while we are in beta.',
      cta: 'ask_birth',
      ctaLabel: 'Add my birth month and year',
      showManageLink: false,
    };
  }

  // Under 60.
  if (!ent.billingEnforced) {
    return {
      headline: native ? 'Free while we are in beta' : `${PRICE_STANDARD_MONTHLY}, free while we are in beta`,
      detail: 'Nothing is charged yet, and everything is open to you.',
      note: null,
      cta: 'none',
      ctaLabel: null,
      showManageLink: manage,
    };
  }

  if (ent.hasStandard) {
    const until = formatDate(sub?.currentPeriodEnd ?? null);
    const ending = sub?.cancelAtPeriodEnd === true;
    return {
      headline: native ? 'Your plan is active' : `${PRICE_STANDARD_MONTHLY}`,
      detail: ending
        ? `Your plan is set to end${until ? ` on ${until}` : ' at the end of this period'}. You can keep using everything until then.`
        : `Your plan is active${until ? ` until ${until}, then it renews` : ''}.`,
      note: native ? NATIVE_LINE : null,
      cta: manage ? 'manage' : 'none',
      ctaLabel: manage ? 'Manage or cancel my plan' : null,
      showManageLink: manage,
    };
  }

  // Enforced, under 60, no active plan.
  if (native) {
    return {
      headline: 'You do not have a plan yet',
      detail: NATIVE_LINE,
      note: null,
      cta: 'none',
      ctaLabel: null,
      showManageLink: false,
    };
  }
  const lapsed = sub !== null && sub.status === 'past_due';
  return {
    headline: lapsed ? 'Your last payment did not go through' : `Your plan: ${PRICE_STANDARD_MONTHLY}`,
    detail: lapsed
      ? 'No problem. You can update your card and carry on whenever you are ready.'
      : 'This keeps Build Your Pillars independent and free of ads. You can stop at any time.',
    note: null,
    cta: lapsed ? 'manage' : 'subscribe_standard',
    ctaLabel: lapsed ? 'Update my card' : 'Choose this plan',
    showManageLink: manage,
  };
}

export type CaregiverCardView =
  | { show: false }
  | { show: true; text: string; note: string | null; cta: 'subscribe_caregiver' | 'none'; ctaLabel: string | null };

export function cleanName(name: string | null | undefined): string {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return n || 'this person';
}

// For the supporter side. "{name} has already said yes" is true because this card is only shown for an
// active, accepted share. The server checks that again before it sells anything.
export function caregiverCardView(name: string | null | undefined, ent: Entitlement, native: boolean): CaregiverCardView {
  const who = cleanName(name);
  if (ent.hasCaregiver && ent.billingEnforced) return { show: false };
  if (native) {
    return {
      show: true,
      text: `Your caregiver plan for following ${who} is managed on ${PLAN_SITE}.`,
      note: ent.billingEnforced ? null : 'Nothing is charged yet. Everything is free while we are in beta.',
      cta: 'none',
      ctaLabel: null,
    };
  }
  return {
    show: true,
    text: `You can follow ${who} with a caregiver plan, ${PRICE_CAREGIVER_YEARLY}. ${who} has already said yes.`,
    note: ent.billingEnforced ? null : 'It is free while we are in beta, and nothing is charged yet.',
    cta: ent.billingEnforced ? 'subscribe_caregiver' : 'none',
    ctaLabel: ent.billingEnforced ? 'Choose the caregiver plan' : null,
  };
}
