# Prompt 3: Daily check-in, weather with insights, gentle check-in (revised for Claude Code, 2026-09-25)

Revised from Miah's Prompt 3 text to match this repository. It replaces the older Prompt 3
in `docs/handover.md` (the Bolt-era text with steps, multiple feelings and "biometrics").
Changes from Miah's text are listed at the end.

You are working on Personal Health Manager in `~/Projects/OutskillC14GRP63`. Read
`CLAUDE.md`, `docs/handover.md` and `docs/schema-log.md` first. Follow the Schema
evolution policy in CLAUDE.md exactly as written.

## Facts about the current state (verify, do not assume)

- Supabase project: PersonalHealthManager, ref `gzsawayrorlcjmpssalc` (organization
  OlmstedDataPlayground). Only data: the demo account `msolmsted+demo@gmail.com` and its
  59 sample days (2026-07-26 to 2026-09-23). Migrations 0001 to 0003 are applied.
- `habit_logs`: one row per user per day (`unique (user_id, log_date)`), columns
  `exercise_minutes`, `sleep_hours`, `water_liters`, `notes`. RLS on, user_id defaults
  to `auth.uid()`.
- `profiles`: `id`, `full_name`, `created_at`. The `handle_new_user` trigger copies
  `full_name` from sign-up metadata (`AuthPage.tsx` sends it in `options.data`).
- `LogHabits.tsx` is a placeholder. There is no form yet for exercise, sleep or water.
- The sample generator is deterministic (seed 20260924) and already models Philadelphia
  (-0400) with a Seattle trip on day indexes 25 to 34 (2026-08-20 to 2026-08-29, -0700).
- There is no unit-test runner and no linter. Checks today: `npm run build` (type check
  and build) and `npm run test:import` (pipeline, with a positive control).

## How to run

Build in three stages, each on its own branch from `main`, each ending with a checkpoint
where you stop and report before the next stage starts. Commit after each part. Never
push or deploy; Miah pushes after review.

- **3A** `prompt-03a-checkin`: Log Habits form, check-in ratings, location, weather cache,
  sample data.
- **3B** `prompt-03b-insights`: the statistics engine and Insights page.
- **3C** `prompt-03c-gentle-checkin`: the gentle check-in and PHQ screening.

Within each stage, first show the migration SQL and affected row counts and wait for
approval (Schema evolution policy, rule 5). After approval, work through the stage
without stopping except for the hard stops. Record assumptions in the stage report.

Allowed new dependencies: `vitest` (dev). Allowed external services: Open-Meteo
Geocoding, Forecast, Historical Weather and Air Quality APIs (free, no key, no account),
plus BigDataCloud's free client reverse-geocoding endpoint
(`https://api.bigdatacloud.net/data/reverse-geocode-client`, no key). Nothing else.

---

## Stage 3A. Log Habits, check-in, location and weather

### 3A.1 Log Habits form
- Date field, defaulting to today in local time (`toISODate()`), editable.
- Exercise minutes, sleep hours, water liters, notes, and the three check-in ratings.
- Save upserts on `(user_id, log_date)`. Opening a date that already has a row loads it
  for editing. Blank fields save as null, never 0.
- Below the form, the last 7 days with a check mark on days that have a row.
- Three 1 to 5 ratings, one tap each, with visible text labels (not colour or face
  alone): Mood (very sad to very happy, 5 faces), Energy (very low to very high), Stress
  (very low to very high). Each can be cleared.
- Feelings: an optional multi-select of six Apple Health State of Mind labels (frustrated,
  overwhelmed, calm, peaceful, confident, grateful; migration 0005), each with a face and a
  text label. Any number can be selected, including none.

### 3A.2 Location
- Sign-up asks for home city. Geocode it with the Open-Meteo Geocoding API and let the
  user pick from the matches. Save city name, country code, and coordinates rounded to
  0.1 degree in sign-up metadata; extend `handle_new_user` (in the new migration, with
  `create or replace`) to copy them into new `profiles` columns.
- Settings lets any user set or change home city. The demo account has none yet, so
  Log Habits prompts for it once, without blocking the save.
- When saving a log, request device location. If granted, round to 0.1 degree and
  reverse-geocode to a city name with BigDataCloud (send only the rounded coordinates). If
  declined, unavailable or slow (5 second limit), use the home city. Never block saving.
- Store on each `habit_logs` row: `location_name`, `latitude`, `longitude` (rounded to
  0.1), and `location_source` (`device` or `home`).

