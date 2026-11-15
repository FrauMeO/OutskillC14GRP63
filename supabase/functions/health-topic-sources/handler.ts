// The request handler for health-topic-sources, with its outside world passed in (login check,
// fetch, the key, the clock, a logger). It uses only web-standard Request, Response and fetch, so
// vitest runs the real thing (handler.safety.test.ts) and index.ts only wires it to Deno.
//
// Order of checks: 1 login, 2 a readable body, 3 pillar and topic, 4 key present, 5 the person's
// lookup limit, 6 Tavily, 7 shapeResults() keeps only checked sources from the trusted list.
// Logs carry codes and HTTP status only, never the topic, the person or Tavily's reply.
import {
  LookupLimiter,
  MESSAGES,
  TAVILY_TIMEOUT_MS,
  allowedOrigin,
  buildQuery,
  buildTavilyRequest,
  checkInput,
  shapeResults,
} from './logic.ts';

export type Deps = {
  // Returns the signed-in person for this Authorization header, or null. Their id is used only for
  // the lookup limit and never leaves this function.
  getUser: (authorization: string) => Promise<{ id: string } | null>;
  tavilyKey: string | undefined;
  fetch: typeof fetch;
  limiter: LookupLimiter;
  now?: () => number;
  log?: (line: string) => void;
};

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(req.headers.get('Origin')),
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((line: string) => console.log(line));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: MESSAGES.method }, 405);

  // 1. Login, from the person's own token. Never from the body.
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(req, { error: MESSAGES.login }, 401);
  let user: { id: string } | null = null;
  try {
    user = await deps.getUser(authorization);
  } catch {
    user = null;
  }
  if (!user) return json(req, { error: MESSAGES.login }, 401);

  // 2 and 3. Only `pillar` and `topic` are read from the body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: MESSAGES.badRequest }, 400);
  }
  const input = checkInput(body);
  if (!input.ok) return json(req, { error: input.message }, 400);

  // 4. The key is a Supabase secret. Without it nothing is sent anywhere.
  if (!deps.tavilyKey) {
    log('health-topic-sources: TAVILY_API_KEY is not set');
    return json(req, { error: MESSAGES.notSetUp }, 503);
  }

  // 5. Protect the credits.
  if (!deps.limiter.allow(user.id, (deps.now ?? Date.now)())) {
    log('health-topic-sources: refused, lookup limit');
    return json(req, { error: MESSAGES.busy }, 429);
  }

  // 6. Tavily gets the search words and the key. Nothing about the person.
  const { url, init } = buildTavilyRequest(buildQuery(input.pillar, input.topic), deps.tavilyKey);
  let reply: unknown;
  try {
    const res = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS) });
    if (!res.ok) {
      log(`health-topic-sources: tavily status ${res.status}`);
      return json(req, { error: MESSAGES.unavailable }, 502);
    }
    reply = await res.json();
  } catch (e) {
    log(`health-topic-sources: tavily ${e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'unreachable'}`);
    return json(req, { error: MESSAGES.unavailable }, 502);
  }

  // 7. Only checked sources from the trusted list reach the app.
  return json(req, { pillar: input.pillar, topic: input.topic, sources: shapeResults(reply) });
}
