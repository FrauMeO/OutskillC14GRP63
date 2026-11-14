// Live check for the health-topic-sources edge function, without Supabase, Deno or a key.
// Runs the REAL handler (supabase/functions/health-topic-sources/handler.ts) with a stand-in login and
// Tavily's keyless mode: the Authorization header the handler builds is swapped for
// `X-Tavily-Access-Mode: keyless`. Everything else (checks, request shape, result shaping) is the shipped code.
//
//   npx vite-node scripts/check-health-topic-sources.ts [pillar] [topic]
//   npx vite-node scripts/check-health-topic-sources.ts sleep "caffeine"
//
// Sends only the topic you type, to api.tavily.com. Prints the outbound body and the reply the app would get.
import { handle } from '../supabase/functions/health-topic-sources/handler';
import { LookupLimiter } from '../supabase/functions/health-topic-sources/logic';

const [pillar = 'sleep', topic = 'caffeine'] = process.argv.slice(2);

const keylessFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete('Authorization');
  headers.set('X-Tavily-Access-Mode', 'keyless');
  console.log('Outbound to', String(input));
  console.log('Headers:', Object.fromEntries(headers.entries()));
  console.log('Body:', init?.body);
  const started = Date.now();
  const res = await fetch(input, { ...init, headers });
  console.log(`Tavily answered ${res.status} in ${Date.now() - started} ms\n`);
  return res;
};

const req = new Request('http://localhost/functions/v1/health-topic-sources', {
  method: 'POST',
  headers: { Authorization: 'Bearer local-check', 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ pillar, topic }),
});

const res = await handle(req, {
  getUser: async () => ({ id: 'local-check' }),
  tavilyKey: 'keyless', // placeholder so the handler proceeds; keylessFetch removes it before sending
  fetch: keylessFetch,
  limiter: new LookupLimiter(),
  log: (line) => console.log('[function log]', line),
});

console.log(`Function replied ${res.status}:`);
console.log(JSON.stringify(await res.json(), null, 2));
if (!res.ok) process.exitCode = 1;
