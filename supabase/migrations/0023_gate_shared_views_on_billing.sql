-- 0023: wire viewer_may_view (0018) into every function that returns an owner's data to a recipient.
-- Bodies are copied unchanged from 0022 (live on production 2026-10-14) plus one gate line each, placed
-- after the share checks and before any data is read or a view is counted.
-- While app_settings.billing_enforced is false, viewer_may_view is always true, so nothing changes for anyone.
-- Once it is true, a recipient without an active or trialing caregiver_yearly plan gets no rows (or null).
-- followed_people() and followed_people_scoped() are deliberately NOT gated: the supporter still sees who
-- shares with them, so the app can offer the caregiver plan. The owner's preview of shared_pillar_report is
-- not gated. Signatures, grants and return types are unchanged (create or replace keeps existing grants).

create or replace function public.shared_pillar_report(p_owner uuid, p_preview_share uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 s public.care_shares; pil text; lev text; fields text[]; start_day date; end_day date;
 entries jsonb; measures jsonb; logged_count int; mood_count int; feelings_count int; items jsonb := '[]'::jsonb;
begin
 if auth.uid() is null then return null; end if;
 if p_preview_share is not null then
   select * into s from public.care_shares where id=p_preview_share and owner_id=auth.uid() and owner_id=p_owner and status<>'revoked' for share;
 else
   select * into s from public.care_shares where owner_id=p_owner and viewer_id=auth.uid() and status='active' for share;
 end if;
 if not found or s.paused_at is not null or s.pillar_levels is null then return null; end if;
 -- Billing gate (0023): the owner's own preview is never gated; a recipient needs a paid caregiver plan.
 if p_preview_share is null and not public.viewer_may_view(p_owner) then return null; end if;
 if s.report_cadence='monthly' then
   end_day := date_trunc('month',current_date)::date-1;
   start_day := date_trunc('month',end_day)::date;
 else
   end_day := current_date; start_day := end_day-27;
 end if;
 foreach pil in array array['eat','sleep','move','balance'] loop
   lev := s.pillar_levels->>pil;
   if lev='off' then continue; end if;
   fields := case pil when 'eat' then array['water_liters','calories_consumed']
     when 'sleep' then array['sleep_hours','time_in_bed_hours','awake_minutes']
     when 'move' then array['exercise_minutes','steps','stand_hours','active_calories']
     else array['mood','energy','stress'] end;
   with permitted as (
     select h.log_date, h.mood is not null as mood_logged,
       coalesce(cardinality(h.feelings),0)>0 as feelings_logged,
       coalesce((select jsonb_object_agg(k,v) from jsonb_each(to_jsonb(h)) e(k,v) where k=any(fields) and v<>'null'::jsonb),'{}'::jsonb) as vals
     from public.habit_logs h where h.user_id=p_owner and h.log_date between start_day and end_day
   ), present as (
     select * from permitted where vals<>'{}'::jsonb or (pil='balance' and feelings_logged)
   )
   select count(*)::int, count(*) filter(where mood_logged)::int, count(*) filter(where feelings_logged)::int,
     coalesce(jsonb_agg(jsonb_build_object('date',log_date) ||
       case when lev='detail' then jsonb_build_object('values',vals) else '{}'::jsonb end ||
       case when pil='balance' then jsonb_build_object('mood_logged',mood_logged,'feelings_logged',feelings_logged) else '{}'::jsonb end order by log_date),'[]'::jsonb)
     into logged_count,mood_count,feelings_count,entries from present;
   measures := '{}'::jsonb;
   -- Monthly detail supplies averages/counts only, not dates or daily values. Summary/presence never get values.
   if lev='detail' and s.report_cadence='monthly' then
     select coalesce(jsonb_object_agg(k,stats),'{}'::jsonb) into measures from (
       select e.k,jsonb_build_object('average',avg(e.v::text::numeric),'days',count(*)) stats
       from public.habit_logs h cross join lateral jsonb_each(to_jsonb(h)) e(k,v)
       where h.user_id=p_owner and h.log_date between start_day and end_day and e.k=any(fields) and e.v<>'null'::jsonb group by e.k
     ) a;
   end if;
   items := items || jsonb_build_array(jsonb_build_object('pillar',pil,'level',lev,'days_logged',logged_count) ||
     case when s.report_cadence='live' and lev in ('presence','detail') then jsonb_build_object('entries',entries) else '{}'::jsonb end ||
     case when lev='detail' and s.report_cadence='monthly' then jsonb_build_object('measures',measures) else '{}'::jsonb end ||
     case when pil='balance' then jsonb_build_object('mood_logged',mood_count>0,'feelings_logged',feelings_count>0) else '{}'::jsonb end);
 end loop;
 if p_preview_share is null then
   insert into public.care_share_views(share_id,viewed_on,views) values(s.id,current_date,1)
   on conflict(share_id,viewed_on) do update set views=public.care_share_views.views+1;
 end if;
 return jsonb_build_object('cadence',s.report_cadence,'from',start_day,'to',end_day,'pillars',items);
end $$;
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
  if s.pillar_levels is not null or s.report_cadence<>'live' then return; end if;
  if s.paused_at is not null then return; end if;
  -- Billing gate (0023): when billing_enforced is on, only a paid caregiver may read the owner's data.
  if not public.viewer_may_view(p_owner) then return; end if;
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
  if s.pillar_levels is not null or s.report_cadence<>'live' then return; end if;
  if s.paused_at is not null or s.level <> 'detail' then return; end if;
  -- Billing gate (0023): when billing_enforced is on, only a paid caregiver may read the owner's data.
  if not public.viewer_may_view(p_owner) then return; end if;
  return query
  select g.goal_type, g.target_value, g.unit from public.goals g
   where g.user_id = p_owner
     and g.goal_type = any (public.care_pillar_goal_types(s.share_eat, s.share_sleep, s.share_move));
end;
$$;

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
  if s.pillar_levels is not null or s.report_cadence<>'live' then return; end if;
  if s.paused_at is not null or s.level = 'presence' then return; end if;
  -- Billing gate (0023): when billing_enforced is on, only a paid caregiver may read the owner's data.
  if not public.viewer_may_view(p_owner) then return; end if;

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
