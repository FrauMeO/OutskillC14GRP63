# Prompt 3C report: gentle check-in and reflection

Date: 2026-09-26. Branch: `prompt-03c-reflection` (built on `prompt-04-dashboard`; not pushed).
Project: `gzsawayrorlcjmpssalc`.

## Status
Built; pending Miah's review. Wording, resources and rules as approved on 2026-09-26
(`docs/development-log.md`, sections 9 to 11).

## What was built
- Migration `0007_reflections.sql` (setting and `reflections` table) with a rolled-back test.
- `src/lib/reflection.ts`: PHQ-2 and PHQ-9 questions in standard wording; scoring (never a partial
  set); when to offer; result tiers; approved messages; resources by home country (US, CA, IN, DE,
  AE, fallback findahelpline.com).
- When the gentle check-in is offered (all must hold): setting on; **more than 10 consecutive
  days of check-ins** (mood or stress), ending today or yesterday; at least 7 of the last 14 logged
  days harder (mood 1 or 2, or stress 4 or 5); no offer in the last 14 days, counting every offer.
- `src/pages/Reflect.tsx` (`/reflect`): intro, 2 questions, then an invitation to 7 more if the
  first two total 3 or more; item 9 above 0 shows crisis resources immediately, before any total;
  results with the tier message, resources, a line of encouragement and the footer
  "This is encouragement to reflect a little more deeply today. It is not medical advice."
- Dashboard: a gentle note with "Take a moment to reflect" and "Not now" when the rules allow;
  each offer is saved so the 14-day limit counts it. Settings: on/off switch, "Reflect now", and
  "Delete my reflection history" with an inline confirmation.
- `src/lib/encouragement.ts`: Miah's lines plus five in the same voice, one per day, shown after
  saving a day, under the streak and on results (never in the crisis message).
- CLAUDE.md Product principles and `docs/development-log.md` record the purpose and every decision.

## Assumptions
1. "More than 10 sequential entries" means 11 or more consecutive calendar days with a mood or
   stress check-in, ending today or yesterday. A missed day or a habits-only day breaks the run.
2. Visiting `/reflect` directly (from Settings) also creates an offer row, so it starts the 14-day
   limit for automatic offers.
3. The first two PHQ-9 answers are carried over from the PHQ-2, and all nine are shown together.
4. Results for PHQ-2 below 3 or PHQ-9 of 6 or less show a short thank-you that still invites
   talking with a friend, without resources.
5. The UAE item-9 screen leads with 999 and 998 because 800 HOPE is open 8 am to 8 pm.

## Tests
- `npm test`: 75 pass. 21 for reflection: 7 vs 6 harder days; 11 vs 10 sequential days (control);
  gaps and habits-only days break the run; run ending yesterday vs two days ago; 13 vs 14-day
  limit; setting off; PHQ-2 at 2 vs 3; partial PHQ-9 rejected; tier edges 6/7, 10/11, 15/16;
  resources for each country and tier; unknown country fallback; item 9 at 1 with a low total;
  UAE ordering; wording rules; no "screening" in any page or message (with a control).
- Rolled-back SQL test for 0007: all expected results. `npm run build` passes.
- Browser: the dashboard correctly shows no check-in for the demo account (its check-ins are not
  sequential); `/reflect` and the Settings section render. 0 reflection rows exist.

## Open questions
1. Browser testing of the offer needs an account with 11+ consecutive check-in days. Recommended:
   a second test account seeded with a fixture, then deleted.
2. Should the encouragement lines also wait for more data, or stay visible from day one?
   Recommended: stay visible, since they are general kindness, not a response to the data.
3. Translations for India, the UAE and Germany (interface is English only).
