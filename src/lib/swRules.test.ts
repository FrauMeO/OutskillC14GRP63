import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyRequest, type RequestKind, type RequestLike } from './swRules';

const SELF = 'https://app.example.com';
const get = (path: string, mode?: string): RequestLike => ({ method: 'GET', url: SELF + path, mode });

// public/sw.js carries a hand-written mirror of classifyRequest between these markers.
function loadSwCopy(): (req: RequestLike, origin: string) => RequestKind {
  const src = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  const block = src.match(/\/\/ BEGIN swRules\n([\s\S]*?)\/\/ END swRules/);
  if (!block) throw new Error('swRules markers not found in public/sw.js');
  return new Function(`${block[1]}; return classifyRequest;`)();
}

const CASES: [string, RequestLike, RequestKind][] = [
  ['hashed JS asset', get('/assets/index-BtTg8VEV.js'), 'asset'],
  ['hashed CSS asset', get('/assets/index-Csh2OoEM.css'), 'asset'],
  ['hashed font', get('/assets/bricolage-grotesque-latin-500-700-AbCd1234.woff2'), 'asset'],
  ['manifest', get('/manifest.webmanifest'), 'asset'],
  ['icon', get('/icons/icon-192.png'), 'asset'],
  ['favicon', get('/favicon.svg'), 'asset'],
  ['app route navigation', get('/dashboard', 'navigate'), 'navigate'],
  ['root navigation', get('/', 'navigate'), 'navigate'],
  ['reset-password link with a code', get('/reset-password?code=abc', 'navigate'), 'navigate'],

  // Never cached or answered: the cases that protect health data and tokens.
  ['POST to our own origin', { method: 'POST', url: SELF + '/assets/index-BtTg8VEV.js' }, 'ignore'],
  ['PUT', { method: 'PUT', url: SELF + '/dashboard', mode: 'navigate' }, 'ignore'],
  ['Supabase REST (other origin)', { method: 'GET', url: 'https://gzsawayrorlcjmpssalc.supabase.co/rest/v1/habit_logs?select=*' }, 'ignore'],
  ['Supabase auth (other origin)', { method: 'GET', url: 'https://gzsawayrorlcjmpssalc.supabase.co/auth/v1/user' }, 'ignore'],
  ['Open-Meteo (other origin)', { method: 'GET', url: 'https://api.open-meteo.com/v1/forecast' }, 'ignore'],
  ['asset-looking path on another origin', { method: 'GET', url: 'https://evil.example/assets/index-BtTg8VEV.js' }, 'ignore'],
  ['/api path on our origin', get('/api/me', 'navigate'), 'ignore'],
  ['/auth path on our origin', get('/auth/callback', 'navigate'), 'ignore'],
  ['a data fetch (not navigation) to an app route', get('/dashboard'), 'ignore'],
  ['the worker itself', get('/sw.js', 'navigate'), 'ignore'],
  ['unhashed file under /assets', get('/assets/data.json'), 'ignore'],
  ['path traversal lookalike', get('/assets/../secret-12345678.js'), 'ignore'],
  ['garbage URL', { method: 'GET', url: 'not a url' }, 'ignore'],
];

describe('classifyRequest (src/lib/swRules.ts)', () => {
  it.each(CASES)('%s', (_name, req, expected) => {
    expect(classifyRequest(req, SELF)).toBe(expected);
  });
});

describe('public/sw.js mirrors swRules.ts', () => {
  const copy = loadSwCopy();
  it.each(CASES)('%s', (_name, req, expected) => {
    expect(copy(req, SELF)).toBe(expected);
  });

  it('positive control: the comparison would notice a wrong rule', () => {
    expect(copy(get('/dashboard', 'navigate'), SELF)).not.toBe('ignore');
  });
});

describe('public/sw.js never touches data requests', () => {
  const src = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
  it('never mentions Supabase or caches POST', () => {
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toMatch(/cache\.put\([^)]*POST/);
  });
  it('removes older caches on activate', () => {
    expect(src).toMatch(/caches\.delete/);
  });
});
