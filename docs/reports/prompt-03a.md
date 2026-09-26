# Prompt 3A report: Log Habits, check-in, location, weather, sample data

Date: 2026-09-25. Branch: `prompt-03a-checkin` (not pushed). Project: `gzsawayrorlcjmpssalc`.

## Status
Done, pending Miah's browser check of the sample data (stage checkpoint).

## Migrations applied
- `0004_checkin_location_conditions.sql`: check-in ratings, feelings, location on `habit_logs`; home city on `profiles`; `daily_conditions` with RLS; home city in the sign-up trigger.
- `0005_feelings_apple_labels.sql`: feelings are six Apple Health State of Mind labels (frustrated, overwhelmed, calm, peaceful, confident, grateful), replacing the 0004 list. 0 rows affected.

## What was built
- Log Habits form (`src/pages/LogHabits.tsx`): date, Mood/Energy/Stress (1 to 5, words and faces), feelings, exercise, sleep, water, notes; upsert per day; last-7-days row.
- Location (`src/lib/location.ts`, `src/components/CityPicker.tsx`): device location only when logging today, reverse-geocoded with BigDataCloud; otherwise the day's saved location, then home city; never blocks saving. Home city at sign-up, in Settings, or from a banner on Log Habits.
- Weather cache (`src/lib/conditionsCore.ts`, `src/lib/conditions.ts`): fetched once per day and place after a save; today is stored as not final and replaced once after the day ends.
- Sample data: `scripts/fetch-sample-conditions.mjs` (real Open-Meteo data saved as `sample-data/conditions.json`), `scripts/generate-sample-checkins.mjs` (`sample-data/checkins.csv`), `scripts/build-demo-seed.mjs` (one seed, `sample-data/seed_habit_logs.sql`), `scripts/verify-seed.mjs`. The importer now writes only `habit_logs.csv`.

## Assumptions and changes from the revised prompt
1. Weather comes from Open-Meteo's Historical Forecast API for every date, not the ERA5 Historical Weather API: ERA5 has no UV index and lags several days. One source keeps days comparable.
2. Sample locations are set by the seed, not by the migration, because a migration applies to every user.
3. Feeling labels changed twice at Miah's request (synonyms, then Apple labels), which added migration 0005.
4. Planted pattern: raw mood is 1 point lower on days with more than 2 mm of rain; after rounding to whole numbers the sample shows 2.75 on 12 rainy days vs 3.81 on 43 dry days. Mood noise was widened from 0.5 to 0.75 so moods use the 2 to 5 range; this was set before any statistics exist and was not tuned against an engine.
5. The demo account's own entry for 2026-09-25 was kept; the seed only touches sample dates.

## Tests
- `npm test`: 27 unit tests pass (form rules, location fallback, moon, weather conversion, cache rules, date splitting). Control: a deliberately wrong expectation failed, then was restored.
- `npm run test:import`: importer PASS (59 days, control CAUGHT); seed PASS against its three sources (control CAUGHT); planted pattern present.
- `supabase/tests/checkin_test_after_0004.sql` and `feelings_test_after_0005.sql` (rolled back): all expected results, including RLS isolation on `daily_conditions` and check-ins.
- Database after seeding: 60 logs, 56 check-ins, 60 with location, 60 condition rows; rainy vs dry mood 2.75 vs 3.81, matching the seed.
- `npm run build`: passes (the known 500 kB chunk warning remains).
- Security advisor: only "Leaked password protection disabled" (an Auth setting, not schema).
- Browser: Miah saved today's entry; row, device location and weather row confirmed in the database.

## Open questions
1. Turn on leaked password protection (Authentication > Attack Protection)? Recommended: yes.
2. Keep the PHQ-9 support threshold at "above 6" for 3C, or use the standard 10? Recommended: decide before 3C.
