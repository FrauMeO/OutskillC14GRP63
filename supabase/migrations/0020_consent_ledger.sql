-- Consent ledger, privacy requests, and minimum age 18 (Miah's decisions, 2026-10-12).
-- Spec: docs/privacy-consent-spec.md. Standard: docs/privacy-standard.md. WRITTEN, NOT APPLIED:
-- Miah's main session applies it and runs supabase/tests/consent_ledger_test_after_0020.sql.
-- Additive, except that handle_new_user() is replaced (same behaviour as 0016, minimum age 16 -> 18).
--
-- 1. public.consents: append-only ledger, one row per grant or withdrawal. Written ONLY by
--    record_consent() (security definer, never trusts a client user_id). Clients may read their own
--    rows and nothing else. Rows are removed only when the account is deleted (cascade).
--    Kinds (spec section 2): collect_use, share_caregiver, ai_processing, email_marketing.
--    share_id names the care share for share_caregiver (the recipient is that share's viewer_email);
--    details holds what was agreed to at that moment (pillars, level, recipient), written by the owner.
-- 2. my_consents(): the latest state per kind (per share for share_caregiver).
-- 3. public.privacy_requests + create_privacy_request() + my_privacy_requests(): rights requests with
--    a 30-day due date (stricter than Washington's 45; Miah, 2026-10-12). Max 5 open per person.
--    These rows are KEPT when an account is deleted (the request log is evidence, spec section 7) but
--    lose their link to the person and their free text, so nothing identifying remains.
-- 4. handle_new_user(): minimum age 18 (DPDP treats under-18s as children). Everything else is
--    copied from 0016/0013: one display name of at most 40 characters, birth month and year both or
--    neither, optional home city (rounded), marketing opt-in and health-consent flags from metadata.
--    Accounts that already exist are not touched (a 16- or 17-year-old account stays; see the report).
--
-- NOT done here (see the spec, section 3 notes 1, 3, 4): a consent_texts table that checks the hash
-- against the stored wording, insert policies on habit_logs / goals / reflections that need
-- collect_use, and the AI gate in the edge function. record_consent validates the hash FORMAT only.

-- ---------- 1. consents (append-only) ----------
create table public.consents (
  id         bigint generated always as identity primary key,   -- orders rows within one transaction too
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('collect_use', 'share_caregiver', 'ai_processing', 'email_marketing')),
  version    int  not null check (version between 1 and 1000),
  granted    boolean not null,
  text_hash  text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  share_id   uuid,                                               -- set only for share_caregiver
  details    jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and length(details::text) <= 2000),
  created_at timestamptz not null default now(),
  check ((kind = 'share_caregiver') = (share_id is not null))
);
create index consents_user_idx on public.consents (user_id, kind, id desc);

alter table public.consents enable row level security;
create policy "consents_select_own" on public.consents
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;

-- Belt and braces on top of the revoked privileges: nobody, not even the table owner, edits a row.
create or replace function public.consents_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Consent records cannot be changed.' using errcode = '42501';
end;
$$;
revoke execute on function public.consents_append_only() from public, anon, authenticated;
create trigger consents_no_update before update on public.consents
  for each row execute function public.consents_append_only();
create trigger consents_no_truncate before truncate on public.consents
  for each statement execute function public.consents_append_only();

create or replace function public.record_consent(
  p_kind text,
  p_version int,
  p_granted boolean,
  p_text_hash text,
  p_share_id uuid default null,
  p_details jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_details jsonb := coalesce(p_details, '{}'::jsonb);
  v_id      bigint;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_kind is null or p_kind not in ('collect_use', 'share_caregiver', 'ai_processing', 'email_marketing') then
    raise exception 'That choice is not one we record.' using errcode = '22023';
  end if;
  if p_version is null or p_version not between 1 and 1000 then
    raise exception 'That wording version is not valid.' using errcode = '22023';
  end if;
  if p_granted is null then raise exception 'Say whether you agree or take it back.' using errcode = '22023'; end if;
  if p_text_hash is null or p_text_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'The wording check code is not valid.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_details) <> 'object' or length(v_details::text) > 2000 then
    raise exception 'The extra details are not valid.' using errcode = '22023';
  end if;

  if p_kind = 'share_caregiver' then
    if p_share_id is null then raise exception 'Say which share this is for.' using errcode = '22023'; end if;
    if not exists (select 1 from public.care_shares s where s.id = p_share_id and s.owner_id = v_uid) then
      raise exception 'That share is not yours.' using errcode = '42501';
    end if;
  elsif p_share_id is not null then
    raise exception 'Only sharing choices name a share.' using errcode = '22023';
  end if;

  -- A person cannot flood their own ledger.
  if (select count(*) from public.consents c where c.user_id = v_uid and c.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'That is a lot of changes at once. Please wait a little and try again.' using errcode = '54000';
  end if;

  insert into public.consents (user_id, kind, version, granted, text_hash, share_id, details)
  values (v_uid, p_kind, p_version, p_granted, p_text_hash, p_share_id, v_details)
  returning id into v_id;

  -- Keep the existing flags in step so a withdrawal is effective at once. The ledger is the record;
  -- these columns are what other code already reads.
  if p_kind = 'email_marketing' then
    update public.profiles
       set marketing_opt_in_at = case when marketing_opt_in is distinct from p_granted then now() else marketing_opt_in_at end,
           marketing_opt_in = p_granted
     where id = v_uid;
  elsif p_kind = 'collect_use' then
    update public.profiles
       set health_consent_at = case when p_granted then coalesce(health_consent_at, now()) else null end
     where id = v_uid;
  end if;

  return v_id;
end;
$$;
revoke all on function public.record_consent(text, int, boolean, text, uuid, jsonb) from public, anon;
grant execute on function public.record_consent(text, int, boolean, text, uuid, jsonb) to authenticated;

-- Latest row per kind (per share for share_caregiver). Runs as the caller, so row level security
-- still applies; the user_id filter is there for clarity.
create or replace function public.my_consents()
returns table (kind text, version int, granted boolean, share_id uuid, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (c.kind, c.share_id) c.kind, c.version, c.granted, c.share_id, c.created_at
    from public.consents c
   where c.user_id = (select auth.uid())
   order by c.kind, c.share_id, c.id desc;
$$;
revoke all on function public.my_consents() from public, anon;
grant execute on function public.my_consents() to authenticated;

-- ---------- 3. privacy_requests ----------
create table public.privacy_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  request_type     text not null check (request_type in
                     ('access', 'delete', 'correct', 'restrict', 'object', 'withdraw', 'list_third_parties', 'appeal')),
  details          text check (length(details) <= 2000),
  status           text not null default 'open' check (status in ('open', 'answered', 'declined', 'withdrawn')),
  created_at       timestamptz not null default now(),
  due_at           timestamptz not null default (now() + interval '30 days'),
  extended_at      timestamptz,
  extended_due_at  timestamptz check (extended_due_at is null or extended_due_at <= created_at + interval '60 days'),
  answered_at      timestamptz,
  outcome          text check (outcome in ('done', 'partly', 'declined', 'withdrawn_by_requester')),
  notes            text                                           -- founders only; never granted to clients
);
create index privacy_requests_user_idx on public.privacy_requests (user_id, created_at desc);
create index privacy_requests_due_idx on public.privacy_requests (due_at) where status = 'open';

alter table public.privacy_requests enable row level security;
create policy "privacy_requests_select_own" on public.privacy_requests
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.privacy_requests from anon, authenticated;
-- Column grant, so the founders' notes can never be read from the browser.
grant select (id, user_id, request_type, details, status, created_at, due_at, extended_due_at, answered_at, outcome)
  on public.privacy_requests to authenticated;

-- When an account is deleted the request stays, minus the person and their words.
create or replace function public.scrub_privacy_requests() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.privacy_requests set details = null where user_id = old.id;
  return old;
end;
$$;
revoke execute on function public.scrub_privacy_requests() from public, anon, authenticated;
create trigger scrub_privacy_requests_on_user_delete before delete on auth.users
  for each row execute function public.scrub_privacy_requests();

create or replace function public.create_privacy_request(p_type text, p_details text default null)
returns table (request_id uuid, request_created_at timestamptz, request_due_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_id      uuid;
  v_created timestamptz;
  v_due     timestamptz;
begin
  if v_uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_type is null or p_type not in ('access', 'delete', 'correct', 'restrict', 'object', 'withdraw', 'list_third_parties', 'appeal') then
    raise exception 'Please choose what you are asking for.' using errcode = '22023';
  end if;
  if v_details is not null and length(v_details) > 2000 then
    raise exception 'Please keep it to 2000 characters or fewer.' using errcode = '22023';
  end if;
  if p_type in ('correct', 'restrict', 'object', 'appeal') and v_details is null then
    raise exception 'Please tell us a little about your request.' using errcode = '22023';
  end if;

  -- One request at a time per person through this check (the limit would race otherwise).
  perform pg_advisory_xact_lock(hashtextextended('privacy_request:' || v_uid::text, 0));
  if (select count(*) from public.privacy_requests r where r.user_id = v_uid and r.status = 'open') >= 5 then
    raise exception 'You already have 5 open requests. We will answer those first.' using errcode = '54000';
  end if;

  insert into public.privacy_requests (user_id, request_type, details)
  values (v_uid, p_type, v_details)
  returning id, created_at, due_at into v_id, v_created, v_due;

  return query select v_id, v_created, v_due;
end;
$$;
revoke all on function public.create_privacy_request(text, text) from public, anon;
grant execute on function public.create_privacy_request(text, text) to authenticated;

create or replace function public.my_privacy_requests()
returns table (id uuid, request_type text, details text, status text, created_at timestamptz,
               due_at timestamptz, extended_due_at timestamptz, answered_at timestamptz, outcome text)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.request_type, r.details, r.status, r.created_at, r.due_at, r.extended_due_at, r.answered_at, r.outcome
    from public.privacy_requests r
   where r.user_id = (select auth.uid())
   order by r.created_at desc, r.id;
$$;
revoke all on function public.my_privacy_requests() from public, anon;
grant execute on function public.my_privacy_requests() to authenticated;

-- ---------- 4. sign-up trigger: minimum age 18 ----------
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
  mkt  boolean := (meta ->> 'marketing_opt_in') = 'true';
  hc   boolean := (meta ->> 'health_consent') = 'true';
  bm   int;
  byr  int;
begin
  if meta ->> 'home_latitude'  ~ '^-?[0-9]+(\.[0-9]+)?$' then lat := round((meta ->> 'home_latitude')::numeric, 1); end if;
  if meta ->> 'home_longitude' ~ '^-?[0-9]+(\.[0-9]+)?$' then lon := round((meta ->> 'home_longitude')::numeric, 1); end if;
  if lat is not null and lat not between -90 and 90 then lat := null; end if;
  if lon is not null and lon not between -180 and 180 then lon := null; end if;
  if cc !~ '^[A-Z]{2}$' then cc := null; end if;

  if meta ->> 'birth_month' ~ '^[0-9]{1,2}$' then bm := (meta ->> 'birth_month')::int; end if;
  if meta ->> 'birth_year'  ~ '^[0-9]{4}$'   then byr := (meta ->> 'birth_year')::int; end if;
  if bm is not null and bm not between 1 and 12 then bm := null; end if;
  if byr is not null and byr not between 1900 and extract(year from current_date)::int then byr := null; end if;
  if bm is null or byr is null then bm := null; byr := null; end if;
  if byr is not null and make_date(byr, bm, 1) > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to use Build Your Pillars.' using errcode = '22023';
  end if;

  insert into public.profiles (id, full_name, home_city, home_country_code, home_latitude, home_longitude,
                               marketing_opt_in, marketing_opt_in_at, health_consent_at, birth_month, birth_year)
  values (
    new.id,
    nullif(left(btrim(meta ->> 'full_name'), 40), ''),
    nullif(meta ->> 'home_city', ''),
    cc,
    lat,
    lon,
    coalesce(mkt, false),
    case when mkt then now() end,
    case when hc then now() end,
    bm,
    byr
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
