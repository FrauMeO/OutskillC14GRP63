-- Care sharing: a person can invite someone (a partner, a remote caregiver) to follow their
-- pillars, read-only, and end it at any time. Additive only: one new table and six functions;
-- no existing table or policy changes.
--
-- Design (Miah, 2026-10-12): invite by email, the invitee accepts; view-only; the owner picks
-- which pillars are shared; notes, feelings, locations and gentle check-in answers are NEVER
-- shared; the viewer only ever receives days that were logged (a gap is never reported).
--
-- Every write goes through a function that checks who is calling. The table has no write
-- policies, so a client cannot create, accept or widen a share by writing to it directly.
-- The viewer never gets select access to habit_logs; they get shared_days(), which returns
-- only the permitted columns.

create table public.care_shares (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  viewer_email  text not null
                check (viewer_email = lower(viewer_email) and length(viewer_email) <= 254
                       and viewer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  viewer_id     uuid references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  share_eat     boolean not null default true,
  share_sleep   boolean not null default true,
  share_move    boolean not null default true,
  share_balance boolean not null default false,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  ended_at      timestamptz,
  check (status <> 'active' or (viewer_id is not null and accepted_at is not null))
);

-- One open (pending or active) share per owner and invitee.
create unique index care_shares_one_open on public.care_shares (owner_id, viewer_email)
  where status <> 'revoked';
create index care_shares_viewer_idx on public.care_shares (viewer_id) where viewer_id is not null;

alter table public.care_shares enable row level security;

-- Read only: the owner sees their shares; the viewer sees shares addressed to them.
create policy "care_shares_select_parties" on public.care_shares
  for select to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = viewer_id
    or (status = 'pending' and viewer_email = lower((select auth.jwt() ->> 'email')))
  );

revoke insert, update, delete on public.care_shares from anon, authenticated;
revoke all on public.care_shares from anon;

-- ---------- helpers ----------
create or replace function public.care_pillar_goal_types(p_eat boolean, p_sleep boolean, p_move boolean)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(case when p_eat   then array['water', 'calories_consumed'] end, '{}')
      || coalesce(case when p_sleep then array['sleep'] end, '{}')
      || coalesce(case when p_move  then array['exercise', 'steps', 'stand_hours', 'active_calories'] end, '{}');
$$;

-- ---------- owner: invite ----------
create or replace function public.create_care_share(
  p_email text, p_eat boolean, p_sleep boolean, p_move boolean, p_balance boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  new_id uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'That does not look like an email address.' using errcode = '22023';
  end if;
  if v_email = my_email then
    raise exception 'You cannot share with yourself.' using errcode = '22023';
  end if;
  if not (coalesce(p_eat, false) or coalesce(p_sleep, false) or coalesce(p_move, false) or coalesce(p_balance, false)) then
    raise exception 'Choose at least one pillar to share.' using errcode = '22023';
  end if;
  if (select count(*) from public.care_shares where owner_id = me and status <> 'revoked') >= 5 then
    raise exception 'You can share with up to 5 people at a time. End one first.' using errcode = '54000';
  end if;
  insert into public.care_shares (owner_id, viewer_email, share_eat, share_sleep, share_move, share_balance)
  values (me, v_email, coalesce(p_eat, false), coalesce(p_sleep, false), coalesce(p_move, false), coalesce(p_balance, false))
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You have already invited that person.' using errcode = '23505';
end;
$$;

-- ---------- owner: change which pillars are shared ----------
create or replace function public.update_care_share(
  p_id uuid, p_eat boolean, p_sleep boolean, p_move boolean, p_balance boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not (coalesce(p_eat, false) or coalesce(p_sleep, false) or coalesce(p_move, false) or coalesce(p_balance, false)) then
    raise exception 'Choose at least one pillar, or end the share.' using errcode = '22023';
  end if;
  update public.care_shares
     set share_eat = coalesce(p_eat, false), share_sleep = coalesce(p_sleep, false),
         share_move = coalesce(p_move, false), share_balance = coalesce(p_balance, false)
   where id = p_id and owner_id = auth.uid() and status <> 'revoked';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------- viewer: accept ----------
create or replace function public.accept_care_share(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  -- Only a confirmed email address can claim an invitation sent to it.
  if not exists (select 1 from auth.users where id = me and email_confirmed_at is not null) then
    raise exception 'Confirm your email address first.' using errcode = '28000';
  end if;
  update public.care_shares
     set status = 'active', viewer_id = me, accepted_at = now()
   where id = p_id and status = 'pending' and viewer_email = my_email and owner_id <> me;
  if not found then raise exception 'Invitation not found.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------- either party: end (or decline) ----------
create or replace function public.end_care_share(p_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  update public.care_shares
     set status = 'revoked', ended_at = now()
   where id = p_id and status <> 'revoked'
     and (owner_id = me or viewer_id = me or (status = 'pending' and viewer_email = my_email));
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------- viewer: who am I following, and what is waiting for me ----------
create or replace function public.followed_people()
returns table (
  share_id uuid, owner_id uuid, owner_name text, status text,
  share_eat boolean, share_sleep boolean, share_move boolean, share_balance boolean,
  created_at timestamptz, accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.owner_id, coalesce(nullif(btrim(p.full_name), ''), 'Someone'), s.status,
         s.share_eat, s.share_sleep, s.share_move, s.share_balance, s.created_at, s.accepted_at
    from public.care_shares s
    left join public.profiles p on p.id = s.owner_id
   where auth.uid() is not null
     and s.status in ('pending', 'active')
     and (s.viewer_id = auth.uid()
          or (s.status = 'pending' and s.viewer_email = lower(coalesce(auth.jwt() ->> 'email', ''))))
   order by s.created_at desc;
$$;

-- ---------- viewer: the shared days (permitted columns only) ----------
create or replace function public.shared_days(p_owner uuid, p_from date, p_to date)
returns table (
  log_date date, water_liters numeric, calories_consumed int,
  sleep_hours numeric, time_in_bed_hours numeric, awake_minutes int,
  exercise_minutes int, steps int, stand_hours numeric, active_calories int,
  mood smallint, energy smallint, stress smallint
)
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
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'Ask for at most 93 days at a time.' using errcode = '22023';
  end if;
  return query
  select * from (
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

-- ---------- viewer: the goals behind the shared pillars ----------
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
  return query
  select g.goal_type, g.target_value, g.unit from public.goals g
   where g.user_id = p_owner
     and g.goal_type = any (public.care_pillar_goal_types(s.share_eat, s.share_sleep, s.share_move));
end;
$$;

-- ---------- who may call what ----------
revoke all on function public.care_pillar_goal_types(boolean, boolean, boolean) from public, anon;
revoke all on function public.create_care_share(text, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.update_care_share(uuid, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.accept_care_share(uuid) from public, anon;
revoke all on function public.end_care_share(uuid) from public, anon;
revoke all on function public.followed_people() from public, anon;
revoke all on function public.shared_days(uuid, date, date) from public, anon;
revoke all on function public.shared_goals(uuid) from public, anon;

grant execute on function public.create_care_share(text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_care_share(uuid, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.accept_care_share(uuid) to authenticated;
grant execute on function public.end_care_share(uuid) to authenticated;
grant execute on function public.followed_people() to authenticated;
grant execute on function public.shared_days(uuid, date, date) to authenticated;
grant execute on function public.shared_goals(uuid) to authenticated;
-- care_pillar_goal_types is internal: only the security-definer functions above call it.
