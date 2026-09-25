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

## Not schema, but touches the data

- `sample-data/seed_habit_logs.sql` inserts 59 days of sample rows for `msolmsted+demo@gmail.com` using `on conflict (user_id, log_date) do update`. It was run on the new project on 2026-09-25 (59 rows).
