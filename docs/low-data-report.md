# Low-data and weak-signal report (2026-10-12)

Goal (Miah): the app should run on cellular bandwidth alone, on small data plans and with weak or no signal, for elderly users in particular.

Measured with `npm run build` then `node scripts/measure-bundle.mjs` (gzip level 9, from the Vite manifest; fonts are already compressed). The script exits non-zero if a budget is exceeded.

## Before (single bundle, Google Fonts)

| Item | gzip |
|---|---|
| index.html | 0.5 KB |
| CSS | 5.8 KB |
| JS (one 973 KB file: React, router, Supabase, recharts, every page) | 285.1 KB |
| Google Fonts CSS (fonts.googleapis.com) | 0.7 KB |
| Bricolage Grotesque Latin woff2 (fonts.gstatic.com) | 76.9 KB |
| Public Sans Latin woff2 (fonts.gstatic.com) | 26.6 KB |
| **Signed-out landing, and also the first Dashboard load** | **about 395 KB** |

There were no images in public/ in this branch (no `public/` folder existed), so no icon was loading on the landing page. Third parties contacted on first load: Google (fonts), which the GDPR audit flagged.

## After

| Item | gzip |
|---|---|
| Signed-out landing page (`/`): html 0.5, CSS 6.1, entry JS 10.7, React 69.0, router 14.3, Supabase 35.3, font 11.3 | **143.6 KB** (budget 150) |
| Signed-in first Dashboard load: landing plus Dashboard chunk 6.7, weather/reflection helpers about 6.6 | **156.9 KB** (budget 250) |

Brotli (what Vercel serves to modern browsers) is smaller still: 125.8 KB and 137.5 KB. Pages the visitor has not opened (Insights, Goals, Settings, Log habits, Reflect, password pages) are separate chunks of 1 to 8 KB each and download only when opened. Verified in the browser: the landing page requested exactly index.html, one CSS, four JS chunks and one font, and nothing from another origin.

What changed, and why each saves data:

1. **Route-level code splitting** (`React.lazy`, one `Suspense` per page so the menu stays put). The skeleton stays invisible for 250 ms, so there is no flash on a fast connection and no spinner.
2. **Vendor chunks** (React, router, Supabase) with stable hashes, so they are cached across deploys.
3. **recharts removed from the code** (107 KB gzip for seven-point line charts). `TrendChart.tsx` is now plain SVG with the same behaviour: a toggle per card, a dashed goal line, gaps (never zeros) for missing days, a text list for screen readers. Scale and gap logic is in `src/lib/chartScale.ts` with tests. `recharts` and `react-is` are still listed in package.json (I did not touch it, another agent is editing it); nothing imports them any more, so they can be removed with `npm uninstall recharts react-is`.
4. **Supabase trimmed by about 24 KB gzip**: `@supabase/realtime-js` and `@supabase/storage-js` are aliased (vite.config.ts) to tiny stand-ins in `src/lib/stubs/`, because the app uses neither. `src/lib/supabaseStubs.test.ts` runs the real supabase-js against the stand-ins, so a future upgrade that needs more fails the test. To use realtime or storage later, delete the two aliases.
5. **Fonts**: Google Fonts links removed (no third-party request). Body text uses the device's own font (no download). Display headings use one self-hosted font, Bricolage Grotesque Bold, Latin subset, 11 KB (`src/assets/fonts/`, SIL OFL 1.1, which allows this). No dependency was added. Every `font-display` heading in the app is bold, which is why only weight 700 is shipped. Public Sans was dropped from the page, so body text now looks like the phone's own font (San Francisco, Roboto, Segoe UI). Tell me if you want Public Sans back (about 27 KB more).

## Data saver mode

`src/lib/dataSaver.ts`: `shouldSaveData(connection, setting)` is a pure function. The setting is stored in localStorage `byp.dataSaver` as `on`, `off` or `auto` (default `auto`). On auto it is on when the browser's Data Saver flag is set or the connection is `slow-2g`, `2g` or `3g`. Browsers that do not report the connection (Safari, Firefox) are treated as not slow.

When on:
- Dashboard weather is not fetched. It shows "Weather skipped to save data. Tap to load it." and loads on tap.
- The AI reflection is never written automatically, even if the Settings option is on; it is written only on tap, with the note "Writing a reflection uses a little data."
- Saving a day skips the weather lookup and the city-name lookup (the latter is a request to a third-party service). The message says "Weather skipped to save data."
- The app has no pre-fetching or auto-refresh, so there was nothing else to switch off.

Not gated: the 365-day rhythm query on the Dashboard (small, text only) and the gentle check-in reads.

Mount `DataSaverSetting` (`src/components/DataSaverSetting.tsx`) anywhere in Settings.

