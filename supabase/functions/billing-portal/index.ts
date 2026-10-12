// Supabase Edge Function: a link to Stripe's Customer Portal, where the person updates their card,
// sees invoices and cancels. NOT DEPLOYED; Miah's session deploys it. verify_jwt stays ON.
// Output {url}. The return address is fixed on our own site.
import { PORTAL_RETURN_URL } from '../_shared/stripeCore.ts';
import { StripeError, corsHeaders, jsonResponse, serviceClient, signedInUser, stripe } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Use POST.' }, 405);

  const user = await signedInUser(req);
  if (!user) return jsonResponse(req, { error: 'Please log in.' }, 401);

  const { data, error } = await serviceClient().from('customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (error) return jsonResponse(req, { error: 'Something went wrong. Please try again in a moment.' }, 500);
  if (!data) return jsonResponse(req, { error: 'You do not have a paid plan to manage.' }, 404);

  try {
    const session = await stripe<{ url: string }>('POST', '/billing_portal/sessions', {
      customer: data.stripe_customer_id,
      return_url: PORTAL_RETURN_URL,
    });
    return jsonResponse(req, { url: session.url });
  } catch (e) {
    console.error('billing-portal failed:', e instanceof StripeError ? `${e.status} ${e.code}` : 'unexpected');
    return jsonResponse(req, { error: 'Something went wrong. Please try again in a moment.' }, 502);
  }
});
