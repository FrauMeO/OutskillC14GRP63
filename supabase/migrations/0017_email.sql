-- Email layer: consent flags, nudges, suppression list, send log, double opt-in for the waiting list.
-- Additive only. Written to be applied AFTER 0015_care_sharing_v2.sql (it reads care_shares.level and
-- care_shares.paused_at). Nothing here sends mail: sending is done only by the send-email edge function
-- (service role, provider key from Deno.env), never from the browser.
--
-- Design notes (docs/email-learnings.md has the long version):
--  * No plaintext address is stored for logging or suppression: email_hash / recipient_hash are keyed
--    HMAC-SHA256 values made by the edge functions with the EMAIL_HASH_KEY secret.
--  * No message content is stored anywhere. email_log records kind, status and the provider's message id.
--  * Tokens (waitlist confirm, mute, unsubscribe) are stored only as SHA-256 hex. The database recomputes
--    encode(sha256(convert_to(token,'utf8')),'hex') when a link is used.
--  * Everything defaults OFF. Revoking or pausing a share sends no email: nothing here reacts to either.
--  * Same function style as 0010/0014: security definer, search_path = '', revoked from public/anon.

-- ---------- 1. suppression list (bounces, complaints, unsubscribes) ----------
create table public.email_suppressions (
  id         uuid primary key default gen_random_uuid(),
  email_hash text not null unique check (email_hash ~ '^[0-9a-f]{64}$'),
  reason     text not null check (reason in ('bounce', 'complaint', 'unsubscribe')),
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from anon, authenticated;

-- Webhook deliveries already handled, so a retried delivery changes nothing (idempotent).
create table public.email_webhook_events (
  event_id    text primary key check (length(event_id) between 1 and 200),
  event_type  text not null check (length(event_type) <= 100),
  received_at timestamptz not null default now()
);
alter table public.email_webhook_events enable row level security;
revoke all on public.email_webhook_events from anon, authenticated;

-- ---------- 2. send log (no content, no plaintext address) ----------
create table public.email_log (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('care_invite', 'care_nudge', 'weekly_digest', 'waitlist_confirm')),
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  share_id       uuid references public.care_shares (id) on delete set null,
  status         text not null check (status in ('queued', 'sent', 'failed')),
  provider_id    text,
  dedupe_key     text,
  created_at     timestamptz not null default now()
);
-- One live row per dedupe key (kind:share:day). A failed send clears its key so a retry can claim it.
create unique index email_log_dedupe_idx on public.email_log (dedupe_key) where dedupe_key is not null;
create index email_log_recipient_idx on public.email_log (recipient_hash, created_at desc);
create index email_log_created_idx on public.email_log (created_at);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
-- Retention: 90 days. No job is created here. To purge by hand or from a scheduler later:
--   delete from public.email_log where created_at < now() - interval '90 days';
--   delete from public.email_webhook_events where received_at < now() - interval '90 days';

-- ---------- 3. per-share email preferences ----------
create table public.care_share_email_prefs (
  share_id            uuid primary key references public.care_shares (id) on delete cascade,
  owner_allows_nudges boolean not null default false,
  supporter_digest    boolean not null default false,
  mute_token_hash     text check (mute_token_hash is null or mute_token_hash ~ '^[0-9a-f]{64}$'),
  digest_token_hash   text check (digest_token_hash is null or digest_token_hash ~ '^[0-9a-f]{64}$'),
  owner_tz            text,
  supporter_tz        text,
  updated_at          timestamptz not null default now()
);
create unique index care_share_email_prefs_mute_idx on public.care_share_email_prefs (mute_token_hash) where mute_token_hash is not null;
create unique index care_share_email_prefs_digest_idx on public.care_share_email_prefs (digest_token_hash) where digest_token_hash is not null;

alter table public.care_share_email_prefs enable row level security;
-- Either party may READ the two flags of a share they belong to. Writes only through the functions below.
create policy "email_prefs_select_parties" on public.care_share_email_prefs
  for select to authenticated
  using (exists (
    select 1 from public.care_shares s
     where s.id = share_id and ((select auth.uid()) = s.owner_id or (select auth.uid()) = s.viewer_id)
  ));
