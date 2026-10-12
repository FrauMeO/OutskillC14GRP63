-- Care sharing v2 (docs/care-sharing-v2-contract.md). Additive: three columns, one table, two new
-- owner functions, one new viewer function; shared_days, shared_goals and followed_people change.
--
-- What the owner gains (everything stays OFF until chosen; the app starts new shares at 'presence'):
--   level   presence = "checked in" days only (dates, no values)
--           summary  = weekly trend words per pillar, never numbers (shared_week_summary)
--           detail   = the per-day values for the ticked pillars (the 0010 behaviour)
--   paused_at        pausing hides everything at once; resuming brings it back. Nobody is told.
--   last_confirmed_at  the owner re-confirms every 90 days. This migration only stores it and
--                      offers confirm_care_share(); nothing here enforces the 90 days.
--   care_share_views   one row per share per day with a count, so the owner can see "Anna looked on
--                      3 days this month". Date only, never a time. Written only by the viewer
--                      functions below; the owner can read it; no client can write it.
--
-- Level and pause changes never notify anyone (there is no notification code here, on purpose).

-- ---------- care_shares: level, paused_at, last_confirmed_at ----------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'care_shares' and column_name = 'level') then
    alter table public.care_shares
      add column level text not null default 'presence'
          check (level in ('presence', 'summary', 'detail'));
    -- Shares that already exist were created under 0010, where the viewer sees day-by-day values.
    -- Carry that forward so this migration does not quietly take anything away from an existing
    -- viewer or hand the owner a surprise; the owner can lower it at any time. Runs once only.
    update public.care_shares set level = 'detail';
  end if;
end $$;

alter table public.care_shares
  add column if not exists paused_at         timestamptz,
  add column if not exists last_confirmed_at timestamptz not null default now();

-- ---------- care_share_views ----------
create table if not exists public.care_share_views (
  share_id  uuid not null references public.care_shares (id) on delete cascade,
  viewed_on date not null,
  views     int  not null default 1 check (views >= 1),
  primary key (share_id, viewed_on)
);
create index if not exists care_share_views_share_idx on public.care_share_views (share_id);

alter table public.care_share_views enable row level security;

-- Only the owner of the share can read its access history. The viewer cannot read it.
drop policy if exists "care_share_views_select_owner" on public.care_share_views;
create policy "care_share_views_select_owner" on public.care_share_views
  for select to authenticated
  using (exists (select 1 from public.care_shares s
                  where s.id = care_share_views.share_id and s.owner_id = (select auth.uid())));

revoke all on public.care_share_views from anon;
revoke insert, update, delete, truncate, references, trigger on public.care_share_views from authenticated;
grant select on public.care_share_views to authenticated;

