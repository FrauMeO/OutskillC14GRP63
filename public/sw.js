// Build Your Pillars service worker. Deliberately small.
// It caches ONLY the static app shell so the app opens with no signal after one good visit:
//   - hashed build files (/assets/*), manifest, icons: cache-first
//   - the static index.html (one copy, for every app route): network first (4 s), then the copy
// It NEVER caches or answers database, API or sign-in requests, non-GET requests, or other origins.
// Nothing is precached; old caches are removed when a new version activates.
// The person's own data for offline viewing lives in IndexedDB (src/lib/offlineCache.ts), not here.
//
// The rules below mirror src/lib/swRules.ts (src/lib/swRules.test.ts checks they agree).
// __BUILD_ID__ is replaced with a build timestamp by vite.config.ts when `npm run build` runs.

const VERSION = '__BUILD_ID__';
const ASSET_CACHE = 'byp-assets-' + VERSION;
const SHELL_CACHE = 'byp-shell-' + VERSION;
const SHELL_KEY = '/index.html';
const NAVIGATE_TIMEOUT_MS = 4000;

// BEGIN swRules
function classifyRequest(req, selfOrigin) {
  if (req.method !== 'GET') return 'ignore';
  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return 'ignore';
  }
  if (url.origin !== selfOrigin) return 'ignore';
  var path = url.pathname;

  if (/^\/assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2|png|jpg|webp|svg|ico)$/.test(path)) return 'asset';
  if (path === '/manifest.webmanifest' || path === '/manifest.json' || path === '/favicon.ico' || path === '/favicon.svg') return 'asset';
  if (/^\/icons\/[A-Za-z0-9_.-]+\.(png|webp|svg|ico)$/.test(path)) return 'asset';

  if (req.mode === 'navigate') {
    if (/^\/(api|auth|rest|functions|storage)(\/|$)/.test(path)) return 'ignore';
    var last = path.split('/').pop() || '';
    if (last.indexOf('.') !== -1) return 'ignore';
    return 'navigate';
  }
  return 'ignore';
}
// END swRules

self.addEventListener('install', function () {
  self.skipWaiting(); // nothing is precached
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k.indexOf('byp-') === 0 && k !== ASSET_CACHE && k !== SHELL_CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

function cacheFirst(request) {
  return caches.open(ASSET_CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        if (res.ok && res.type === 'basic') cache.put(request, res.clone());
        return res;
      });
    });
  });
}

function isHtml(res) {
  return (res.headers.get('content-type') || '').indexOf('text/html') !== -1;
}

function networkFirstShell(request) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    var network = fetch(request).then(function (res) {
      if (!res.ok || !isHtml(res)) throw new Error('not the app shell');
      cache.put(SHELL_KEY, res.clone());
      return res;
    });
    network.catch(function () {}); // a late failure after the timeout is not an error
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('slow'));
      }, NAVIGATE_TIMEOUT_MS);
    });
    return Promise.race([network, timeout]).catch(function () {
      return cache.match(SHELL_KEY).then(function (hit) {
        return hit || network; // no copy yet: keep waiting for the network
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var kind = classifyRequest(event.request, self.location.origin);
  if (kind === 'asset') event.respondWith(cacheFirst(event.request));
  else if (kind === 'navigate') event.respondWith(networkFirstShell(event.request));
  // 'ignore': do not call respondWith; the browser handles it normally.
});
