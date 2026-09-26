-- Prompt 3C: gentle check-in setting and optional PHQ-2 / PHQ-9 screening results.
-- Additive only. Stores dates and scores, never free text. Each user sees, adds, updates and
-- deletes only their own rows.

-- On by default; the user can turn it off in Settings.
alter table public.profiles
  add column gentle_checkin_enabled boolean not null default true;

-- One row per offer of the check-in, whether it was accepted or not, so the 14-day limit
-- counts every offer. Scores are filled in only if the person chooses to take the screening.
create table public.screenings (
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
  -- Any score means the screening was taken on a date.
  check ((phq2_score is null and phq9_score is null) or taken_on is not null)
);

create index screenings_user_offered_idx on public.screenings (user_id, offered_on desc);

alter table public.screenings enable row level security;

create policy "screenings_select_own" on public.screenings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "screenings_insert_own" on public.screenings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "screenings_update_own" on public.screenings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "screenings_delete_own" on public.screenings
  for delete to authenticated using ((select auth.uid()) = user_id);