-- ---------- owner: how much is shared, and pause / resume ----------
-- A null argument leaves that setting as it is. Works on pending and active shares, not revoked ones.
create or replace function public.set_care_share_options(p_id uuid, p_level text, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_level is not null and p_level not in ('presence', 'summary', 'detail') then
    raise exception 'Choose how much they see.' using errcode = '22023';
  end if;
  update public.care_shares
     set level     = coalesce(p_level, level),
         paused_at = case when p_paused is null then paused_at
                          when p_paused then coalesce(paused_at, now())
                          else null end
   where id = p_id and owner_id = auth.uid() and status <> 'revoked';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------- owner: "yes, I am still happy sharing" ----------
create or replace function public.confirm_care_share(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  update public.care_shares
     set last_confirmed_at = now()
   where id = p_id and owner_id = auth.uid() and status <> 'revoked';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------- viewer: the shared days ----------
-- Same signature and columns as 0010, but now VOLATILE because it records that the viewer looked.
-- Paused or not active: nothing. presence and summary: one row per day with something shared
-- logged, every value column null. detail: the values for the ticked pillars.
-- A view is one row per share per day (viewed_on is the database's current_date); further calls
-- on the same day only add to its counter, so the owner's history cannot be flooded with rows.
create or replace function public.shared_days(p_owner uuid, p_from date, p_to date)
returns table (
  log_date date, water_liters numeric, calories_consumed int,
  sleep_hours numeric, time_in_bed_hours numeric, awake_minutes int,
  exercise_minutes int, steps int, stand_hours numeric, active_calories int,
  mood smallint, energy smallint, stress smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.care_shares;
begin
  if auth.uid() is null then return; end if;
  select * into s from public.care_shares
   where owner_id = p_owner and viewer_id = auth.uid() and status = 'active';
  if not found then return; end if;
  if s.paused_at is not null then return; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'Ask for at most 93 days at a time.' using errcode = '22023';
  end if;

  insert into public.care_share_views (share_id, viewed_on, views)
  values (s.id, current_date, 1)
  on conflict (share_id, viewed_on)
  do update set views = public.care_share_views.views + 1;

  return query
  select d.log_date,
         case when s.level = 'detail' then d.water_liters end,
         case when s.level = 'detail' then d.calories_consumed end,
         case when s.level = 'detail' then d.sleep_hours end,
         case when s.level = 'detail' then d.time_in_bed_hours end,
         case when s.level = 'detail' then d.awake_minutes end,
         case when s.level = 'detail' then d.exercise_minutes end,
         case when s.level = 'detail' then d.steps end,
         case when s.level = 'detail' then d.stand_hours end,
         case when s.level = 'detail' then d.active_calories end,
         case when s.level = 'detail' then d.mood end,
         case when s.level = 'detail' then d.energy end,
         case when s.level = 'detail' then d.stress end
    from (
      select h.log_date,
             case when s.share_eat     then h.water_liters end as water_liters,
             case when s.share_eat     then h.calories_consumed end as calories_consumed,
             case when s.share_sleep   then h.sleep_hours end as sleep_hours,
             case when s.share_sleep   then h.time_in_bed_hours end as time_in_bed_hours,
             case when s.share_sleep   then h.awake_minutes end as awake_minutes,
             case when s.share_move    then h.exercise_minutes end as exercise_minutes,
             case when s.share_move    then h.steps end as steps,
             case when s.share_move    then h.stand_hours end as stand_hours,
             case when s.share_move    then h.active_calories end as active_calories,
             case when s.share_balance then h.mood end as mood,
             case when s.share_balance then h.energy end as energy,
             case when s.share_balance then h.stress end as stress
        from public.habit_logs h
       where h.user_id = p_owner and h.log_date between p_from and p_to
    ) d
  -- A day appears only if something shared was logged; a gap is never reported.
  where (d.water_liters is not null or d.calories_consumed is not null or d.sleep_hours is not null
      or d.time_in_bed_hours is not null or d.awake_minutes is not null or d.exercise_minutes is not null
      or d.steps is not null or d.stand_hours is not null or d.active_calories is not null
      or d.mood is not null or d.energy is not null or d.stress is not null)
  order by d.log_date;
end;
$$;

-- ---------- viewer: the weekly pillar summary, in words ----------
-- One row per ticked pillar: eat, sleep, move, balance. days_logged is the number of the last 7 days
-- (today and the 6 before it) with anything logged for that pillar. trend is one of
--   not_enough_days  fewer than 4 days with the pillar's main measure this week, or fewer than 10 in
--                    the baseline (the owner's own 56 days before that 7-day window)
--   about_usual      this week's mean is within 10% of the baseline mean
--   a_little_lower / a_little_higher   it differs by more than 10% of the baseline mean
-- Main measure: eat = water_liters; sleep = sleep_hours; balance = mood; move = steps, or
-- exercise_minutes when the owner has no steps logged in the 63 days (chosen once for the whole
-- window so steps and minutes are never averaged together). Only logged days count; a gap is not
-- a zero. The window uses the database's local current_date, not the viewer's or owner's time zone.
-- No numbers other than the day count are returned. Empty if paused, not active, or level presence.
create or replace function public.shared_week_summary(p_owner uuid)
returns table (pillar text, days_logged int, trend text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.care_shares;
  v_today date := current_date;
  v_use_steps boolean;
begin
  if auth.uid() is null then return; end if;
  select * into s from public.care_shares
   where owner_id = p_owner and viewer_id = auth.uid() and status = 'active';
  if not found then return; end if;
  if s.paused_at is not null or s.level = 'presence' then return; end if;

  select exists (select 1 from public.habit_logs h
                  where h.user_id = p_owner and h.steps is not null
                    and h.log_date between v_today - 62 and v_today)
    into v_use_steps;

  insert into public.care_share_views (share_id, viewed_on, views)
  values (s.id, v_today, 1)
  on conflict (share_id, viewed_on)
  do update set views = public.care_share_views.views + 1;

  return query
  with m as (
    select 'eat'::text as pl, h.log_date as d,
           (h.water_liters is not null or h.calories_consumed is not null) as any_logged,
           h.water_liters::numeric as val
      from public.habit_logs h
     where s.share_eat and h.user_id = p_owner and h.log_date between v_today - 62 and v_today
    union all
    select 'sleep', h.log_date,
           (h.sleep_hours is not null or h.time_in_bed_hours is not null or h.awake_minutes is not null),
           h.sleep_hours::numeric
      from public.habit_logs h
     where s.share_sleep and h.user_id = p_owner and h.log_date between v_today - 62 and v_today
    union all
    select 'move', h.log_date,
           (h.exercise_minutes is not null or h.steps is not null or h.stand_hours is not null or h.active_calories is not null),
           case when v_use_steps then h.steps::numeric else h.exercise_minutes::numeric end
      from public.habit_logs h
     where s.share_move and h.user_id = p_owner and h.log_date between v_today - 62 and v_today
    union all
    select 'balance', h.log_date,
           (h.mood is not null or h.energy is not null or h.stress is not null),
           h.mood::numeric
      from public.habit_logs h
     where s.share_balance and h.user_id = p_owner and h.log_date between v_today - 62 and v_today
  ),
  agg as (
    select m.pl,
           (count(*) filter (where m.d >= v_today - 6 and m.any_logged))::int as dl,
           count(m.val) filter (where m.d >= v_today - 6) as n_this,
           avg(m.val)   filter (where m.d >= v_today - 6) as mean_this,
           count(m.val) filter (where m.d <= v_today - 7) as n_base,
           avg(m.val)   filter (where m.d <= v_today - 7) as mean_base
      from m
     group by m.pl
  )
  select p.pl,
         coalesce(a.dl, 0),
         case when coalesce(a.n_this, 0) >= 4 and coalesce(a.n_base, 0) >= 10 then
                case when abs(a.mean_this - a.mean_base) > 0.10 * abs(a.mean_base) then
                       case when a.mean_this < a.mean_base then 'a_little_lower' else 'a_little_higher' end
                     else 'about_usual' end
              else 'not_enough_days' end
    from (values (1, 'eat', s.share_eat), (2, 'sleep', s.share_sleep),
                 (3, 'move', s.share_move), (4, 'balance', s.share_balance)) as p(ord, pl, ticked)
    left join agg a on a.pl = p.pl
   where p.ticked
   order by p.ord;
end;
$$;

-- ---------- viewer: who am I following (adds level and paused at the end) ----------
-- The return type changes, so the function is dropped and created again (grants re-applied below).
drop function if exists public.followed_people();
create function public.followed_people()
returns table (
  share_id uuid, owner_id uuid, owner_name text, status text,
  share_eat boolean, share_sleep boolean, share_move boolean, share_balance boolean,
  created_at timestamptz, accepted_at timestamptz,
  level text, paused boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.owner_id, coalesce(nullif(left(btrim(p.full_name), 80), ''), 'Someone'), s.status,
         s.share_eat, s.share_sleep, s.share_move, s.share_balance, s.created_at, s.accepted_at,
         s.level, (s.paused_at is not null)
    from public.care_shares s
    left join public.profiles p on p.id = s.owner_id
   where auth.uid() is not null
     and s.status in ('pending', 'active')
     and (s.viewer_id = auth.uid()
          or (s.status = 'pending' and s.created_at > now() - interval '14 days'
              and s.viewer_email = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)))
   order by s.created_at desc;
$$;

-- ---------- viewer: the goals behind the shared pillars (detail level only) ----------
create or replace function public.shared_goals(p_owner uuid)
returns table (goal_type text, target_value numeric, unit text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.care_shares;
begin
  if auth.uid() is null then return; end if;
  select * into s from public.care_shares
   where owner_id = p_owner and viewer_id = auth.uid() and status = 'active';
  if not found then return; end if;
  if s.paused_at is not null or s.level <> 'detail' then return; end if;
  return query
  select g.goal_type, g.target_value, g.unit from public.goals g
   where g.user_id = p_owner
     and g.goal_type = any (public.care_pillar_goal_types(s.share_eat, s.share_sleep, s.share_move));
end;
$$;

-- ---------- who may call what ----------
revoke all on function public.set_care_share_options(uuid, text, boolean) from public, anon;
revoke all on function public.confirm_care_share(uuid) from public, anon;
revoke all on function public.shared_days(uuid, date, date) from public, anon;
revoke all on function public.shared_week_summary(uuid) from public, anon;
revoke all on function public.followed_people() from public, anon;
revoke all on function public.shared_goals(uuid) from public, anon;

grant execute on function public.set_care_share_options(uuid, text, boolean) to authenticated;
grant execute on function public.confirm_care_share(uuid) to authenticated;
grant execute on function public.shared_days(uuid, date, date) to authenticated;
grant execute on function public.shared_week_summary(uuid) to authenticated;
grant execute on function public.followed_people() to authenticated;
grant execute on function public.shared_goals(uuid) to authenticated;
