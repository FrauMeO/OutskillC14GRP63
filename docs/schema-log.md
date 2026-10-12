# Schema log

One entry per build prompt. Each entry lists the tables and columns created or changed, and why. Add a new entry with every migration.

## Prompt 1: initial schema (migration 0001_init.sql, applied as `init_health_schema`)

### Table `public.profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid, primary key | References `auth.users(id)`, deleted with the user |
| full_name | text, nullable | Copied from sign-up metadata by the trigger |
| created_at | timestamptz, default now() | |

### Table `public.goals`
| Column | Type | Notes |
|---|---|---|
| id | uuid, primary key, default gen_random_uuid() | |
| user_id | uuid, not null, default auth.uid() | References `auth.users(id)`, deleted with the user |
| goal_type | text, not null | |
| target_value | numeric, not null, check >= 0 | |
| unit | text, not null | |
| created_at | timestamptz, default now() | |

Index `goals_user_id_idx` on `user_id` (removed in Prompt 2).

### Table `public.habit_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid, primary key, default gen_random_uuid() | |
| user_id | uuid, not null, default auth.uid() | References `auth.users(id)`, deleted with the user |
| log_date | date, not null, default current_date | |
| exercise_minutes | int, nullable, check >= 0 | |
| sleep_hours | numeric, nullable, check between 0 and 24 | |
| water_liters | numeric, nullable, check >= 0 | |
| notes | text, nullable | |
| created_at | timestamptz, default now() | |

Constraint `unique (user_id, log_date)`.

### Security and automation
- RLS enabled on all three tables. 11 policies, all `to authenticated`: profiles select, insert, update where `auth.uid() = id`; goals and habit_logs select, insert, update, delete where `auth.uid() = user_id`.
- Function `public.handle_new_user()` (security definer, empty search_path, execute revoked from public, anon, authenticated) and trigger `on_auth_user_created` on `auth.users` insert, which creates the profile row.

### Why
- Tables and columns follow the Prompt 1 spec.
- `timestamptz` instead of `timestamp` keeps times correct across time zones.
- `user_id` defaults to `auth.uid()` so the browser never sends it.
- One habit log per user per day lets the future log form update a day rather than duplicate it.
- Check constraints block impossible values.
- The trigger guarantees every user has a profile row.
- Nullable habit columns let "not logged" (null) differ from "logged zero".

## Prompt 2: goal rules (migration 0002_goals_one_per_type.sql, applied as `goals_one_per_type`)

No new tables or columns. Changes to `public.goals`:
- `goals_goal_type_check`: `goal_type` must be `exercise`, `sleep`, or `water`.
- `goals_target_range_check`: exercise 1 to 600, sleep 1 to 24, water more than 0 up to 10.
- `goals_one_per_type`: `unique (user_id, goal_type)`.
- Dropped index `goals_user_id_idx`, because the new unique index already starts with `user_id`.

### Why
- Prompt 2 requires only one active goal per type. The page enforces it, but only the database can guarantee it when two tabs or devices save at once.
- Fixed type keys match the dashboard and `src/lib/goals.ts`.
- Ranges match the Goals form's validation, so the rules hold even if a request bypasses the UI.

## Prompt 3A: 0004_checkin_location_conditions (2026-09-25)

Applied to `gzsawayrorlcjmpssalc` through the Supabase connector as migration `checkin_location_conditions`, after Miah approved the SQL. Additive only; no rows changed (59 habit_logs rows and 1 profile gained empty columns).

### What changed
- `habit_logs`: `mood`, `energy`, `stress` (smallint, 1 to 5, nullable); `feelings` (text[], only angry, sad, stable, happy, energized, no repeats); `location_name`, `latitude`, `longitude` (numeric(4,1), about 11 km); `location_source` (`device` or `home`).
- `profiles`: `home_city`, `home_country_code` (two capital letters), `home_latitude`, `home_longitude`.
- New table `daily_conditions`: one row per user per date (`unique (user_id, date)`) with weather, air quality, pollen, moon and `is_final`. RLS with select, insert, update and delete limited to the owner; `user_id` defaults to `auth.uid()`.
- New helper `public.array_has_no_duplicates(text[])` (immutable, empty search_path), because check constraints cannot use subqueries.
- `handle_new_user` replaced: it also copies home city fields from sign-up metadata, rounds coordinates to 0.1, and leaves them null when they are missing or invalid, so bad metadata cannot block a sign-up.

