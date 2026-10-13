// Deno-side Stripe and Supabase helpers shared by the three billing functions.
// Secrets (names only; set them with `supabase secrets set`, never in the repo):
//   STRIPE_SECRET_KEY            sk_test_... now, sk_live_... only when Miah goes live
//   STRIPE_WEBHOOK_SECRET        whsec_... from the webhook endpoint in Stripe
//   STRIPE_PRICE_STANDARD_MONTHLY, STRIPE_PRICE_CAREGIVER_YEARLY   price_... ids
//   STRIPE_TAX_ENABLED           optional, "true" once Stripe Tax is set up (docs/billing.md)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { STRIPE_API_VERSION, allowedOrigin, formEncode, type Form } from './stripeCore.ts';

export function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(req.headers.get('Origin')),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

// The signed-in person, taken from their own token. Never from the request body.
export async function signedInUser(req: Request): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export const isTestKey = () => /^(sk|rk)_test_/.test(Deno.env.get('STRIPE_SECRET_KEY') ?? '');

export class StripeError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

// Plain REST call. The error never includes the response body (it can echo customer details).
export async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST',
  path: string,
  params?: Form,
  idempotencyKey?: string,
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new StripeError(500, 'stripe_not_configured');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Stripe-Version': Deno.env.get('STRIPE_API_VERSION') ?? STRIPE_API_VERSION,
  };
  let url = `https://api.stripe.com/v1${path}`;
  let body: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    body = params ? formEncode(params) : '';
  } else if (params) {
    url += `?${formEncode(params)}`;
  }
  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    let code = 'stripe_error';
    try {
      const e = await res.json();
      if (typeof e?.error?.code === 'string') code = e.error.code;
      else if (typeof e?.error?.type === 'string') code = e.error.type;
    } catch { /* keep the generic code */ }
    throw new StripeError(res.status, code);
  }
  return (await res.json()) as T;
}
