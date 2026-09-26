-- Prompt 3A: daily check-in ratings and feelings, where the person was each day,
-- home city on the profile, and a per-user cache of outside conditions.
-- Additive only: new nullable columns, one new table, one replaced trigger function.

-- ---------- Helper: text array without repeats (check constraints cannot use subqueries) ----------
create or replace function public.array_has_no_duplicates(arr text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select arr is null or cardinality(arr) = (select count(distinct x) from unnest(arr) as x);
$$;

-- ---------- habit_logs: check-in and location ----------
alter table public.habit_logs
  add column mood            smallint check (mood   between 1 and 5),
  add column energy          smallint check (energy between 1 and 5),
  add column stress          smallint check (stress between 1 and 5),
  add column feelings        text[]   check (
    feelings <@ array['angry', 'sad', 'stable', 'happy', 'energized']
    and public.array_has_no_duplicates(feelings)
  ),
  add column location_name   text,
  add column latitude        numeric(4, 1) check (latitude  between -90  and 90),
  add column longitude       numeric(4, 1) check (longitude between -180 and 180),
  add column location_source text check (location_source in ('device', 'home'));

-- ---------- profiles: home city ----------
alter table public.profiles
  add column home_city         text,
  add column home_country_code text check (home_country_code ~ '^[A-Z]{2}$'),
  add column home_latitude     numeric(4, 1) check (home_latitude  between -90  and 90),
  add column home_longitude    numeric(4, 1) check (home_longitude between -180 and 180);

-- ---------- daily_conditions: one cached row per user per date ----------
create table public.daily_conditions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date                 date not null,
  location_name        text,
  latitude             numeric(4, 1) not null check (latitude  between -90  and 90),
  longitude            numeric(4, 1) not null check (longitude between -180 and 180),
  precipitation_mm     numeric check (precipitation_mm >= 0),
  rain_mm              numeric check (rain_mm >= 0),
  snowfall_cm          numeric check (snowfall_cm >= 0),
  humidity_mean_pct    numeric check (humidity_mean_pct between 0 and 100),
  pressure_mean_hpa    numeric,
  temp_min_c           numeric,
  temp_max_c           numeric,
  apparent_temp_max_c  numeric,
  uv_index_max         numeric check (uv_index_max >= 0),
  daylight_hours       numeric check (daylight_hours between 0 and 24),
  sunshine_hours       numeric check (sunshine_hours between 0 and 24),
  us_aqi_max           int     check (us_aqi_max >= 0),
  pm2_5_mean           numeric check (pm2_5_mean >= 0),
  pollen_max           numeric check (pollen_max >= 0),  -- null outside Europe
  moon_illumination    numeric check (moon_illumination between 0 and 1),
  moon_phase           text,
  is_final             boolean not null default false,  -- false while the date is today (forecast)
  fetched_at           timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_conditions enable row level security;

create policy "daily_conditions_select_own" on public.daily_conditions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_conditions_insert_own" on public.daily_conditions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_conditions_update_own" on public.daily_conditions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_conditions_delete_own" on public.daily_conditions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Sign-up: also copy home city from metadata ----------
-- Bad or missing metadata leaves the home fields null instead of failing the sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lat  numeric;
  lon  numeric;
  cc   text := upper(meta ->> 'home_country_code');
begin
  if meta ->> 'home_latitude'  ~ '^-?[0-9]+(\.[0-9]+)?$' then lat := round((meta ->> 'home_latitude')::numeric, 1); end if;
  if meta ->> 'home_longitude' ~ '^-?[0-9]+(\.[0-9]+)?$' then lon := round((meta ->> 'home_longitude')::numeric, 1); end if;
  if lat is not null and lat not between -90 and 90 then lat := null; end if;
  if lon is not null and lon not between -180 and 180 then lon := null; end if;
  if cc !~ '^[A-Z]{2}$' then cc := null; end if;

  insert into public.profiles (id, full_name, home_city, home_country_code, home_latitude, home_longitude)
  values (
    new.id,
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'home_city', ''),
    cc,
    lat,
    lon
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