revoke all on public.care_share_email_prefs from anon, authenticated;
-- Column-level: tokens' hashes and time zones are never readable from the browser.
grant select (share_id, owner_allows_nudges, supporter_digest, updated_at) on public.care_share_email_prefs to authenticated;

-- ---------- 4. nudges ("Thinking of you" / "Want to take a walk?") ----------
create table public.care_nudges (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references public.care_shares (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  preset     text not null check (preset in ('Thinking of you', 'Want to take a walk?')),
  created_at timestamptz not null default now(),
  emailed_at timestamptz
);
create index care_nudges_share_idx on public.care_nudges (share_id, created_at desc);
alter table public.care_nudges enable row level security;
create policy "care_nudges_select_parties" on public.care_nudges
  for select to authenticated
  using ((select auth.uid()) = sender_id
         or exists (select 1 from public.care_shares s where s.id = share_id and s.owner_id = (select auth.uid())));
revoke all on public.care_nudges from anon, authenticated;
grant select (id, share_id, sender_id, preset, created_at) on public.care_nudges to authenticated;

-- ---------- 5. waiting-list double opt-in ----------
-- A row is created by the send-email function (service role) when someone asks to join. Consent is
-- recorded in public.waitlist only when the emailed link is used, once, within 48 hours.
create table public.waitlist_confirmations (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  email        text not null
               check (email = lower(email) and length(email) <= 254
                      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  want_ios     boolean not null default false,
  want_android boolean not null default false,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '48 hours',
  used_at      timestamptz,
  check (want_ios or want_android),
  check (expires_at > created_at)
);
create index waitlist_confirmations_email_idx on public.waitlist_confirmations (email, created_at desc);
alter table public.waitlist_confirmations enable row level security;
-- No policies and no grants: no browser role can read or write this table.
revoke all on public.waitlist_confirmations from anon, authenticated;
-- Retention: unused or used rows older than 7 days hold an address for no reason. Purge by hand or later job:
--   delete from public.waitlist_confirmations where created_at < now() - interval '7 days';

-- ---------- helpers ----------
create or replace function public.email_token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
$$;
revoke all on function public.email_token_hash(text) from public, anon, authenticated;

create or replace function public.email_valid_tz(p_tz text) returns text
language sql stable set search_path = '' as $$
  select (select z.name from pg_catalog.pg_timezone_names z where z.name = p_tz limit 1);
$$;
revoke all on function public.email_valid_tz(text) from public, anon, authenticated;

-- ---------- owner: allow or stop gentle notes (default off) ----------
create or replace function public.set_nudge_pref(p_share_id uuid, p_allow boolean, p_tz text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  perform 1 from public.care_shares where id = p_share_id and owner_id = me and status <> 'revoked';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
  insert into public.care_share_email_prefs (share_id, owner_allows_nudges, owner_tz)
  values (p_share_id, coalesce(p_allow, false), public.email_valid_tz(p_tz))
  on conflict (share_id) do update
     set owner_allows_nudges = coalesce(p_allow, false),
         owner_tz = coalesce(public.email_valid_tz(p_tz), public.care_share_email_prefs.owner_tz),
         updated_at = now();
end;
$$;

-- ---------- supporter: weekly summary by email (default off) ----------
create or replace function public.set_digest_pref(p_share_id uuid, p_on boolean, p_tz text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  perform 1 from public.care_shares where id = p_share_id and viewer_id = me and status = 'active';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
  insert into public.care_share_email_prefs (share_id, supporter_digest, supporter_tz)
  values (p_share_id, coalesce(p_on, false), public.email_valid_tz(p_tz))
  on conflict (share_id) do update
     set supporter_digest = coalesce(p_on, false),
         supporter_tz = coalesce(public.email_valid_tz(p_tz), public.care_share_email_prefs.supporter_tz),
         updated_at = now();
end;
$$;

-- ---------- supporter: send one preset nudge (the only way a nudge row is made) ----------
-- Rules, all enforced here: caller is the supporter of an ACTIVE, un-paused share; the owner switched
-- nudges on; the message is one of the two presets; at most one per share per rolling 24 hours.
create or replace function public.send_care_nudge(p_share_id uuid, p_preset text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.care_shares;
  new_id uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_preset is null or p_preset not in ('Thinking of you', 'Want to take a walk?') then
    raise exception 'Choose one of the two messages.' using errcode = '22023';
  end if;
  select * into s from public.care_shares where id = p_share_id and viewer_id = me and status = 'active';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
  if s.paused_at is not null then raise exception 'Notes are not available right now.' using errcode = '42501'; end if;
  if not coalesce((select owner_allows_nudges from public.care_share_email_prefs where share_id = s.id), false) then
    raise exception 'Notes are not turned on for this person.' using errcode = '42501';
  end if;
  -- One at a time per share, so two parallel taps cannot both pass the daily check.
  perform pg_advisory_xact_lock(hashtextextended(s.id::text, 17));
  if exists (select 1 from public.care_nudges where share_id = s.id and created_at > now() - interval '24 hours') then
    raise exception 'A note was already sent today.' using errcode = '54000';
  end if;
  insert into public.care_nudges (share_id, sender_id, preset) values (s.id, me, p_preset) returning id into new_id;
  return new_id;
end;
$$;

-- ---------- links in emails: usable without logging in; the token is the proof ----------
-- Each returns true if a matching, still-valid token was found. They reveal nothing else.
create or replace function public.mute_nudges_by_token(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or length(p_token) not between 16 and 128 then return false; end if;
  update public.care_share_email_prefs
     set owner_allows_nudges = false, updated_at = now()
   where mute_token_hash = public.email_token_hash(p_token);
  return found;
end;
$$;

create or replace function public.unsubscribe_digest_by_token(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or length(p_token) not between 16 and 128 then return false; end if;
  update public.care_share_email_prefs
     set supporter_digest = false, updated_at = now()
   where digest_token_hash = public.email_token_hash(p_token);
  return found;
end;
$$;

-- Double opt-in: the click records consent. One use, 48 hours. A repeat sign-up never rewrites the
-- first consent time (security review M1).
create or replace function public.confirm_waitlist(p_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  c public.waitlist_confirmations;
begin
  if p_token is null or length(p_token) not between 16 and 128 then return false; end if;
  update public.waitlist_confirmations
     set used_at = now()
   where token_hash = public.email_token_hash(p_token) and used_at is null and expires_at > now()
   returning * into c;
  if not found then return false; end if;
  insert into public.waitlist (email, want_ios, want_android, consent_at)
  values (c.email, c.want_ios, c.want_android, now())
  on conflict (email) do update
     set want_ios = public.waitlist.want_ios or excluded.want_ios,
         want_android = public.waitlist.want_android or excluded.want_android,
         updated_at = now();
  return true;
end;
$$;

-- ---------- service role only: what the weekly digest job needs ----------
-- Shares whose supporter asked for the digest, that are active and not paused. days_logged counts the
-- last 7 days on which something the owner SHARES was logged (same rule as shared_days). No values.
create or replace function public.email_digest_inputs()
returns table (share_id uuid, viewer_email text, owner_name text, level text, supporter_tz text, days_logged int)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select s.id, lower(u.email::text), p.full_name,
         case when s.level = 'presence' then 'presence' else 'summary' end,
         e.supporter_tz,
         (select count(*)::int from public.habit_logs h
           where h.user_id = s.owner_id and h.log_date between current_date - 6 and current_date
             and ((s.share_eat and (h.water_liters is not null or h.calories_consumed is not null))
               or (s.share_sleep and (h.sleep_hours is not null or h.time_in_bed_hours is not null or h.awake_minutes is not null))
               or (s.share_move and (h.exercise_minutes is not null or h.steps is not null or h.stand_hours is not null or h.active_calories is not null))
               or (s.share_balance and (h.mood is not null or h.energy is not null or h.stress is not null))))
    from public.care_shares s
    join public.care_share_email_prefs e on e.share_id = s.id and e.supporter_digest
    join auth.users u on u.id = s.viewer_id and u.email_confirmed_at is not null and u.email is not null
    left join public.profiles p on p.id = s.owner_id
   where s.status = 'active' and s.paused_at is null and s.viewer_id is not null;
end;
$$;

-- Trend words for one share, per the care-sharing v2 contract (shared_week_summary): at least 4 logged
-- days this week and 10 in the owner's previous 8 weeks, and a difference of more than 10% of the baseline
-- mean for lower/higher. Raw numbers are never returned. Keep in step with shared_week_summary in 0015.
create or replace function public.email_week_trends(p_share_id uuid)
returns table (pillar text, days_logged int, trend text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.care_shares;
  pil text;
  use_steps boolean;
  wk_logged int; wk_n int; base_n int; wk_mean numeric; base_mean numeric;
begin
  select * into s from public.care_shares where id = p_share_id and status = 'active' and paused_at is null;
  if not found or s.level = 'presence' then return; end if;
  use_steps := exists (select 1 from public.habit_logs h
                        where h.user_id = s.owner_id and h.log_date between current_date - 62 and current_date and h.steps is not null);
  for pil in
    select x from unnest(array[case when s.share_eat then 'eat' end, case when s.share_sleep then 'sleep' end,
                               case when s.share_move then 'move' end, case when s.share_balance then 'balance' end]) as x
     where x is not null
  loop
    select count(*) filter (where d.logged and d.log_date >= current_date - 6),
           count(d.v)  filter (where d.log_date >= current_date - 6),
           avg(d.v)    filter (where d.log_date >= current_date - 6),
           count(d.v)  filter (where d.log_date <  current_date - 6),
           avg(d.v)    filter (where d.log_date <  current_date - 6)
      into wk_logged, wk_n, wk_mean, base_n, base_mean
      from (
        select h.log_date,
               case pil when 'eat' then h.water_liters::numeric
                        when 'sleep' then h.sleep_hours::numeric
                        when 'move' then case when use_steps then h.steps::numeric else h.exercise_minutes::numeric end
                        else h.mood::numeric end as v,
               case pil when 'eat' then (h.water_liters is not null or h.calories_consumed is not null)
                        when 'sleep' then (h.sleep_hours is not null or h.time_in_bed_hours is not null or h.awake_minutes is not null)
                        when 'move' then (h.exercise_minutes is not null or h.steps is not null or h.stand_hours is not null or h.active_calories is not null)
                        else (h.mood is not null or h.energy is not null or h.stress is not null) end as logged
          from public.habit_logs h
         where h.user_id = s.owner_id and h.log_date between current_date - 62 and current_date
      ) d;
    pillar := pil;
    days_logged := coalesce(wk_logged, 0);
    if wk_n >= 4 and base_n >= 10 and base_mean is not null and base_mean > 0 then
      if (wk_mean - base_mean) > 0.10 * base_mean then trend := 'a_little_higher';
      elsif (base_mean - wk_mean) > 0.10 * base_mean then trend := 'a_little_lower';
      else trend := 'about_usual';
      end if;
    else
      trend := 'not_enough_days';
    end if;
    return next;
  end loop;
end;
$$;

-- ---------- who may call what ----------
revoke all on function public.set_nudge_pref(uuid, boolean, text) from public, anon;
revoke all on function public.set_digest_pref(uuid, boolean, text) from public, anon;
revoke all on function public.send_care_nudge(uuid, text) from public, anon;
revoke all on function public.mute_nudges_by_token(text) from public;
revoke all on function public.unsubscribe_digest_by_token(text) from public;
revoke all on function public.confirm_waitlist(text) from public;
revoke all on function public.email_digest_inputs() from public, anon, authenticated;
revoke all on function public.email_week_trends(uuid) from public, anon, authenticated;

grant execute on function public.set_nudge_pref(uuid, boolean, text) to authenticated;
grant execute on function public.set_digest_pref(uuid, boolean, text) to authenticated;
grant execute on function public.send_care_nudge(uuid, text) to authenticated;
-- Link pages work signed out; the token is the proof and is 256 bits.
grant execute on function public.mute_nudges_by_token(text) to anon, authenticated;
grant execute on function public.unsubscribe_digest_by_token(text) to anon, authenticated;
grant execute on function public.confirm_waitlist(text) to anon, authenticated;
grant execute on function public.email_digest_inputs() to service_role;
grant execute on function public.email_week_trends(uuid) to service_role;

-- FOLLOW-UP for Miah, not run here (it would break the current waiting-list form until the form is switched
-- to the send-email 'waitlist_confirm' route): once the form is switched, close the anon path that records
-- consent without proof of address ownership:
--   revoke execute on function public.join_waitlist(text, boolean, boolean, boolean) from anon, authenticated;