### 3A.3 Outside factors cache (`daily_conditions`)
- New table, one row per user per date, unique `(user_id, date)`, with the rounded
  location it was fetched for, RLS limiting each user to their own rows, and user_id
  defaulting to `auth.uid()`.
- Columns: precipitation, rain, snowfall (mm); relative humidity mean (%); surface
  pressure mean (hPa); temperature min and max, apparent temperature max (°C); UV index
  max; daylight and sunshine duration (hours); US AQI max; PM2.5 mean (µg/m³, the smoke
  signal); pollen (null outside Europe); moon illumination (0 to 1) and moon phase name,
  calculated from the date in code; `is_final` (boolean); `fetched_at`.
- Past dates use the Historical Weather API and are final. Today uses the Forecast API
  and is stored with `is_final = false`. Fetch at most once per user, date and location.
  The only refetch allowed is replacing a non-final row once its date has passed.
  Never fetch on page load.
- Where Open-Meteo gives a variable only hourly, compute the daily value in code and
  document how.
- Insights and any UI show "Not available in your area" for null pollen.

### 3A.4 Migration
One additive migration, `0004_checkin_location_conditions.sql`: mood, energy, stress
(`smallint`, nullable, check 1 to 5), `feelings` (`text[]`, nullable, every element one
of the five allowed values, no duplicates) and the location columns on `habit_logs`; home city
columns on `profiles`; the `daily_conditions` table with RLS and policies; the updated
`handle_new_user`. Backfill the 59 sample rows with their location (Philadelphia, or
Seattle for 2026-08-20 to 2026-08-29), `location_source = 'home'`. Update
`database.types.ts` (regenerate with the connector) and `docs/schema-log.md`.

### 3A.5 Sample data
- Apple Health has no mood, energy, stress or feelings. Generate them in a separate file,
  `sample-data/checkins.csv`, from the same seed, instead of faking Apple Health records.
- Fetch real historical Open-Meteo data for each sample date at the matching city and
  commit it as a fixture, `sample-data/conditions.json`, so tests run offline and give the
  same result every time.
- Plant one pattern: mood about 1 point lower on days with rain over 2 mm (using the
  fixture). Plant nothing for moon phase.
- Extend the importer and seed so one seed file loads logs, check-ins, locations and
  conditions for the demo account. Extend `verify-import.mjs` to check every new field,
  with a positive control that must be CAUGHT.
- Reseed the demo account and confirm the counts.

### 3A.6 Tests and checkpoint
- Add `vitest` and `npm test`. Unit-test the form's pure helpers (blank to null, date
  handling, location fallback order) with a positive control in each file.
- Rolled-back SQL test: RLS isolation on `habit_logs` new columns and on
  `daily_conditions` (user B sees 0 of A's rows; A's own row visible as the control),
  the 1 to 5 checks, and the feelings allowed-values check (an unknown feeling blocked).
- Run `npm test`, `npm run test:import`, `npm run build`, and the security advisor
  (0 findings). Log in as the demo account and save a day in the browser.
- Write `docs/reports/prompt-03a.md` and stop.

---

## Stage 3B. Insights

### 3B.1 Engine (pure functions in `src/lib/insights/`)
- Measures: exercise minutes, sleep hours, water, mood, energy, stress.
- Continuous factors: Spearman rank correlation, p-value from the t approximation.
  Moon uses illumination (0 to 1).
- Yes/no factors: rainy day (rain over 2 mm), snow day, high UV (6 or more), poor air
  (US AQI over 100). Mann-Whitney U with the normal approximation and tie correction.
- Pairs use only days where both values exist. Report the number of days with each
  result.
- Likely pattern: Benjamini-Hochberg adjusted p at or below 0.10 across every
  comparison, at least 21 paired days, and effect size at least |rho| 0.3 or
  rank-biserial |r| 0.3.
- Worth exploring: unadjusted p below 0.05, effect size met, not Likely. Label: "Early
  hint. This may disappear as you log more days."
- Correlated factors (rain, precipitation, humidity) may all qualify; that is expected.
  Group them visually rather than hiding them.

### 3B.2 Insights page
- New route `/insights` and sidebar entry. Fewer than 14 logged days: show progress
  ("9 of 14 days logged") and nothing else.
- Sentences describe association, never cause, and include the day count and both group
  values, for example: "On rainy days your mood averaged 2.8, compared with 3.6 on dry
  days (31 days)." Never "rain lowers your mood."
- Show the Open-Meteo attribution and "non-commercial use" note.

### 3B.3 Tests and checkpoint
- Unit tests for Spearman, Mann-Whitney, BH and the effect-size rule against known
  textbook values (these are the positive controls).
