// Supabase Edge Function: start a Stripe hosted Checkout for a plan. NOT DEPLOYED; Miah's session deploys it.
// verify_jwt stays ON (the default): only a signed-in person can call it.
// Input {plan: 'standard_monthly' | 'caregiver_yearly'}. Output {url} to redirect the browser to.
// The server decides the price, the redirect URLs and whether this person may buy this plan.
// No card data ever touches us: the card is typed on Stripe's page.
import {
  CANCEL_URL,
  SUCCESS_URL,
  checkoutIdempotencyKey,
  customerIdempotencyKey,
  decideCheckout,
  isPlanKey,
  type UserPlan,
} from '../_shared/stripeCore.ts';
import { StripeError, corsHeaders, isTestKey, jsonResponse, serviceClient, signedInUser, stripe } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Use POST.' }, 405);

  const user = await signedInUser(req);
  if (!user) return jsonResponse(req, { error: 'Please log in.' }, 401);

  let plan: unknown;
  try {
    plan = (await req.json())?.plan;
  } catch {
    return jsonResponse(req, { error: 'Bad request.' }, 400);
  }
  if (!isPlanKey(plan)) return jsonResponse(req, { error: 'Unknown plan.' }, 400);

  // The Price id is chosen here from the environment. The client never sends one.
  const priceId = Deno.env.get(plan === 'standard_monthly' ? 'STRIPE_PRICE_STANDARD_MONTHLY' : 'STRIPE_PRICE_CAREGIVER_YEARLY');
  if (!priceId) return jsonResponse(req, { error: 'Plans are not set up yet.' }, 503);

  const db = serviceClient();

  // Facts, all read with the service role (RLS bypassed on purpose, never trusting the client).
  const [planRes, settingRes, shareRes, subRes, customerRes] = await Promise.all([
    db.rpc('plan_for', { p_user: user.id }),
    db.from('app_settings').select('value').eq('key', 'billing_enforced').maybeSingle(),
    db.from('care_shares').select('id').eq('viewer_id', user.id).eq('status', 'active').limit(1),
    db.from('subscriptions').select('status, current_period_end').eq('user_id', user.id).eq('plan', plan),
    db.from('customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle(),
  ]);
  if (planRes.error || settingRes.error || shareRes.error || subRes.error || customerRes.error) {
    return jsonResponse(req, { error: 'Something went wrong. Please try again in a moment.' }, 500);
  }

  const now = new Date();
  const alreadySubscribed = (subRes.data ?? []).some(
    (s) => ['active', 'trialing'].includes(s.status) && (!s.current_period_end || new Date(s.current_period_end) > now),
  );
  const decision = decideCheckout({
    plan,
    userPlan: (planRes.data as UserPlan) ?? 'unknown',
    hasActiveShare: (shareRes.data ?? []).length > 0,
    alreadySubscribed,
    billingEnforced: settingRes.data?.value === true,
    testMode: isTestKey(),
  });
  if (!decision.ok) return jsonResponse(req, { error: decision.message }, decision.status);

  try {
    // Reuse the Stripe customer if there is one; otherwise create it (the same key returns the same customer on retry).
    let customerId = customerRes.data?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const created = await stripe<{ id: string }>(
        'POST',
        '/customers',
        { email: user.email ?? undefined, metadata: { user_id: user.id } },
        customerIdempotencyKey(user.id),
      );
      customerId = created.id;
      // user_id is the primary key: a concurrent call that already saved a row wins, ours is ignored.
      await db.from('customers').upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id', ignoreDuplicates: true });
    }

    const taxOn = Deno.env.get('STRIPE_TAX_ENABLED') === 'true';
    const session = await stripe<{ url: string | null }>(
      'POST',
      '/checkout/sessions',
      {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: SUCCESS_URL,
        cancel_url: CANCEL_URL,
        metadata: { user_id: user.id, plan },
        // The subscription itself carries the same facts, so every later webhook can find the person.
        // The caregiver plan deliberately does NOT record whom it is for.
        subscription_data: { metadata: { user_id: user.id, plan } },
        ...(taxOn
          ? { automatic_tax: { enabled: true }, billing_address_collection: 'required', customer_update: { address: 'auto', name: 'auto' } }
          : {}),
      },
      checkoutIdempotencyKey(user.id, plan, now),
    );
    if (!session.url) return jsonResponse(req, { error: 'Something went wrong. Please try again in a moment.' }, 502);
    return jsonResponse(req, { url: session.url });
  } catch (e) {
    // Log the code only (never request or response bodies).
    console.error('create-checkout failed:', e instanceof StripeError ? `${e.status} ${e.code}` : 'unexpected');
    return jsonResponse(req, { error: 'Something went wrong. Please try again in a moment.' }, 502);
  }
});