### Why
- Prompt 3 (revised text in `docs/prompts/prompt-03-checkin-weather-insights.md`) adds a daily check-in, per-day location, and cached outside conditions for the Insights page.
- Location sits on each `habit_logs` row because weather must match where the person was that day.
- The revised prompt planned to backfill the 59 sample rows with Philadelphia and Seattle inside the migration. That was moved to the sample-data seed instead, because a migration applies to every user and should not write one account's sample data.

### Verified
- `supabase/tests/checkin_test_after_0004.sql` (rolled back): home city saved and rounded (Philadelphia/US/40.0/-75.2); invalid metadata still creates the profile with null home fields; a valid check-in row saves (control); mood 6, an unknown feeling, a repeated feeling and an unknown location source are blocked; user A sees their own conditions row (control) while user B sees 0, updates 0 and cannot insert as A, and sees 0 of A's check-ins.
- Row counts unchanged afterwards (1 user, 59 logs, 0 conditions).
- `database.types.ts` regenerated from the live database; `npm run build` passes.
- Security advisor: no findings from this migration. It now reports one Auth setting, "Leaked password protection disabled", which is a dashboard setting, not schema.

## Project move: 0003_revoke_rls_auto_enable_execute (2026-09-25)

Applied to the new project `gzsawayrorlcjmpssalc` through the Supabase connector as migration `revoke_rls_auto_enable_execute`.

### What changed
- Revoked `execute` on `public.rls_auto_enable()` from `public`, `anon`, and `authenticated`.

### Why
- Supabase adds this `security definer` function to new projects for its `ensure_rls` event trigger. In the `public` schema it was callable through `/rest/v1/rpc/rls_auto_enable`, which the security advisor flagged twice (lints 0028 and 0029).
- No app code, table, or type changes, so `database.types.ts` and `goals.ts` are unchanged.

### Verified
- Before: `anon` and `authenticated` could execute it (control that the check can see the grant). After: both false; `postgres` still true.
- Rolled-back test: a new probe table inside a transaction that ends in `raise exception` still had RLS switched on, so `ensure_rls` still works.
- Security advisor: 2 warnings before, 0 after.

## Prompt 3A: 0005_feelings_apple_labels (2026-09-25)

Applied as migration `feelings_apple_labels` after Miah approved the SQL. 0 rows had feelings, so no data changed.

### What changed
- Replaced `habit_logs_feelings_check`. Allowed feelings are now `frustrated`, `overwhelmed`, `calm`, `peaceful`, `confident`, `grateful`, each an exact Apple Health State of Mind label (`HKStateOfMind.Label`). The no-repeats rule stays.
- The migration maps any old values forward (angry to frustrated, sad to overwhelmed, stable to calm, happy to peaceful, energized to confident).

### Why (reverses a 0004 decision)
- 0004 used the five feelings from the older Prompt 3 text (angry, sad, stable, happy, energized). Miah asked for reflective states rather than reactions, matched to Apple's labels so a future Apple Health import maps one to one, with a sixth, positive feeling (grateful). The faces shown in the app (`src/lib/checkin.ts`) are the app's own; Apple defines only the words.

### Verified
- `supabase/tests/feelings_test_after_0005.sql` (rolled back): all six save together (control); the old word `happy`, an unselected Apple label `joyful`, and a repeat are blocked.

## Prompt 4: 0006_dashboard_metrics (2026-09-25)

Applied as migration `dashboard_metrics` after Miah approved the plan. Numbered 0006 because Prompt 3C is paused; its draft migration (`0006_gentle_checkin_screenings.sql` on branch `prompt-03c-gentle-checkin`, never applied) must be renumbered to 0007 before it is applied. Data snapshot taken first: `sample-data/snapshots/2026-09-25-demo/`.

### What changed
- `habit_logs`: `steps`, `stand_hours`, `active_calories`, `time_in_bed_hours`, `awake_minutes`, `calories_consumed` (nullable, range checks) and `source` (`apple_health` or `manual`, not null, default `manual`). One row per user per day is unchanged.
- `goals`: `goals_goal_type_check` and `goals_target_range_check` replaced with wider versions adding `steps` (100 to 100000), `stand_hours` (1 to 24), `active_calories` (10 to 5000) and `calories_consumed` (500 to 10000). Loosening only; 0 goal rows existed. `goals_one_per_type` unchanged.

### Why
- The Prompt 4 dashboard cards and charts need these metrics, and `source` decides ring (Apple Health) vs bar (manual).
- Existing sample rows were set to `source = 'apple_health'` by the reseed, not by the migration (same reason as 3A: a migration applies to every user).

