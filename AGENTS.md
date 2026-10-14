# AGENTS.md: Build Your Pillars (Outskill C14 Grp63)

## Summary

Build Your Pillars (formerly Personal Health Manager) is a web app for gentle, reflective self-tracking (see **Product principles** below). A signed-in user logs a day (exercise, steps, sleep, water, notes, Mood/Energy/Stress from 1 to 5, and feelings that match Apple Health's State of Mind labels), with the day's location and real weather attached. The dashboard shows today against the user's own goals, 7-day trends and cumulative logging milestones; the Insights page finds associations between outside conditions and the person's habits and check-ins. Prompts 1 and 2 were built in a Codex chat; Prompts 3A, 3B and 4 were built in Codex (see docs/development-log.md and docs/reports/). The gentle check-in (3C) is in progress.

## Tech stack

- React 19, TypeScript 5 (strict), Vite 6
- Tailwind CSS v4 through `@tailwindcss/vite`, with design tokens in `src/index.css`
- React Router 7
- Supabase (`@supabase/supabase-js` v2) for auth and Postgres data. Supabase is the active backend; do not introduce a second backend merely to repair an existing flow.
- Node 20 or newer for the dev server and the sample-data scripts (plain `.mjs`, no extra packages)

## Supabase project

- The app uses its own Supabase project: **PersonalHealthManager**, ref `gzsawayrorlcjmpssalc`, region us-east-1, in Miah's personal organization **OlmstedDataPlayground**. It was moved there on 2026-09-25 (see docs/handover.md, section 10).
- **Never** read from or write to any other Supabase project. In particular, the original PersonalHealthManager (ref `dfjkeuqycklxnvitmjby`) and FacilityRecords (ref `hyrxwkicuycyzzqzmqtw`) both live in the Impact Arts organization FacilityRecordsHolding, which this app must not use.
- Keys live only in `.env.local` (git-ignored). Use the publishable or anon key in the browser. Never put the service_role or secret key in this app.

## Folder map

```
.
├── AGENTS.md                     this file
├── .env.example                  variable names only; copy to .env.local
├── .gitignore
├── package.json                  scripts and dependencies
├── index.html, vite.config.ts, tsconfig.json
├── 1 - Set Up (run once).command Mac double-click helpers from the chat (see docs/handover.md)
├── 2 - Start App.command
├── 3 - Save Checkpoint.command
├── src/
│   ├── main.tsx, App.tsx         entry point and routes
│   ├── index.css                 Tailwind import and @theme tokens (colors, fonts)
│   ├── vite-env.d.ts             types for VITE_ environment variables
│   ├── context/AuthContext.tsx   session state, useAuth(), signOut()
│   ├── components/               AppLayout (sidebar), ProtectedRoute, PublicOnlyRoute,
│   │                             PageHeader, FullPageStatus
│   ├── lib/
│   │   ├── supabase.ts           the single Supabase client
│   │   ├── database.types.ts     hand-written table types (regenerate after schema changes)
│   │   ├── dates.ts              local-calendar date helpers
│   │   └── goals.ts              goal types, units, ranges, validation (single source of truth)
│   └── pages/                    AuthPage, Dashboard, Goals, LogHabits (placeholder), Settings
├── supabase/
│   ├── migrations/               0001_init.sql, 0002_goals_one_per_type.sql (both applied)
│   └── tests/                    rolled-back SQL tests for RLS and goal rules (not migrations)
├── scripts/                      Apple Health sample generator, importer, verifier
├── sample-data/                  generated export.xml, expected.json, habit_logs.csv,
│                                 seed_habit_logs.sql
└── docs/
    ├── handover.md               the original handover from the Codex chat
    ├── development-log.md        decisions and reasons, session by session
    ├── prompts/                  revised prompt texts (Prompt 3, Prompt 4)
    ├── reports/                  one report per build stage
    └── schema-log.md             schema changes per prompt
```

## Install and run

1. Install Node 20 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase > PersonalHealthManager > Project Settings > API.
4. `npm run dev`, then open http://localhost:5173
5. Data pipeline test: `npm run test:import` (expect `PASS: 59 days match exactly` and `Positive control ... CAUGHT`).
6. Type-check and production build: `npm run build`.

Supabase Authentication settings that the chat could not change through the connector: add `http://localhost:5173` (and the Vercel URL once deployed) under Authentication > URL Configuration, and decide whether email confirmation stays on.

## Coding conventions used so far

- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`. The build must pass `tsc -b` with zero errors.
- Function components. Pages and components use a default export; helpers in `src/lib` use named exports.
- All data access goes through `src/lib/supabase.ts`. Row Level Security scopes every query to the signed-in user, so client code does not filter by `user_id` and does not send `user_id` on insert (the column defaults to `auth.uid()`).
- Goal types, labels, units, ranges, and colors come only from `src/lib/goals.ts`. Stored `goal_type` values are `exercise`, `sleep`, and `water`; stored units are `minutes/day`, `hours/night`, and `liters/day`.
- Habit colors are fixed: exercise uses `ember`, sleep uses `dusk`, water uses `current`. Use the tokens in `src/index.css`, not raw hex values.
- Fonts: use the current tokens in `src/index.css`; the body uses system fonts. Do not restore older font specifications from archived briefs.
- Dates use the device's local calendar through `toISODate()` in `src/lib/dates.ts`, never UTC, so the app works in any time zone.
- A habit with no data for a day is `null`, never `0`.
- Accessibility: errors use `role="alert"`, confirmations use `role="status"`, confirm dialogs are inline (no `window.confirm`), focus rings stay visible, and reduced motion is respected.
- Messages to the user are plain sentences, for example "Sleep goal saved."
- Schema changes go in a new numbered file in `supabase/migrations/`. Never edit a migration that has already been applied. Update `src/lib/database.types.ts` and `docs/schema-log.md` in the same change.
- Testing uses positive controls: before trusting a pass or an empty result, show that the same check fails or finds something on a known case. SQL tests run inside one transaction that ends in `raise exception` so nothing is left behind.

## Product principles: gentle awareness and reflection

> Adopted by Miah on 2026-09-26. Every prompt and every change must follow these. Change them only with her approval.

**Purpose.** This app is an alternative to self-judgment. It is meant as a counter to the social-media-driven fixation on narrow ideals of health, wellness and beauty. It helps people notice their own patterns with curiosity, not grade themselves against someone else's standard.

**How that shows up in the product**

1. **Reflect, don't judge.** Wording invites noticing ("You logged…", "Days with more sunshine went along with…"), never scoring the person ("good day", "bad day", "failed", "on track").
2. **Celebrate arrivals, never mark misses.** Milestones (every 5th logged day, a glow every 14th entry) count days shown up, in any order. Encouragement appears at most once every 5 new entries, at random. **No streak shaming or pressure.** Streaks and goals count logging, not meeting targets. Missed days are gaps, never zeros or red marks. Nothing guilts a person for a missing day.
3. **Association, never cause.** Insights say what tends to happen together and always give the number of days. No verbs like "causes", "lowers", "raises".
4. **Personal, not comparative.** Never compare a person with other people, averages or ideal bodies. Goals are theirs to set, change or leave blank.
5. **Gentle check-ins, not diagnosis.** Offer one only after a real trend: more than 10 consecutive days of check-ins (the most important rule, Miah). Never use the word "screening" or diagnostic language in the interface. Frame check-ins as reflection: "This is encouragement to reflect a little more deeply today. It is not medical advice." Encourage talking with a trusted friend or family member alongside any support line.
6. **Words that travel.** The app launches in the US, Canada, India, the UAE and Germany. Prefer plain words that translate well (for example "harder" rather than "heavier"). Resources follow the person's home country, with findahelpline.com as the fallback.
7. **Encourage, kindly.** The voice is patient and warm, in Miah's words: "Change is hard, be gentle with yourself." "Growth takes work and time (and can be painful at times), but you are worth it." "Your future self is grateful for the self-care you are putting in today." Shared lines live in `src/lib/encouragement.ts`. Crisis messages stay direct and are never softened by encouragement.
8. **Privacy and control.** Store the minimum (scores and dates, never free-text answers to sensitive questions), keep everything under RLS, and let people turn features off and delete their history.

The full history of how these came about is in `docs/development-log.md`.

## Schema evolution policy

> Official policy for this project, adopted by Miah on 2026-09-25. Change it only with her approval.

**Principle.** The schema is expected to evolve through iteration. Any build prompt may revise a table, column, or constraint designed in an earlier prompt. When a later prompt shows that an earlier schema decision was wrong or incomplete, Codex should fix that decision rather than work around it.

**Rules for every schema change**

1. Work only in Supabase project PersonalHealthManager, ref `gzsawayrorlcjmpssalc` (organization OlmstedDataPlayground). Never touch any project in FacilityRecordsHolding, including the old PersonalHealthManager (`dfjkeuqycklxnvitmjby`) and FacilityRecords (`hyrxwkicuycyzzqzmqtw`).
2. Read the live schema and migration list before proposing a change, because the files in this repository may lag behind the database.
3. Make every change through a new numbered file in `supabase/migrations/`. Never edit or delete a migration that has already been applied.
4. Prefer additive changes, such as a new column, table, or index, because they cannot destroy existing data.
5. Treat a destructive change as one that drops or renames a column or table, changes a type, or tightens a constraint. Before any destructive change, run a read-only query that counts the affected rows, state the data impact in plain words, and wait for Miah's approval.
6. Carry existing data forward inside the same migration. A blank habit value stays null, because null means "not logged" and zero means "logged zero".
7. Give every new table Row Level Security in the same migration, with policies that limit each user to their own rows. Default `user_id` to `auth.uid()` so the browser never sends it.
8. Update everything that depends on the schema in the same change: `src/lib/database.types.ts`, `src/lib/goals.ts` when goal types or ranges change, the Apple Health importer and seed file when `habit_logs` changes, and `docs/schema-log.md`.
9. Verify every change before calling it done. Run a rolled-back SQL test that includes a positive control, run the Supabase security advisor, run `npm run build`, and run `npm run test:import`.
10. When a change reverses or replaces an earlier decision, record it in `docs/schema-log.md` under the current prompt. Name the earlier decision, the prompt that made it, and the reason for the change.

## Current decisions and evaluation continuity (2026-10-14)

- Documentation home: `/Users/olmstedhome/Library/CloudStorage/Box-Box/Build Your Pillars of Health AARP AgeTech after Dark/`. Start with `FINAL CHOICES/T3-Beta-Decisions-2026-10-14.md` and current dated decisions. Historical briefs are context, not authority over newer user decisions.
- Preserve `Evaluation/2026-10-14-Baseline-A0/` unchanged. Save fixes and new A/B results in a new dated round; never invent participant scores from automated tests.
- Appointment summaries, NativeShell and reminders already exist and are mounted. Inspect before rebuilding them. A report is owner-only and excludes journal notes, feelings content and location.
- A supporter is read-only. Delegated authority and dementia-related restrictions are unresolved; do not infer incapacity or silently restrict revocation.
- Use the current pillar tokens and latest colour decisions; do not revive older palette/font proposals from archived briefs.
- Use isolated synthetic fixtures for permission tests. No real health records are needed. Database project restrictions above remain in force; local disposable Postgres is appropriate for migration tests and must not be mistaken for live verification.
