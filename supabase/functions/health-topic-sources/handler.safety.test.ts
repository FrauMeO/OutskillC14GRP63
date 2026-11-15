// Privacy and safety tests for the real handler, with Tavily mocked. The main claim: nothing about
// the person (id, email, token, entries, check-ins, notes, location, extra headers) reaches the
// outbound request. Positive controls show the leak detector does catch a planted value, and that
// the captured request really is the one sent (it carries the topic).
import { describe, expect, it, vi } from 'vitest';
import { handle, type Deps } from './handler';
import { LookupLimiter, MESSAGES, TAVILY_BODY_KEYS, TAVILY_SEARCH_URL } from './logic';

const USER_ID = 'uid-SENTINEL-7f3a9c';
const EMAIL = 'sentinel.person@example.org';
const JWT = 'Bearer eyJSENTINEL.jwt.token';
const SENTINELS = [USER_ID, EMAIL, JWT, 'eyJSENTINEL', 'SENTINEL-NOTE', 'SENTINEL-CITY', 'SENTINEL-APIKEY', 'SENTINEL-COOKIE', 'SENTINEL-FEELING'];
const KEY = 'tvly-test-key';

const TAVILY_REPLY = {
  query: 'caffeine sleep',
  results: [
    { title: 'Caffeine and sleep', url: 'https://www.cdc.gov/sleep/caffeine.html', content: 'Caffeine can stay in the body for hours.', score: 0.9 },
    { title: 'Not trusted', url: 'https://example.com/sleep', content: 'Should be dropped.', score: 0.8 },
  ],
};

type Captured = { url: string; init: RequestInit };

function setup(over: Partial<Deps> = {}, reply: unknown = TAVILY_REPLY, status = 200) {
  const calls: Captured[] = [];
  const logs: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
  });
  const deps: Deps = {
    getUser: async (auth) => (auth === JWT ? { id: USER_ID } : null),
    tavilyKey: KEY,
    fetch: fetchMock as unknown as typeof fetch,
    limiter: new LookupLimiter(),
    now: () => 1_800_000_000_000,
    log: (line) => logs.push(line),
    ...over,
  };
  return { deps, calls, logs };
}