### Earlier code changed because of this
- `src/lib/goals.ts`: seven goal types with a category and the habit_logs field each compares with; the Goals page lists them automatically.
- Log Habits: a Steps field; saving from the form sets `source = 'manual'`.
- Sample pipeline: generator (stand, active energy, food on a second random sequence, so older values are unchanged), importer (six new fields; steps counted from one device), verifier (nine fields, second control), seed builder and seed verifier.
- `generate-sample-checkins.mjs`: check-ins are drawn only for days with exercise, sleep or water data, so adding 2026-09-14 (steps only) did not shift the 3B-validated check-ins.

### Verified
- `supabase/tests/dashboard_test_after_0006.sql` (rolled back): valid row saved (control) with default source `manual`; negative steps, 2000 awake minutes and an unknown source blocked; the old exercise goal and all four new goal types save; a 50-step goal, an unknown type and a duplicate type are blocked; another user sees 0 of these rows.
- Reseeded demo data matches the verifier's day counts on every field (steps, stand and active calories 60; time in bed and awake 47; calories eaten 43; exercise 53, sleep 47, water 48).

## Prompt 3C: 0007_reflections (2026-09-26)

Applied as migration `reflections` after Miah approved the design, resources and wording. Replaces the never-applied draft `0006_gentle_checkin_screenings.sql` (branch `prompt-03c-gentle-checkin`), renumbered after Prompt 4 and renamed because the product never frames this as screening.

### What changed
- `profiles.gentle_checkin_enabled` (boolean, not null, default true).
- New table `reflections`: one row per offer (`offered_on`), with `taken_on`, `phq2_score` (0 to 6), `phq9_score` (0 to 27) and `phq9_item9` (0 to 3). PHQ-9 total and item 9 are saved together or not at all; any score needs `taken_on`. No free text. RLS: each user selects, inserts, updates and deletes only their own rows.

### Verified
- `supabase/tests/reflections_test_after_0007.sql` (rolled back): setting defaults to on; an offer alone and a completed reflection save (controls); a PHQ-9 total without item 9, a score without a date and a total of 28 are blocked; user A sees 2 rows, user B sees 0, deletes 0 and cannot insert as A; A can delete their own.
- Security advisor: no findings from this migration.

## 0008_more_feelings (2026-09-26)

Applied as migration `more_feelings` after Miah approved. Loosening only: the allowed feelings grow from 6 to 13 (adds hopeful, proud, steady, meh, anxious, lonely, tired). Every saved value stays valid.

- Why: Bob asked for more feeling words; Miah asked for a second neutral (Steady, Meh) and Tired instead of Content.
- Stored words are the app's own. `src/lib/checkin.ts` maps each to an Apple State of Mind label: ten by name, steady -> content, meh -> indifferent, tired -> drained.
- Verified: `supabase/tests/feelings_test_after_0008.sql` (rolled back): all 13 save together (control); Apple's `content`, the old `happy` and a repeat are blocked.

## Not schema, but touches the data

- `sample-data/seed_habit_logs.sql` (built by `scripts/build-demo-seed.mjs` since Prompt 3A) inserts 59 days of sample rows, check-ins, locations and matching `daily_conditions` for `msolmsted+demo@gmail.com` using `on conflict (user_id, log_date) do update`. It was run on the new project on 2026-09-25 (59 rows).

## 0010_care_shares and 0011_waitlist (2026-10-12)

Both applied to PersonalHealthManager (`gzsawayrorlcjmpssalc`) as migrations `care_shares` and `waitlist` after Miah approved the design. Additive only; nothing existing changed.

### What changed
- New table `care_shares` (owner invites a viewer by email; pending, active or revoked; the owner picks Eat, Sleep, Move and Balance, with Balance off by default). RLS gives select to the owner and the viewer only, and the table has no write policies: every change goes through security-definer functions `create_care_share`, `update_care_share`, `accept_care_share`, `end_care_share`. Viewers read through `followed_people`, `shared_days` (permitted columns only, days with something shared logged, 93-day cap) and `shared_goals`; they never get select access to `habit_logs`, and notes, feelings and locations are never returned. Limits: 5 open shares per owner; accepting needs a confirmed email that matches the invite.
- New table `waitlist` (email, want_ios, want_android) with RLS on and no policies; signed-out visitors join through `join_waitlist`, which returns nothing so it cannot reveal whether an address is already listed. Email and store choice are all that is kept.

### Verified
- `supabase/tests/care_shares_test_after_0010.sql` (rolled back): stranger sees 0 shares and 0 days and cannot accept or end; an unconfirmed or different account cannot accept; the viewer sees 0 days before accepting and 1 after (the mood-only day stays hidden until Balance is shared, then 2 days and mood 4); notes and feelings are not returnable; direct inserts and flag updates by the viewer are blocked; turning Move off removes steps and the steps goal; ending the share returns 0 days.
- `supabase/tests/waitlist_test_after_0011.sql` (rolled back): anon can join, bad email and no-store are blocked, repeat joins merge the store flags into one row, anon and signed-in users read 0 rows and cannot insert directly.
- Not yet verified: the security advisor result after these migrations (see the session report), and the screens (built by separate agents).