## Offline-first logging

- Saving a day with no connection, or when the request fails like a weak signal, keeps the entry on the device and says "Saved on this device. It will upload when you are back online." Errors where the server said no (validation, permissions) still show as before.
- `src/lib/offlineQueue.ts` plus `src/lib/idb.ts` (raw IndexedDB behind a tiny promise helper, no dependency): one pending entry per `log_date`, latest write wins. `flushQueue` sends all pending days in one batched upsert, retries network and 5xx failures with exponential backoff and jitter (at most 5 tries per flush), and removes only the days the server confirmed and that were not rewritten while the request was in flight. If the server rejects the batch, days are tried one at a time so one bad day cannot block the others; a rejected day stays on the device.
- Flush runs at app start, on sign-in, on the browser's `online` event, and from an "Upload now" button. After a failed flush it retries after 1, 2, 4 ... up to 15 minutes, and stops for days the server rejected (`src/lib/offlineSync.ts`).
- "N days waiting to upload" pill (`src/components/PendingUploadPill.tsx`). It is mounted in `src/main.tsx` as a fixed note at the bottom of the screen, so it already shows on every page. Move it into AppLayout if you prefer.
- Read-only cache: every successful Dashboard load replaces one cached snapshot (`src/lib/offlineCache.ts`): the person's name, goals, the last 7 days in full and the last 30 days of the category fields that feed the weekly rhythm. With no signal the Dashboard shows that snapshot (plus any days waiting to upload) with the note "You are offline. This is the view saved on this device on ...". When the browser reports offline it goes straight to the snapshot; on a weak connection that is not reported as offline, Supabase retries reads (about 7 seconds) before the snapshot appears.

### Privacy of the on-device data

This is health data on a device that may be shared or lost, so:
- Only what the person logged themselves is stored: their own `habit_logs` upserts, their goals, first name and recent logs. Nothing from the Following pages or any shared data is ever queued or cached.
- Each pending entry records its owner. It is uploaded only while that same person is signed in, and the cache is shown only to the person it belongs to (another person's leftovers are deleted).
- A response containing any row with a different `user_id` is not cached at all. Cached rows have `user_id` and `id` removed.
- Queue and cache are cleared on sign-out (the Supabase `SIGNED_OUT` event, handled in `offlineSync.ts`). A forced sign-out, such as an expired refresh token, also clears them, so an entry that never uploaded is lost in that case.
- Account deletion: there is no deletion flow in this branch. Whatever flow is added should call `clearOfflineData()` from `src/lib/offlineSync.ts` (it also ends in a sign-out, which clears the data anyway).
- Data lives in IndexedDB database `byp-offline`, and is not encrypted at rest beyond the device's own protection.
- The service worker never holds any of this (see below).

## Service worker (`public/sw.js`)

- Caches only same-origin GET requests for hashed `/assets/*`, the manifest, favicon and `/icons/*` (cache-first), plus one copy of the static `index.html` as the app shell (network first with a 4 second wait, then the copy). The shell is the same file for every route and holds no data; this is what lets the app open with no signal. Nothing is precached.
- Never touched: any other origin (Supabase, Open-Meteo), non-GET requests, `/api`, `/auth`, `/rest`, `/functions`, `/storage`.
- The build stamps a version into the cache names (`vite.config.ts`), and old caches are deleted when a new worker activates.
- The rules are in `src/lib/swRules.ts`. `sw.js` cannot import it, so it carries a mirror between `BEGIN swRules` and `END swRules`; `swRules.test.ts` runs the same 24 cases through both copies and fails if they disagree.
- Registered only in production builds on http(s) (`src/main.tsx`).

## Verification

Done:
- `npm test` (225 tests, including control cases) and `npm run build` pass.
- Production build against a local mock of the Supabase REST API (nothing from production was touched): the landing page requests only our own files plus the 11 KB font; the Dashboard saved its cache; with the mock stopped the Dashboard opened from the cache with the offline note; logging a day then showed "Saved on this device..." and the pill; with the mock back, "Upload now" sent one batched request for the day, emptied the queue and hid the pill; signing out emptied both the queue and the cache.

Not done:
- Service worker in a real browser: the embedded browser I had does not allow service workers, so offline app-shell loading is covered only by the unit tests of the rules and by reading the code. Please test once in Chrome: load the deployed site, switch DevTools to Offline, reload.
- The flush against the real Supabase (not run on purpose, to avoid writing to production data). The batched upsert uses the same `onConflict: 'user_id,log_date'` as the existing single-day save, and the stand-in test confirms the real client builds it.
- Real throttled-network timing; `navigator.onLine` was never actually false in my browser, so the instant offline path is by code only.
- Insights and Reflect pages are not available offline (not cached).
