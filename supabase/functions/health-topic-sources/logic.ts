// Pure rules for the health-topic-sources edge function. No Deno, no network and no imports, so
// vitest tests exactly the code that ships (the same pattern as _shared/stripeCore.ts).
//
// PRIVACY RULE: the only words that leave the app are the topic the person typed, after the checks
// below, plus a few fixed words for the pillar. Never a user id, email, token, check-in, note,
// location or anything else from the request. buildTavilyRequest() takes the query and the key and
// nothing else, so there is no way to pass more. handler.safety.test.ts proves it.

// ---- the four pillars (keys match src/lib/pillars.ts; a test checks they stay in step) ----
export type PillarKey = 'nutrition' | 'sleep' | 'exercise' | 'wellbeing';

// Fixed words added to the search so a topic is read in the right pillar ("balance" under Move
// means steadiness on your feet; under Balance it means feelings and mood).
export const PILLAR_CONTEXT: Record<PillarKey, string> = {
  nutrition: 'hydration',
  sleep: 'sleep',
  exercise: 'physical activity',
  wellbeing: 'mental wellbeing',
};

export function isPillarKey(v: unknown): v is PillarKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PILLAR_CONTEXT, v);
}

// ---- where sources may come from (also listed in README.md; keep the two in step) ----
// Public-health bodies only. A subdomain counts (nia.nih.gov is part of nih.gov).
export const TRUSTED_DOMAINS: readonly string[] = ['nih.gov', 'cdc.gov', 'who.int', 'medlineplus.gov', 'nhs.uk'];
// Research databases inside nih.gov (PubMed, PubMed Central). Their abstracts are written for
// scientists, full of figures; the feature is for short, plain explanations (first live check,
// 2026-11-14: all five results were abstracts). Remove a line here to let them back in.
export const EXCLUDED_DOMAINS: readonly string[] = ['ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov'];

export const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
export const MAX_SOURCES = 5; // returned to the app
const ASK_TAVILY_FOR = 8; // a few spare, in case some fail the checks in shapeResults()
export const TAVILY_TIMEOUT_MS = 10_000;

// ---- the topic the person typed ----
export const TOPIC_MIN = 2;
export const TOPIC_MAX = 80;
export const TOPIC_MAX_WORDS = 10;

// Draft wording for Miah to approve before any screen shows it.
export const MESSAGES = {
  login: 'Please log in.',
  badRequest: 'Bad request.',
  method: 'Use POST.',
  pillar: 'Please choose one of the four pillars.',
  topicShape: 'Please type a short topic of a few words, for example sleep and caffeine.',
  topicPersonal: 'Please type a general topic, without details about yourself.',
  notSetUp: 'Sources are not set up yet.',
  busy: 'You have looked up many topics in a short time. Please try again in a little while.',
  unavailable: 'Sources are not available right now. Please try again in a moment.',
} as const;

export type TopicCheck =
  | { ok: true; pillar: PillarKey; topic: string }
  | { ok: false; message: string };

