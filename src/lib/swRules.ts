// What the service worker (public/sw.js) may cache. The worker cannot import this file, so sw.js
// carries a hand-written mirror of classifyRequest between the "BEGIN swRules" and "END swRules"
// markers. swRules.test.ts runs the same cases through both copies and fails if they disagree.
//
// The rules, in order:
//  1. Only GET. Never POST, PUT, PATCH, DELETE.
//  2. Only our own origin. Supabase (auth, REST, functions), Open-Meteo and everything else is
//     never touched: health data and tokens never enter a cache.
//  3. 'asset': the hashed build files under /assets/ (cache-first, safe forever because the name
//     changes when the content does), the manifest, favicon and icons.
//  4. 'navigate': a page navigation to an app route. The reply is the same static index.html for every
//     route (the app loads its data afterwards, through requests the worker ignores), so one copy is
//     kept as the offline app shell. Never anything under /api, /auth, /rest, /functions.
//  5. Everything else: 'ignore' (the worker does not respond; the browser fetches as usual).

export type RequestKind = 'asset' | 'navigate' | 'ignore';

export type RequestLike = { method: string; url: string; mode?: string };

export function classifyRequest(req: RequestLike, selfOrigin: string): RequestKind {
  if (req.method !== 'GET') return 'ignore';
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return 'ignore';
  }
  if (url.origin !== selfOrigin) return 'ignore';
  const path = url.pathname;

  if (/^\/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2|png|jpg|webp|svg|ico)$/.test(path)) return 'asset';
  if (path === '/manifest.webmanifest' || path === '/manifest.json' || path === '/favicon.ico' || path === '/favicon.svg') return 'asset';
  if (/^\/icons\/[A-Za-z0-9_.-]+\.(png|webp|svg|ico)$/.test(path)) return 'asset';

  if (req.mode === 'navigate') {
    if (/^\/(api|auth|rest|functions|storage)(\/|$)/.test(path)) return 'ignore';
    const last = path.split('/').pop() ?? '';
    if (last.includes('.')) return 'ignore'; // a file (sw.js, robots.txt), not an app route
    return 'navigate';
  }
  return 'ignore';
}