// A request loaded with everything a careless client might send along.
function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request('https://project.supabase.co/functions/v1/health-topic-sources', {
    method: 'POST',
    headers: {
      Authorization: JWT,
      'Content-Type': 'application/json',
      Origin: 'https://buildyourpillars.com',
      apikey: 'SENTINEL-APIKEY',
      'x-client-info': `supabase-js ${USER_ID}`,
      Cookie: 'session=SENTINEL-COOKIE',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const LOADED_BODY = {
  pillar: 'sleep',
  topic: 'caffeine',
  user_id: USER_ID,
  email: EMAIL,
  mood: 2,
  stress: 5,
  feelings: ['SENTINEL-FEELING'],
  notes: 'SENTINEL-NOTE felt alone today',
  location: 'SENTINEL-CITY',
  checkins: [{ log_date: '2026-11-13', mood: 1, notes: 'SENTINEL-NOTE' }],
};

function serialise(c: Captured): string {
  const headers = Object.fromEntries(new Headers(c.init.headers).entries());
  return JSON.stringify({ url: c.url, method: c.init.method, headers, body: c.init.body });
}
const leaks = (text: string) => SENTINELS.filter((s) => text.includes(s));

describe('no user data reaches Tavily', () => {
  it('sends one request with only the topic words, the fixed settings and the key', async () => {
    const { deps, calls } = setup();
    const res = await handle(request(LOADED_BODY), deps);
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);

    const [call] = calls;
    expect(call.url).toBe(TAVILY_SEARCH_URL);
    expect(call.init.method).toBe('POST');
    const body = JSON.parse(String(call.init.body));
    expect(Object.keys(body).sort()).toEqual([...TAVILY_BODY_KEYS].sort());
    expect(body.query).toBe('caffeine sleep'); // control: this is the real outbound request
    expect(Object.fromEntries(new Headers(call.init.headers).entries())).toEqual({
      authorization: `Bearer ${KEY}`,
      'content-type': 'application/json',
    });
    expect(leaks(serialise(call))).toEqual([]);
  });

  it('positive control: the detector finds a planted value in the same captured request', async () => {
    const { deps, calls } = setup();
    await handle(request(LOADED_BODY), deps);
    const body = JSON.parse(String(calls[0].init.body));
    const planted = { ...calls[0], init: { ...calls[0].init, body: JSON.stringify({ ...body, user: USER_ID }) } };
    expect(leaks(serialise(planted))).toContain(USER_ID);
  });

  it('the reply to the app carries no extra fields and only trusted sources', async () => {
    const { deps } = setup();
    const out = await (await handle(request(LOADED_BODY), deps)).json();
    expect(Object.keys(out).sort()).toEqual(['pillar', 'sources', 'topic']);
    expect(out.sources).toEqual([
      { title: 'Caffeine and sleep', url: 'https://www.cdc.gov/sleep/caffeine.html', snippet: 'Caffeine can stay in the body for hours.', source_domain: 'cdc.gov' },
    ]);
    expect(leaks(JSON.stringify(out))).toEqual([]);
  });

  it('logs never contain the topic or the person, even when Tavily fails', async () => {
    const { deps, logs } = setup({}, { error: `echo ${EMAIL}` }, 500);
    const res = await handle(request(LOADED_BODY), deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: MESSAGES.unavailable });
    expect(logs).toEqual(['health-topic-sources: tavily status 500']);
    expect(leaks(logs.join('\n'))).toEqual([]);
    expect(logs.join('\n')).not.toContain('caffeine');
  });
});

describe('nothing is sent when a check fails', () => {
  it('no login, a wrong token or a failing login check: 401', async () => {
    const { deps, calls } = setup();
    const noAuth = new Request('https://x.supabase.co/f', { method: 'POST', body: JSON.stringify(LOADED_BODY) });
    expect((await handle(noAuth, deps)).status).toBe(401);
    expect((await handle(request(LOADED_BODY, { Authorization: 'Bearer other' }), deps)).status).toBe(401);
    const broken = setup({ getUser: async () => { throw new Error('auth down'); } });
    expect((await handle(request(LOADED_BODY), broken.deps)).status).toBe(401);
    expect(calls).toHaveLength(0);
    expect(broken.calls).toHaveLength(0);
  });

  it('a topic about the person, a bad topic, a bad pillar or a bad body: 400', async () => {
    const { deps, calls } = setup();
    const personal = await handle(request({ ...LOADED_BODY, topic: 'my notes about feeling alone' }), deps);
    expect(personal.status).toBe(400);
    expect(await personal.json()).toEqual({ error: MESSAGES.topicPersonal });
    expect((await handle(request({ ...LOADED_BODY, topic: EMAIL }), deps)).status).toBe(400);
    expect((await handle(request({ ...LOADED_BODY, pillar: 'Sleep' }), deps)).status).toBe(400);
    const notJson = new Request('https://x.supabase.co/f', { method: 'POST', headers: { Authorization: JWT }, body: '{oops' });
    expect((await handle(notJson, deps)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('no key set: 503 and nothing sent', async () => {
    const { deps, calls } = setup({ tavilyKey: undefined });
    const res = await handle(request(LOADED_BODY), deps);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: MESSAGES.notSetUp });
    expect(calls).toHaveLength(0);
  });

  it('over the lookup limit: 429 and nothing sent', async () => {
    const { deps, calls } = setup({ limiter: new LookupLimiter(1, 60_000) });
    expect((await handle(request(LOADED_BODY), deps)).status).toBe(200);
    expect((await handle(request(LOADED_BODY), deps)).status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it('GET is refused and OPTIONS answers CORS without sending anything', async () => {
    const { deps, calls } = setup();
    expect((await handle(new Request('https://x.supabase.co/f'), deps)).status).toBe(405);
    const pre = await handle(new Request('https://x.supabase.co/f', { method: 'OPTIONS', headers: { Origin: 'capacitor://localhost' } }), deps);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
    expect(calls).toHaveLength(0);
  });
});

describe('Tavily trouble ends in the plain message', () => {
  it('unreachable, timeout and a reply that is not JSON: 502', async () => {
    for (const fail of [
      async () => { throw new TypeError('network'); },
      async () => { throw Object.assign(new Error('slow'), { name: 'TimeoutError' }); },
      async () => new Response('<html>', { status: 200 }),
    ]) {
      const { deps, logs } = setup({ fetch: fail as unknown as typeof fetch });
      const res = await handle(request(LOADED_BODY), deps);
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: MESSAGES.unavailable });
      expect(leaks(logs.join('\n'))).toEqual([]);
    }
  });

  it('an empty result is an empty list, not an error', async () => {
    const { deps } = setup({}, { results: [] });
    const res = await handle(request(LOADED_BODY), deps);
    expect(res.status).toBe(200);
    expect((await res.json()).sources).toEqual([]);
  });
});