// Letters (any language), combining marks, digits, spaces and a little punctuation. No @ . : so an
// email address or a web address cannot get through.
const ALLOWED = /^[\p{L}\p{M}\p{N} '’,&/-]+$/u;
// Three or more digits in a row: a phone number, a year, a weight, a dose. Short ones (B12, omega-3)
// are fine.
const LONG_NUMBER = /\p{N}{3,}/u;
// Words about the person themselves. The topic should be general ("sleep and caffeine"), never a
// description of the person ("my insomnia since the divorce").
// Contractions count only with the apostrophe: "ill" and "id" are English words and "im" is German
// ("Stressbewältigung im Alltag"), and Germany is a launch country.
const FIRST_PERSON = new Set(['i', "i'm", "i've", "i'd", "i'll", 'me', 'my', 'mine', 'myself']);

function isFirstPerson(word: string): boolean {
  return FIRST_PERSON.has(word.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}']/gu, ''));
}

export function normaliseTopic(raw: string): string {
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

// Body {pillar, topic}. Every other field is ignored, and nothing else is ever read from it.
export function checkInput(body: unknown): TopicCheck {
  const b = (body ?? {}) as { pillar?: unknown; topic?: unknown };
  if (!isPillarKey(b.pillar)) return { ok: false, message: MESSAGES.pillar };
  if (typeof b.topic !== 'string') return { ok: false, message: MESSAGES.topicShape };
  // Check the length before normalising, so a huge string is never worked on.
  if (b.topic.length > TOPIC_MAX * 4) return { ok: false, message: MESSAGES.topicShape };
  const topic = normaliseTopic(b.topic);
  if (topic.length < TOPIC_MIN || topic.length > TOPIC_MAX) return { ok: false, message: MESSAGES.topicShape };
  if (!ALLOWED.test(topic) || LONG_NUMBER.test(topic)) return { ok: false, message: MESSAGES.topicShape };
  const words = topic.split(' ');
  if (words.length > TOPIC_MAX_WORDS) return { ok: false, message: MESSAGES.topicShape };
  if (words.some(isFirstPerson)) {
    return { ok: false, message: MESSAGES.topicPersonal };
  }
  return { ok: true, pillar: b.pillar, topic };
}

// The search words: the topic, then the pillar's fixed words unless the topic already has them.
export function buildQuery(pillar: PillarKey, topic: string): string {
  const context = PILLAR_CONTEXT[pillar];
  return topic.toLowerCase().includes(context) ? topic : `${topic} ${context}`;
}

export type TavilyRequest = {
  url: string;
  init: { method: 'POST'; headers: Record<string, string>; body: string };
};

// Only these keys are ever sent. handler.safety.test.ts checks the body has exactly this set.
export const TAVILY_BODY_KEYS = [
  'query',
  'search_depth',
  'topic',
  'max_results',
  'include_domains',
  'exclude_domains',
  'include_answer',
  'include_raw_content',
  'include_images',
  'include_favicon',
] as const;

export function buildTavilyRequest(query: string, apiKey: string): TavilyRequest {
  const body: Record<(typeof TAVILY_BODY_KEYS)[number], unknown> = {
    query,
    search_depth: 'basic', // 1 credit; the page summary is the short explanation we want
    topic: 'general',
    max_results: ASK_TAVILY_FOR,
    include_domains: [...TRUSTED_DOMAINS],
    exclude_domains: [...EXCLUDED_DOMAINS],
    include_answer: false, // no AI-written answer: the sources speak for themselves
    include_raw_content: false,
    include_images: false,
    include_favicon: false,
  };
  return {
    url: TAVILY_SEARCH_URL,
    init: {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

// ---- what the app gets back ----
export type HealthSource = { title: string; url: string; snippet: string; source_domain: string };

export const TITLE_MAX = 160;
export const SNIPPET_MAX = 300;

const onDomain = (host: string, d: string) => host === d || host.endsWith(`.${d}`);

// A host on the list or one of its subdomains, and not excluded. "nih.gov.example.com" and
// "fakenih.gov" are not on the list.
export function trustedDomainFor(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (EXCLUDED_DOMAINS.some((d) => onDomain(host, d))) return null;
  return TRUSTED_DOMAINS.find((d) => onDomain(host, d)) ?? null;
}

function plainText(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ') // stray HTML tags
    .replace(/[#*_`>|]+/g, ' ') // markdown symbols
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

// Tavily's answer -> at most MAX_SOURCES checked sources. Anything unexpected is dropped, never passed on.
export function shapeResults(json: unknown): HealthSource[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const out: HealthSource[] = [];
  for (const r of results) {
    if (out.length >= MAX_SOURCES) break;
    const { title, url, content } = (r ?? {}) as { title?: unknown; url?: unknown; content?: unknown };
    if (typeof url !== 'string' || typeof content !== 'string') continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) continue;
    if (!trustedDomainFor(parsed.hostname)) continue;
    parsed.hash = '';
    const clean = parsed.toString();
    if (seen.has(clean)) continue;
    const snippet = shorten(plainText(content), SNIPPET_MAX);
    if (!snippet) continue;
    seen.add(clean);
    const sourceDomain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const t = typeof title === 'string' ? shorten(plainText(title), TITLE_MAX) : '';
    out.push({ title: t || sourceDomain, url: clean, snippet, source_domain: sourceDomain });
  }
  return out;
}

// ---- browser origins allowed to call (the billing list, plus the phone apps and Vercel previews) ----
// The login token is the real gate; this only stops other websites from using a person's session.
export const SITE = 'https://buildyourpillars.com';
const ALLOWED_ORIGINS = [
  SITE,
  'https://www.buildyourpillars.com',
  'http://localhost:5173',
  'capacitor://localhost', // iOS app (capacitor.config.ts)
  'https://localhost', // Android app (androidScheme https)
];
const PREVIEW_ORIGIN = /^https:\/\/buildyourpillars-[a-z0-9-]+-olmsted-portfolio\.vercel\.app$/;

export function allowedOrigin(origin: string | null): string {
  if (origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))) return origin;
  return SITE;
}

// ---- a per-person limit on lookups, to protect the Tavily credits ----
// Best effort: it lives in one running copy of the function, so a cold start resets it. A firm
// limit would need a database table (a migration, so Miah's decision).
export const LOOKUPS_PER_WINDOW = 20;
export const WINDOW_MS = 60 * 60 * 1000;

export class LookupLimiter {
  private calls = new Map<string, number[]>();
  constructor(private limit = LOOKUPS_PER_WINDOW, private windowMs = WINDOW_MS) {}

  // Records the lookup and returns true, or returns false when the person is over the limit.
  allow(userId: string, now: number): boolean {
    const recent = (this.calls.get(userId) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.calls.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.calls.set(userId, recent);
    if (this.calls.size > 5000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [id, times] of this.calls) {
      if (!times.some((t) => now - t < this.windowMs)) this.calls.delete(id);
    }
  }
}