- On the sample data: the planted rain and mood pattern must be Likely; moon must not be
  Likely.
- False-positive check: shuffle mood 200 times with a fixed seed and run the engine each
  time. Report how often any comparison reaches Likely; it must be at or below 10%.
- Run all checks from 3A plus the new tests. Write `docs/reports/prompt-03b.md` and stop.

---

## Stage 3C. Gentle check-in and reflection

> Updated 2026-09-26: the final wording, country resources, thresholds and naming for this stage
> are in `docs/development-log.md` (section 9) and override anything below that differs. In
> the interface, never say "screening"; the table is `reflections`, migration `0007`.

- Setting on the Settings page, on by default, stored in `profiles`.
- Trigger: among the last 14 logged days, at least 7 have mood 1 or 2, or stress 4 or 5.
  Offer no more than once per 14 days, counting from the last offer, whether or not it
  was accepted.
- Show a warm, calm note and an optional screening the user can skip.
- PHQ-2 first. If its score is 3 or higher, offer the full PHQ-9: all 9 items, standard
  wording and response options, scored 0 to 27. Never a partial set.
- PHQ-9 support tiers (Miah, 2026-09-25; a cautious early warning, deliberately below the
  standard "moderate" cut-off of 10), using resources for the country of the user's home city:
  - Total above 6 (7 to 10): share one support resource.
  - Total above 10 (11 to 15): share a different support resource.
  - Total above 15 (16 to 27): share 988 (call or text, US and Canada; elsewhere
    findahelpline.com) and two support resources, with a gentle suggestion to call their
    doctor.
  The exact resources are chosen at the 3C checkpoint.
- PHQ-9 item 9 above 0: show crisis resources immediately, before any total, whatever the
  total score.
- Label every screen "A screening tool, not a diagnosis."
- New table `screenings`: date, instrument (`phq2` or `phq9`), total score, item 9 score
  (phq9 only), and the date the check-in was offered. No free text. RLS on, user can
  select and delete their own rows only. Settings has "Delete my screening history".
- Migration `0006_screenings.sql` under the same approval rule (0005 was used for the feelings labels).
- Tests with fixed fixtures: trigger fires at exactly 7 of 14 and not at 6 (control);
  the 14-day limit; PHQ-2 at 2 vs 3; PHQ-9 totals 6, 7, 10, 11, 15 and 16 (each tier edge); item 9 at 1 with a low total.
  RLS test on `screenings`. Run every earlier check. Write `docs/reports/prompt-03c.md`.

---

## Hard stops (any stage)

Stop, write the stage report with status "stopped", and commit if:
- The linked project is not `gzsawayrorlcjmpssalc`, or it holds any account other than
  the demo account.
- A change would delete auth users or data the seed file cannot recreate.
- `.env.local` or the Supabase connector is missing or points elsewhere.
- The same test still fails after three separate fix attempts.
- The planted rain pattern is not found as Likely, or moon appears as Likely, after
  checking the engine for bugs. Report it rather than tuning thresholds until it passes.
- The work needs a paid service, an API key, a new account, or a dependency not listed
  above.

Never touch any project in FacilityRecordsHolding. Never change Supabase settings or
billing.

## Changes from Miah's text

1. Adds the Log Habits form for exercise, sleep, water and notes, which the page needs
   and no prompt had built yet.
2. Splits the work into three stages with a checkpoint after each, because it touches
   two migrations, a new external service, statistics and mental-health screening.
3. Names a reverse-geocoding step: Open-Meteo can find coordinates for a city name but
   cannot turn device coordinates back into a city name.
4. Saves home city through sign-up metadata and the existing profile trigger, and lets
   existing users (the demo account) set it in Settings.
5. Adds `is_final` so today's forecast can be replaced once by the final values; the
   original "never refetch" would keep forecast numbers forever.
6. Puts sample mood, energy and stress in their own file, because Apple Health export
   has no such records, and commits the fetched weather as a fixture so tests are
   repeatable offline.
7. Makes the statistics concrete (tests, thresholds, the yes/no factors) and adds a
   200-run shuffle test, because one negative control (moon) cannot prove the guard
   works on its own.
8. Adds precise trigger and cooldown rules, a no-free-text storage rule and a delete
   option for screenings, and resources outside the US and Canada.
9. Adds `vitest`, since no test runner exists, and lists the allowed services and
   dependencies.
10. Keeps `exercise_minutes`, the existing schema rules, and the old Prompt 3's multiple
    feelings (Miah's choice) alongside the three ratings. Steps move to Prompt 4.
11. Names BigDataCloud for turning device coordinates into a city name (Miah's choice).
