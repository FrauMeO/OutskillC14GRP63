import { describe, expect, it } from 'vitest';
import {
  EXCLUDED_DOMAINS,
  LookupLimiter,
  MAX_SOURCES,
  MESSAGES,
  SITE,
  SNIPPET_MAX,
  TAVILY_BODY_KEYS,
  TAVILY_SEARCH_URL,
  TOPIC_MAX,
  TRUSTED_DOMAINS,
  allowedOrigin,
  buildQuery,
  buildTavilyRequest,
  checkInput,
  shapeResults,
  trustedDomainFor,
} from './logic';

const ok = (pillar: string, topic: unknown) => checkInput({ pillar, topic });

describe('checkInput: pillar', () => {
  it('accepts the four pillar keys (control) and rejects anything else', () => {
    for (const p of ['nutrition', 'sleep', 'exercise', 'wellbeing']) expect(ok(p, 'caffeine').ok).toBe(true);
    for (const p of ['Drink', 'move', '', 'toString', '__proto__', null, 7]) {
      expect(checkInput({ pillar: p, topic: 'caffeine' })).toEqual({ ok: false, message: MESSAGES.pillar });
    }
    expect(checkInput(null)).toEqual({ ok: false, message: MESSAGES.pillar });
  });
});

describe('checkInput: topic shape', () => {
  it('trims, collapses spaces and keeps ordinary topics (control)', () => {
    expect(ok('sleep', '  sleep   and\tcaffeine ')).toEqual({ ok: true, pillar: 'sleep', topic: 'sleep and caffeine' });
    expect(ok('nutrition', 'vitamin B12').ok).toBe(true); // short numbers are fine
    expect(ok('nutrition', 'omega-3 and fish').ok).toBe(true);
    expect(ok('wellbeing', 'Stressbewältigung im Alltag').ok).toBe(true); // other languages
    expect(ok('exercise', 'walking, stretching & yoga').ok).toBe(true);
    expect(ok('sleep', 'feeling ill and sleep').ok).toBe(true); // "ill" is a word, not "I'll"
  });

  it('length: 2 to 80 characters, at most 10 words, exactly on the edges', () => {
    expect(ok('sleep', 'a').ok).toBe(false);
    expect(ok('sleep', 'ab').ok).toBe(true);
    expect(ok('sleep', 'a'.repeat(TOPIC_MAX)).ok).toBe(true);
    expect(ok('sleep', 'a'.repeat(TOPIC_MAX + 1)).ok).toBe(false);
    expect(ok('sleep', 'x'.repeat(100_000)).ok).toBe(false); // never normalised
    expect(ok('sleep', Array(10).fill('rest').join(' ')).ok).toBe(true);
    expect(ok('sleep', Array(11).fill('rest').join(' ')).ok).toBe(false);
  });

  it('rejects non-text, emails, web addresses and long numbers', () => {
    for (const t of [undefined, 42, ['sleep'], { t: 'sleep' }]) {
      expect(ok('sleep', t)).toEqual({ ok: false, message: MESSAGES.topicShape });
    }
    for (const t of ['ask sam@example.org', 'https://evil.example', 'www.example.com', 'sleep: tips', 'sleep <b>tips</b>']) {
      expect(ok('sleep', t)).toEqual({ ok: false, message: MESSAGES.topicShape });
    }
    for (const t of ['call 555 0199 now', 'sleep since 2019', 'weight 200 lb', 'dose 500mg']) {
      expect(ok('sleep', t)).toEqual({ ok: false, message: MESSAGES.topicShape });
    }
  });

  it('rejects topics about the person themselves, in any case or apostrophe', () => {
    for (const t of ['my insomnia', 'I feel alone', "I'm always tired", 'I’ve stopped eating', 'help me sleep', 'MY NOTES']) {
      expect(ok('wellbeing', t)).toEqual({ ok: false, message: MESSAGES.topicPersonal });
    }
    expect(ok('wellbeing', 'loneliness in older adults').ok).toBe(true); // control: the general version
  });
});

describe('buildQuery', () => {
  it('adds the pillar words, unless the topic already has them', () => {
    expect(buildQuery('sleep', 'caffeine')).toBe('caffeine sleep');
    expect(buildQuery('sleep', 'Sleep and caffeine')).toBe('Sleep and caffeine');
    expect(buildQuery('exercise', 'balance')).toBe('balance physical activity');
    expect(buildQuery('wellbeing', 'balance')).toBe('balance mental wellbeing');
    expect(buildQuery('nutrition', 'water for older adults')).toBe('water for older adults hydration');
  });
});

describe('buildTavilyRequest', () => {
  it('sends exactly the allowed keys, the trusted domains and only two headers', () => {
    const { url, init } = buildTavilyRequest('caffeine sleep', 'tvly-test');
    const body = JSON.parse(init.body);
    expect(url).toBe(TAVILY_SEARCH_URL);
    expect(init.method).toBe('POST');
    expect(Object.keys(body).sort()).toEqual([...TAVILY_BODY_KEYS].sort());
    expect(body.query).toBe('caffeine sleep');
    expect(body.include_domains).toEqual(TRUSTED_DOMAINS);
    expect(body.exclude_domains).toEqual(EXCLUDED_DOMAINS);
    expect(body.search_depth).toBe('basic');
    expect(body.include_answer).toBe(false);
    expect(body.max_results).toBeGreaterThanOrEqual(MAX_SOURCES);
    expect(init.headers).toEqual({ Authorization: 'Bearer tvly-test', 'Content-Type': 'application/json' });
  });
});

