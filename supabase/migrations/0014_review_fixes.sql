-- Fixes from the independent security review (docs/security-review-2026-10-12.md). Tightening only.
--  M2  invitations expire after 14 days, and are matched to the confirmed address on auth.users,
--      not the email claim inside the sign-in token
--  M1  a repeat waiting-list sign-up no longer overwrites the first recorded consent time
--  L1  the 5-share limit holds under parallel requests
--  L2  names are capped so an invite cannot carry a huge name
--  info  drop privileges the app never uses on the data tables (TRUNCATE etc.; anon gets nothing)

-- Viewers read pending invitations through followed_people(), not straight from the table.
drop policy "care_shares_select_parties" on public.care_shares;
create policy "care_shares_select_parties" on public.care_shares
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = viewer_id);

create or replace function public.accept_care_share(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_email text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select lower(email) into my_email from auth.users where id = me and email_confirmed_at is not null;
  if my_email is null then raise exception 'Confirm your email address first.' using errcode = '28000'; end if;
  update public.care_shares
     set status = 'active', viewer_id = me, accepted_at = now()
   where id = p_id and status = 'pending' and viewer_email = my_email and owner_id <> me
     and created_at > now() - interval '14 days';
  if not found then raise exception 'Invitation not found or expired.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.end_care_share(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_email text;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  select lower(email) into my_email from auth.users where id = me;
  update public.care_shares
     set status = 'revoked', ended_at = now()
   where id = p_id and status <> 'revoked'
     and (owner_id = me or viewer_id = me or (status = 'pending' and viewer_email = my_email));
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.followed_people()
returns table (share_id uuid, owner_id uuid, owner_name text, status text,
  share_eat boolean, share_sleep boolean, share_move boolean, share_balance boolean,
  created_at timestamptz, accepted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.owner_id, coalesce(nullif(left(btrim(p.full_name), 80), ''), 'Someone'), s.status,
         s.share_eat, s.share_sleep, s.share_move, s.share_balance, s.created_at, s.accepted_at
    from public.care_shares s
    left join public.profiles p on p.id = s.owner_id
   where auth.uid() is not null
     and s.status in ('pending', 'active')
     and (s.viewer_id = auth.uid()
          or (s.status = 'pending' and s.created_at > now() - interval '14 days'
              and s.viewer_email = (select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null)))
   order by s.created_at desc;
$$;

create or replace function public.create_care_share(p_email text, p_eat boolean, p_sleep boolean, p_move boolean, p_balance boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
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
  if v_email = my_email then raise exception 'You cannot share with yourself.' using errcode = '22023'; end if;
  if not (coalesce(p_eat, false) or coalesce(p_sleep, false) or coalesce(p_move, false) or coalesce(p_balance, false)) then
    raise exception 'Choose at least one pillar to share.' using errcode = '22023';
  end if;
  -- One invite at a time per person, so parallel requests cannot pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
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

-- A repeat sign-up keeps the first recorded consent time.
create or replace function public.join_waitlist(p_email text, p_ios boolean, p_android boolean, p_consent boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    raise exception 'That does not look like an email address.' using errcode = '22023';
  end if;
  if not (coalesce(p_ios, false) or coalesce(p_android, false)) then
    raise exception 'Choose the App Store, Google Play, or both.' using errcode = '22023';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Please tick the box to agree to be emailed.' using errcode = '22023';
  end if;
  insert into public.waitlist (email, want_ios, want_android, consent_at)
  values (v_email, coalesce(p_ios, false), coalesce(p_android, false), now())
  on conflict (email) do update
     set want_ios = public.waitlist.want_ios or excluded.want_ios,
         want_android = public.waitlist.want_android or excluded.want_android,
         updated_at = now();
end;
$$;

alter table public.profiles add constraint profiles_full_name_length check (full_name is null or length(full_name) <= 100);

revoke all on public.profiles, public.goals, public.habit_logs, public.daily_conditions, public.reflections from anon;
revoke truncate, references, trigger on public.profiles, public.goals, public.habit_logs, public.daily_conditions, public.reflections from authenticated;
