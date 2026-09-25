-- Personal Health Manager: initial schema, RLS, and profile trigger.
-- Applied to Supabase project PersonalHealthManager as migration "init_health_schema".

-- ---------- Tables ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_type     text not null,
  target_value  numeric not null check (target_value >= 0),
  unit          text not null,
  created_at    timestamptz not null default now()
);

create table public.habit_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date          date not null default current_date,
  exercise_minutes  int check (exercise_minutes >= 0),
  sleep_hours       numeric check (sleep_hours between 0 and 24),
  water_liters      numeric check (water_liters >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  unique (user_id, log_date)   -- one log per user per day; the log form will upsert
);

create index goals_user_id_idx on public.goals (user_id);
-- habit_logs (user_id, log_date) is already indexed by the unique constraint.

-- ---------- Row Level Security ----------
alter table public.profiles   enable row level security;
alter table public.goals      enable row level security;
alter table public.habit_logs enable row level security;

-- profiles: key is id
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- goals
create policy "goals_select_own" on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on public.goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- habit_logs
create policy "habit_logs_select_own" on public.habit_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "habit_logs_insert_own" on public.habit_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "habit_logs_update_own" on public.habit_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "habit_logs_delete_own" on public.habit_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Auto-create a profile row on sign-up ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
