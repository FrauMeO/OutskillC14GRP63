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

## Prompt 3: no schema changes

Prompt 3 has not been built, so no migration exists for it yet. The existing `habit_logs` table already supports one row per user per day with upsert. The Prompt 3 text (see docs/handover.md) also asks for steps, multiple feelings, weather, and biometrics, which will need new columns or tables in a future migration.

## Not schema, but touches the data

- `sample-data/seed_habit_logs.sql` inserts 59 days of sample rows for `demo@healthapp.test` using `on conflict (user_id, log_date) do update`. It has never been run.