## 0012_delete_my_account, 0013_email_consent, 0014_review_fixes (2026-10-12)

All applied to PersonalHealthManager after Miah's go-ahead; each tested in a rolled-back block.
- `delete_my_account()`: deletes the caller's auth user; every user table cascades (checked via pg_constraint). Test: other user's rows untouched, anon blocked.
- Consent: `profiles.marketing_opt_in`, `marketing_opt_in_at`, `health_consent_at` (set by the sign-up trigger only when the form sends the string 'true'); `waitlist.consent_at`; `join_waitlist` now takes `p_consent` and refuses without it.
- Review fixes (from `docs/security-review-2026-10-12.md`): invitations expire after 14 days and match the confirmed address on `auth.users` (not the token's email claim); viewers read pending invites through `followed_people()` only; per-owner advisory lock on the 5-share limit; names capped at 100; anon loses all privileges on the health tables and signed-in users lose TRUNCATE/REFERENCES/TRIGGER; a repeat waiting-list sign-up keeps the first consent time.
- Known and left: no double opt-in on the waiting list (send one confirming email before any launch mail); consent columns are client-writable (acceptable for marketing, weak evidence for Art. 9 consent: confirm with a lawyer); delete needs no re-authentication; leaked-password protection is a Supabase Auth dashboard setting, still off.

## 0015_care_sharing_v2 (2026-10-12)

Written, not yet applied (Miah's main session applies and tests it). Contract: `docs/care-sharing-v2-contract.md`. Additive except that `followed_people()` is dropped and recreated (a function's return type cannot change in place).

### What changed
- `care_shares` gains `level` (`presence`, `summary` or `detail`; new shares start at `presence`), `paused_at` (set while paused) and `last_confirmed_at` (default now). Shares that already exist are set to `detail` once, which is what their viewers already see.
- New table `care_share_views` (`share_id`, `viewed_on`, `views`; one row per share per day, the counter goes up on repeat looks). RLS lets only the owner of the share read it; clients cannot insert, update or delete. Index on `share_id`.
- New functions `set_care_share_options(p_id, p_level, p_paused)` and `confirm_care_share(p_id)` (owner only; a null argument leaves that setting alone; nothing notifies anyone). The 90-day re-confirmation is stored and offered only; nothing is enforced server-side.
- `shared_days` keeps its signature and columns but is now volatile (it records a view). Paused returns nothing; `presence` and `summary` return the logged days with every value null; `detail` is the old behaviour.
- New `shared_week_summary(p_owner)` returns (`pillar`, `days_logged`, `trend`) with trend words only: `not_enough_days` under 4 logged days this week or 10 in the owner's own 56-day baseline, otherwise `about_usual`, `a_little_lower` or `a_little_higher` at 10% of the baseline mean. Uses the database's `current_date`. Empty if paused, not active, or `presence`.
- `followed_people()` appends `level` and `paused`. `shared_goals` returns rows only at `detail` and not paused.

### Verified
- Not yet run. Test to run after applying: `supabase/tests/care_sharing_v2_test_after_0015.sql` (rolled back; expected result line in the comment at its end).

## 0015_care_sharing_v2, 0016_signup_name_and_birth, 0018_billing (2026-10-12)
All applied to PersonalHealthManager and tested in rolled-back blocks.
- 0015: care_shares gains level (presence/summary/detail; existing shares carried over as detail), paused_at, last_confirmed_at; care_share_views (owner-readable access log, one row per share per day, written only by the viewer functions); set_care_share_options, confirm_care_share, shared_week_summary; shared_days / shared_goals / followed_people updated. Test `care_sharing_v2_test_after_0015.sql` matched its expected line.
- 0016: profiles.birth_month / birth_year (both or neither; under 16 refused by the sign-up trigger); the sign-up name is one display name (40 characters).
- 0018: app_settings (billing_enforced = false), customers, subscriptions, stripe_events, plan_from_birth, plan_for (server only), my_entitlement, viewer_may_view, profile_birth_needed. Verified live (rolled back): beta gives full access; with enforcement on, 60+ free, under-60 none until an active subscription, a legacy account is asked for its birth month and year, a caregiver subscription grants viewing; clients cannot write settings or subscriptions or call plan_for. NOT yet done: calling viewer_may_view inside shared_days / shared_week_summary / shared_goals (docs/billing.md), so flipping billing_enforced does not yet gate caregivers.

## 0019_ai_consent (2026-10-12)

Written, not yet applied (Miah's main session applies and tests it). Additive.
- `profiles.ai_consent_at` and `ai_consent_version` (both null, or both set): proof the person said yes to the AI reflection wording `CONSENT_VERSION` (src/lib/aiConsent.ts). A guard trigger stops the browser editing them directly (the earlier consent columns in 0013 are client-writable; these are not).
- `set_ai_consent(p_granted, p_version)`: the signed-in person records or withdraws (withdraw clears both). A repeat yes to the same version keeps the first time. Revoked from public and anon.
- `ai_call_log` (RLS on, no policies, no grants) and `ai_consume_call(p_version)`: one call from the Edge Function with the person's own login answers `ok`, `no_consent` or `rate_limited` (20 calls in any hour) and records the call. A table rather than memory, because Edge Function instances are short-lived and side by side.
- Edge Function `daily-reflection` now refuses with 403 (no consent) or 429 (rate limit) and the fixed message, and fails closed (503) if the check cannot run. Deploy it only after this migration is applied.
- Test: `supabase/tests/ai_consent_test_after_0019.sql` (expected result line in its header). Run once against a scratch local Postgres with stubbed auth and profiles; not yet run on Supabase.

## 0020_consent_ledger (2026-10-12)

Written, not yet applied (Miah's main session applies it and runs `supabase/tests/consent_ledger_test_after_0020.sql`). Spec: `docs/privacy-consent-spec.md`. Additive, except that `handle_new_user()` is replaced.

### What changed
- New table `consents`: append-only ledger (identity id, user_id cascade, kind in `collect_use`, `share_caregiver`, `ai_processing`, `email_marketing`, version, granted, text_hash of 64 lower-case hex digits, share_id for `share_caregiver` only, details jsonb under 2000 characters, created_at). RLS: select own rows only. Clients have no insert, update, delete or truncate; a trigger also refuses updates and truncate for everyone. Rows leave only with the account (cascade). The spec sketch called this `consent_events`; Miah's brief named a `consents` ledger with a `record_consent(p_kind, p_version, p_granted, p_text_hash, p_share_id)` function, so that shape is built, plus an optional sixth argument `p_details` (what was agreed to: pillars, level, recipient).
- `record_consent(...)`: security definer, uses `auth.uid()` only. Checks kind, version (1 to 1000), hash format, the share belongs to the caller (for `share_caregiver`), and a limit of 60 changes an hour. For `email_marketing` it also sets `profiles.marketing_opt_in` and its timestamp; for `collect_use` it sets or clears `profiles.health_consent_at`. Returns the new row id.
- `my_consents()`: latest row per kind (per share for `share_caregiver`), runs as the caller.
- New table `privacy_requests` (type access, delete, correct, restrict, object, withdraw, list_third_parties or appeal; status; `due_at` = created_at + 30 days; extension, answer and outcome fields; founders' `notes`). RLS: select own rows, and `notes` is not granted to clients (column grant). `create_privacy_request(p_type, p_details)` allows 5 open at a time. `my_privacy_requests()` returns the safe columns. Decision (earlier): the spec sketched a founders-only table with no client access; Miah asked for own-row access and a 30-day clock in the app, so clients can create and read their own.
- On account deletion the consents cascade, but the `privacy_requests` rows stay (spec section 7: the request log is kept) with the person unlinked (`user_id` set null) and `details` cleared by a trigger on `auth.users`. Request log retention (24 months) still needs a job.
- `handle_new_user()` replaced: minimum age 18 (was 16 in 0016). Everything else is copied unchanged from 0016. Accounts that already exist are not touched.

### Reverses an earlier decision
- Minimum age 16 (0016, Prompt "sign-up name and birth") becomes 18 everywhere, on Miah's decision of 2026-10-12 (India's DPDP Act treats under-18s as children). Existing 16 and 17 year old accounts, if any, are not removed; decide separately.

### Verified
- `consent_ledger_test_after_0020.sql` run against a scratch local PostgreSQL 17 (stub `auth` schema and roles, migrations 0001 to 0018 and 0020; not the live project): matched its expected line, including controls. Not yet run on PersonalHealthManager. Security advisor not yet run on it.

### Not done (see the status table in the spec)
- A `consent_texts` table checking the hash against stored wording; `has_consent` and the insert policies on `habit_logs`, `goals`, `reflections`; the AI gate in the edge function and `set_ai_consent` calling `record_consent`; a withdraw dialog that pauses saving; export of `consents` in the download; retention jobs.
