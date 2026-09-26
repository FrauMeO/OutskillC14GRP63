-- Prompt 3C: gentle check-in setting and optional reflection results (PHQ-2, then PHQ-9).
-- Replaces the unapplied draft 0006_gentle_checkin_screenings.sql (branch
-- prompt-03c-gentle-checkin): same design, renumbered after Prompt 4's 0006, and named
-- "reflections" because the product never frames this as screening (CLAUDE.md principles).
-- Additive only. Stores dates and scores, never free text. Each user sees, adds, updates and
-- deletes only their own rows.

-- On by default; the user can turn it off in Settings.
alter table public.profiles
  add column gentle_checkin_enabled boolean not null default true;

-- One row per time the gentle check-in is offered, whether or not the person reflects, so the
-- once-per-14-days limit counts every offer. Scores are filled in only if they choose to.
create table public.reflections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  offered_on   date not null default current_date,
  taken_on     date,
  phq2_score   smallint check (phq2_score between 0 and 6),
  phq9_score   smallint check (phq9_score between 0 and 27),
  phq9_item9   smallint check (phq9_item9 between 0 and 3),
  created_at   timestamptz not null default now(),
  -- The PHQ-9 total and item 9 are saved together or not at all (never a partial set).
  check ((phq9_score is null) = (phq9_item9 is null)),
  -- Any score means the reflection was completed on a date.
  check ((phq2_score is null and phq9_score is null) or taken_on is not null)
);

create index reflections_user_offered_idx on public.reflections (user_id, offered_on desc);

alter table public.reflections enable row level security;

create policy "reflections_select_own" on public.reflections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reflections_insert_own" on public.reflections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reflections_update_own" on public.reflections
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reflections_delete_own" on public.reflections
  for delete to authenticated using ((select auth.uid()) = user_id);