describe('trustedDomainFor', () => {
  it('accepts listed domains and their subdomains (control), rejects look-alikes', () => {
    expect(trustedDomainFor('www.cdc.gov')).toBe('cdc.gov');
    expect(trustedDomainFor('nia.nih.gov')).toBe('nih.gov');
    expect(trustedDomainFor('MedlinePlus.gov.')).toBe('medlineplus.gov');
    for (const h of ['nih.gov.example.com', 'fakenih.gov', 'cdc.gov-health.info', 'who.int.evil', 'nhs.uk.co', 'example.com']) {
      expect(trustedDomainFor(h)).toBeNull();
    }
  });
  it('leaves out the research databases inside nih.gov, but keeps the rest of nih.gov', () => {
    for (const h of ['pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'www.ncbi.nlm.nih.gov']) expect(trustedDomainFor(h)).toBeNull();
    expect(trustedDomainFor('www.nia.nih.gov')).toBe('nih.gov'); // control
    expect(trustedDomainFor('www.nlm.nih.gov')).toBe('nih.gov'); // control: only ncbi is left out
  });
});

describe('shapeResults', () => {
  const r = (o: Record<string, unknown>) => ({ title: 'Caffeine and sleep', url: 'https://www.cdc.gov/sleep/caffeine.html', content: 'Caffeine can stay in the body for hours.', score: 0.9, ...o });

  it('returns the typed fields only, with the bare domain', () => {
    expect(shapeResults({ results: [r({ raw_content: 'long page', favicon: 'x' })] })).toEqual([
      { title: 'Caffeine and sleep', url: 'https://www.cdc.gov/sleep/caffeine.html', snippet: 'Caffeine can stay in the body for hours.', source_domain: 'cdc.gov' },
    ]);
  });

  it('drops untrusted, non-https, credentialed, malformed and duplicate results', () => {
    const out = shapeResults({
      results: [
        r({}),
        r({ url: 'https://www.cdc.gov/sleep/caffeine.html#top' }), // same page
        r({ url: 'http://www.nhs.uk/sleep' }),
        r({ url: 'https://nih.gov.example.com/sleep' }),
        r({ url: 'https://user:pw@www.nhs.uk/sleep' }),
        r({ url: 'not a url' }),
        r({ url: 42 }),
        r({ content: null }),
        r({ content: '   ' }),
        null,
        r({ url: 'https://www.nhs.uk/live-well/sleep-and-tiredness/' }),
      ],
    });
    expect(out.map((s) => s.url)).toEqual(['https://www.cdc.gov/sleep/caffeine.html', 'https://www.nhs.uk/live-well/sleep-and-tiredness/']);
  });

  it('cleans tags and markdown, shortens long text, falls back to the domain for a missing title', () => {
    const [s] = shapeResults({ results: [r({ title: '', content: `<p>**Sleep** matters.</p> ${'word '.repeat(200)}` })] });
    expect(s.title).toBe('cdc.gov');
    expect(s.snippet.startsWith('Sleep matters.')).toBe(true);
    expect(s.snippet.length).toBeLessThanOrEqual(SNIPPET_MAX);
    expect(s.snippet.endsWith('…')).toBe(true);
    expect(s.snippet).not.toMatch(/[<>*]/);
  });

  it(`returns at most ${MAX_SOURCES}, and nothing for an unexpected reply`, () => {
    const many = Array.from({ length: 9 }, (_, i) => r({ url: `https://www.who.int/page-${i}` }));
    expect(shapeResults({ results: many })).toHaveLength(MAX_SOURCES);
    for (const bad of [null, undefined, 'text', {}, { results: 'x' }]) expect(shapeResults(bad)).toEqual([]);
  });
});

describe('allowedOrigin', () => {
  it('echoes known origins (control) and falls back to the site for others', () => {
    for (const o of [SITE, 'https://www.buildyourpillars.com', 'http://localhost:5173', 'capacitor://localhost', 'https://localhost',
      'https://buildyourpillars-rixmvdhn4-olmsted-portfolio.vercel.app']) {
      expect(allowedOrigin(o)).toBe(o);
    }
    for (const o of [null, 'https://evil.example', 'https://buildyourpillars.com.evil.example', 'https://buildyourpillars-x-other-team.vercel.app']) {
      expect(allowedOrigin(o)).toBe(SITE);
    }
  });
});

describe('LookupLimiter', () => {
  it('allows the limit, refuses the next, and frees up as the window slides', () => {
    const l = new LookupLimiter(3, 1000);
    expect([l.allow('a', 0), l.allow('a', 10), l.allow('a', 20)]).toEqual([true, true, true]); // on the limit
    expect(l.allow('a', 30)).toBe(false); // above
    expect(l.allow('b', 30)).toBe(true); // another person is separate
    expect(l.allow('a', 999)).toBe(false); // still inside the window
    expect(l.allow('a', 1000)).toBe(true); // the first call has left the window
  });
});
