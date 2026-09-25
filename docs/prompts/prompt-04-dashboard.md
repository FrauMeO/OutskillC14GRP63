# Prompt 4: Dashboard with progress tracking (revised for Claude Code, 2026-09-25)

Revised from `prompt-04-dashboard_1.md` to match this repository and session. Changes from
the original are listed at the end.

You are working on Personal Health Manager in `~/Projects/OutskillC14GRP63`. Read
`CLAUDE.md`, `docs/handover.md` and `docs/schema-log.md` before anything else. CLAUDE.md
already contains the approved **Schema evolution policy**. Follow it as written and do not
replace or reword it.

## Facts about the current state (verify, do not assume)

- Supabase project: PersonalHealthManager, ref `gzsawayrorlcjmpssalc`, organization
  OlmstedDataPlayground. The only data is one demo account (`msolmsted+demo@gmail.com`)
  and its 59 days of sample `habit_logs` (2026-07-26 to 2026-09-23). Supabase labels
  every project's default branch "PRODUCTION"; that label alone is not a stop signal.
- Migrations: 0001 to 0003 now, plus 0004 and 0005 from Prompt 3. The live migration
  history does not list 0001 and 0002 (run by hand); the schema itself matches.
- `habit_logs` holds one row per user per day (`unique (user_id, log_date)`), with
  `exercise_minutes`, `sleep_hours`, `water_liters`, `notes`.
- `goals` allows only `exercise`, `sleep`, `water`, one per type, with ranges in 0002.
  `src/lib/goals.ts` is the single source of truth for goal types.
- The sample Apple Health export contains steps, sleep stages including InBed and Awake,
  exercise time, water and heart rate. It has **no** stand time, active energy or dietary
  energy, and no mood (Apple Health has none).
- Prompt 3 (the Log Habits form) must be built and merged before this prompt runs. It
  adds `mood`, `energy` and `stress` (1 to 5), `feelings` (list), location columns,
  `daily_conditions`, and the Log Habits form that writes them. Confirm those columns exist before starting; if they do
  not, stop.
- There is no unit-test runner and no linter. Type checking is `tsc -b` inside
  `npm run build`. The data pipeline test is `npm run test:import`.
- Local dates come from `toISODate()` and `lastNDays()` in `src/lib/dates.ts`.
- Habit colours are tokens in `src/index.css` (`ember` exercise, `dusk` sleep,
  `current` water).

## How to run

- Work on a new branch `prompt-04-dashboard`. Commit after each part. Do not push and do
  not deploy; Miah pushes after review.
- **Checkpoint:** after Part 1, stop and show the schema plan (new columns, goal types,
  migration SQL, affected row counts). Wait for approval before applying any migration.
  After approval, run the remaining parts without stopping, except for the hard stops.
- When a choice is unclear after the checkpoint, pick the option most consistent with the
  existing code, record it as an assumption, and keep going.

## Part 1. Plan the schema (then stop for approval)

1. Read the live schema (`list_tables`, `list_migrations`) and compare it with the files.
2. Propose one additive migration, `0006_dashboard_metrics.sql`, that keeps one row per
   day and adds nullable columns to `habit_logs`:
   - Exercise: `steps int`, `stand_hours numeric`, `active_calories int`
   - Sleep: `time_in_bed_hours numeric`, `awake_minutes int`
   - Nutrition: `calories_consumed int` (water stays `water_liters`)
   - `source text not null default 'manual' check (source in ('apple_health', 'manual'))`
   Keep `exercise_minutes`, `sleep_hours`, `notes`, and the check-in and location columns
   from Prompt 3 (do not add them again). Add steps to the Log Habits form. Add sensible non-negative checks.
   Backfill existing sample rows with `source = 'apple_health'`.
3. Widen the goals rules to cover the new goal-tracked metrics (steps, stand hours,
   active calories, calories consumed), keeping exercise minutes, sleep hours and water.
   Replace the 0002 check constraints with wider ones in the same migration and say so
   plainly (currently 0 goal rows, so no data is affected). Keep one goal per type.
4. Plan the matching changes: `database.types.ts` (regenerate with the connector),
   `goals.ts`, the Goals page dropdown, new colour tokens for Nutrition and Wellbeing,
   and the importer, generator and verifier.

## Part 2. Data pipeline

1. Extend `scripts/generate-sample-export.mjs` to add realistic stand time, active energy
   and dietary energy records, and add an option to end the 60 days on a given date
   (default: yesterday in local time) so the dashboard has recent data.
2. Extend `scripts/import-apple-health.mjs` to map steps, stand hours, active calories,
   calories consumed, time in bed and awake minutes, set `source = 'apple_health'`, and
   keep the existing sleep rules and the null-not-zero rule.
3. Extend `scripts/verify-import.mjs` to check every new field, with a positive control
   that must be CAUGHT. `npm run test:import` must pass.
4. After the migration, reseed the demo account and confirm the row count and per-field
   day counts match the verifier.

## Part 3. Build the Dashboard

### 3.1 Cards (five)

