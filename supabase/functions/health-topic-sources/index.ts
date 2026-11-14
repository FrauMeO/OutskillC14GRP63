// Supabase Edge Function: short, sourced explanations for a pillar topic, from public-health sites
// only, found with Tavily Search. NOT DEPLOYED; Miah deploys it (README.md). verify_jwt stays ON
// (the default): only a signed-in person can call it.
//
// Input {pillar: 'nutrition' | 'sleep' | 'exercise' | 'wellbeing', topic: string}.
// Output {pillar, topic, sources: [{title, url, snippet, source_domain}]}, at most 5.
// Only the checked topic and fixed pillar words go to Tavily: no user data, check-ins or ids.
//
// Secret (name only; set it with `supabase secrets set`, never in the repo or the app):
//   TAVILY_API_KEY   tvly-...
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';
import { LookupLimiter, MESSAGES, allowedOrigin } from './logic.ts';

const limiter = new LookupLimiter();

// The signed-in person, from their own token (the same check as _shared/stripe.ts signedInUser).
async function getUser(authorization: string): Promise<{ id: string } | null> {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

Deno.serve((req) =>
  handle(req, {
    getUser,
    tavilyKey: Deno.env.get('TAVILY_API_KEY'),
    fetch,
    limiter,
  }).catch((err) => {
    // Fail closed with the plain message. Logs the error name only, never the request.
    console.error('health-topic-sources: unexpected error', err instanceof Error ? err.name : 'unknown');
    return new Response(JSON.stringify({ error: MESSAGES.unavailable }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin(req.headers.get('Origin')), 'Vary': 'Origin' },
    });
  }),
);
