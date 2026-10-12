// Browser side of billing: reads the person's entitlement and sends them to Stripe's hosted pages.
// The server decides everything; this only asks. Uses an untyped client so it does not depend on
// regenerated database types for the 0018 tables.
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isStripeUrl, parseEntitlement, parseSubscriptions, type Entitlement, type SubscriptionInfo } from './billing';

const db = supabase as unknown as SupabaseClient;

export type BillingState = {
  loading: boolean;
  error: boolean;
  entitlement: Entitlement | null;
  subscriptions: SubscriptionInfo[];
  birthNeeded: boolean;
  reload: () => Promise<void>;
};

export function useBilling(): BillingState {
  const [state, setState] = useState<Omit<BillingState, 'reload'>>({
    loading: true, error: false, entitlement: null, subscriptions: [], birthNeeded: false,
  });

  const reload = useCallback(async () => {
    const [ent, subs, birth] = await Promise.all([
      db.rpc('my_entitlement'),
      db.from('subscriptions').select('plan, status, current_period_end, cancel_at_period_end'),
      db.rpc('profile_birth_needed'),
    ]);
    const entitlement = ent.error ? null : parseEntitlement(ent.data);
    setState({
      loading: false,
      error: entitlement === null,
      entitlement,
      subscriptions: subs.error ? [] : parseSubscriptions(subs.data),
      birthNeeded: birth.error ? false : birth.data === true,
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

async function messageFrom(error: unknown): Promise<string> {
  const fallback = 'Something went wrong. Please try again in a moment.';
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (typeof body?.error === 'string') return body.error;
    }
  } catch { /* use the fallback */ }
  return fallback;
}

async function goToStripe(fn: 'create-checkout' | 'billing-portal', body?: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.functions.invoke(fn, { body });
  if (error) return messageFrom(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (!isStripeUrl(url)) return 'Something went wrong. Please try again in a moment.';
  window.location.assign(url);
  return null; // leaving the page
}

// Each returns an error message to show, or null when the browser is on its way to Stripe.
export const startCheckout = (plan: 'standard_monthly' | 'caregiver_yearly') => goToStripe('create-checkout', { plan });
export const openBillingPortal = () => goToStripe('billing-portal');