| Card | Metrics | Indicator |
|---|---|---|
| Exercise | exercise minutes, steps, stand hours, active calories | progress per metric vs. goal |
| Sleep | hours slept, time in bed, minutes awake in bed | progress for hours slept; other two as values |
| Nutrition | water, calories consumed, net calories (consumed minus active calories) | progress for water and calories consumed; net as a value |
| Wellbeing | today's mood, energy and stress (1 to 5) and selected feelings | each rating with its label, the mood face and the feelings, no progress |
| Notes | today's note | preview, or an "Add a note" link to Log Habits |

Indicator rules:
- Show today's value, the goal and the percentage as text as well as graphically.
  Colour is never the only signal.
- Ring when that day's row has `source = 'apple_health'`, horizontal bar when `manual`.
- Over 100 percent shows the real percentage, with the graphic capped at full.
- No goal set: show the value and a "Set a goal" link to the Goals page.
- No value today: show "Not logged", never 0.

### 3.2 Seven-day trends
- One recharts line chart per goal-tracked card (Exercise, Sleep, Nutrition, Wellbeing),
  each with a small toggle between that card's metrics.
- Goal as a dashed reference line. Missing days are gaps, not zero.
- Install `recharts` and `react-is` (the handover notes recharts 3 needs `react-is` with
  React 19).

### 3.3 Logging streak
- Consecutive local days, ending today or yesterday, where Exercise, Sleep, Nutrition and
  Wellbeing each have at least one non-null value (Wellbeing: mood, energy or stress). Notes do not count. Goals do not need
  to be met.
- If today is not fully logged, count through yesterday and say which categories are
  still missing today.
- Use a separate query that fetches only `log_date` and the needed columns for up to 365
  days.

### 3.4 Data and states
- Fetch `goals` and the last 7 days of `habit_logs` with the existing client in
  `src/lib/supabase.ts`; compute everything client-side in pure functions under
  `src/lib/` so they can be unit tested.
- Days follow the device's local calendar via `src/lib/dates.ts`.
- Loading skeletons, a friendly empty state for a user with no logs, and an error message
  with a Retry button.

### 3.5 Layout and accessibility
- Streak at the top. Mobile: one column in the order Exercise, Sleep, Nutrition,
  Wellbeing, Notes, then charts. Tablet: two columns. Desktop: card grid above charts.
- Touch targets at least 44px, visible focus rings, reduced motion respected, errors with
  `role="alert"`, confirmations with `role="status"`, as in CLAUDE.md.

## Part 4. Test

1. Use the `vitest` setup from Prompt 3. Unit-test the pure
   functions: daily values, local-date boundaries, ring vs. bar by source, percentage over
   100, null vs. zero, the streak (longer than 7 days, broken, today incomplete), and the
   empty state. Each test file includes a positive control.
2. Run a rolled-back SQL test for the 0006 constraints (valid row saved as control;
   negative values and unknown source blocked; RLS still isolates
   users).
3. With the dev server running, log in as the demo account and compare every card value
   with a direct SQL query of today's row.
4. Run `npm test`, `npm run test:import`, `npm run build` and the Supabase security
   advisor. All must pass with 0 advisor findings. No linter exists; do not add one.

## Part 5. Report

Write `docs/reports/prompt-04.md`: status, files changed, migrations applied, earlier code
changed because of the schema and why, assumptions, test results, and open questions with
a recommended answer for each. Update `docs/schema-log.md` and `docs/handover.md`.

## Hard stops

Stop, write the report with status "stopped", and commit if:
- The linked project is anything other than `gzsawayrorlcjmpssalc`, or it holds data from
  any account other than the demo account.
- A change would delete auth users or data that the seed file cannot recreate.
- `.env.local` or the Supabase connector is missing or points elsewhere.
- The same test still fails after three separate fix attempts.
- The work needs a paid service, a new account, or a new dependency other than
  `recharts` and `react-is` (`vitest` is already added by Prompt 3).

Never touch any project in FacilityRecordsHolding. Never change Supabase settings or
billing. Never push or deploy.

## Changes from the original

1. Keeps the existing CLAUDE.md schema policy instead of adding a conflicting one; its
   approval rule is honoured through the Part 1 checkpoint.
2. States the real project, data, migrations and file names instead of asking the run to
   discover them.
3. Keeps one row per day, so the "more than one log per metric per day" rule is removed.
4. Keeps exercise minutes on the Exercise card; it is the only existing exercise goal.
5. Makes `source` a concrete column and defines the ring vs. bar rule by it.
6. Adds the generator, importer and verifier work the new metrics require, plus a
   recent-date option so "today" has data.
7. Runs after Prompt 3, which owns the check-in columns (mood, energy, stress, feelings)
   and the form that fills them; steps are added here. Mood is logged by hand in the form; Apple Health has none.
8. Allows `react-is`, uses Prompt 3's `vitest`, and removes the linter step because none exists.
9. Replaces "looks like production" with a concrete project and data check.
10. Replaces the data-dump backup with the policy's row-count-and-approval rule; the only
    data is sample data the seed file recreates.
