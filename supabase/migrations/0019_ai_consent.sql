-- Server-side proof of consent to the AI reflection, and a per-person rate limit (docs/ai-safety-plan.md,
-- section 4, steps 1 and 2; Apple guideline 5.1.2(i); GDPR Art. 7(1)). Additive only.
--
--  * profiles.ai_consent_at / ai_consent_version  when, and to which wording (CONSENT_VERSION in
--    src/lib/aiConsent.ts), the person said yes. Both null = no consent on record.
--  * set_ai_consent(p_granted, p_version)  the signed-in person records or withdraws consent. Withdraw
--    clears both columns. A repeat yes to the same version keeps the first time.
--  * A trigger stops the browser changing those two columns directly (profiles is client-writable),
--    so the only way to set them is set_ai_consent(). The SQL editor and service role are not blocked.
--  * ai_call_log + ai_consume_call(p_version)  the Edge Function (called with the person's own login,
--    never a service key) asks once per request: consent on record for this version? under 20 calls in
--    the last hour? It records the call and answers 'ok', 'no_consent' or 'rate_limited'.
--
-- Why a table and not memory for the rate limit: Edge Function instances are short-lived and run side by
-- side, so an in-memory counter would reset constantly and could be dodged. A small table with an
-- advisory lock per person is one extra query, exact, and has no moving parts. The table has RLS on, no
-- policies and no grants: no browser role can read or write it.
--
-- Same function style as 0010/0014/0016/0017: security definer, search_path = '', revoked from public/anon.

alter table public.profiles
  add column ai_consent_at      timestamptz,
  add column ai_consent_version int check (ai_consent_version is null or ai_consent_version >= 1),
  add constraint profiles_ai_consent_both_or_neither check ((ai_consent_at is null) = (ai_consent_version is null));

-- ---------- record or withdraw ----------
create or replace function public.set_ai_consent(p_granted boolean, p_version int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  hit int;
begin
  if me is null then
    raise exception 'Please log in.' using errcode = '28000';
  end if;
  if p_granted is null then
    raise exception 'Say whether consent is given.' using errcode = '22023';
  end if;

  -- Lets the guard trigger below know this change came through here.
  perform set_config('byp.ai_consent_rpc', '1', true);

  if p_granted then
    if p_version is null or p_version < 1 then
      raise exception 'A consent version is needed.' using errcode = '22023';
    end if;
    update public.profiles
       set ai_consent_at = case
             when ai_consent_version is not distinct from p_version and ai_consent_at is not null then ai_consent_at
             else now()
           end,
           ai_consent_version = p_version
     where id = me;
  else
    update public.profiles set ai_consent_at = null, ai_consent_version = null where id = me;
  end if;
  get diagnostics hit = row_count;
  perform set_config('byp.ai_consent_rpc', '', true);
  if hit = 0 then
    raise exception 'No profile found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_ai_consent(boolean, int) from public, anon;
grant execute on function public.set_ai_consent(boolean, int) to authenticated;

-- ---------- the browser may not edit the consent columns directly ----------
create or replace function public.profiles_guard_ai_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.ai_consent_at is distinct from old.ai_consent_at or new.ai_consent_version is distinct from old.ai_consent_version)
     and (select auth.uid()) is not null
     and coalesce(current_setting('byp.ai_consent_rpc', true), '') <> '1' then
    raise exception 'AI consent can only be changed with set_ai_consent().' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_guard_ai_consent() from public, anon, authenticated;

create trigger profiles_guard_ai_consent
  before update on public.profiles
  for each row execute function public.profiles_guard_ai_consent();

-- ---------- per-person call log (server only) ----------
create table public.ai_call_log (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  called_at timestamptz not null default now()
);
create index ai_call_log_user_time_idx on public.ai_call_log (user_id, called_at desc);
alter table public.ai_call_log enable row level security;
-- No policies and no grants: only ai_consume_call() (security definer) touches this table.
revoke all on public.ai_call_log from anon, authenticated;

-- POLICY: Miah to confirm the limit. 20 calls in any rolling hour for one person.
create or replace function public.ai_consume_call(p_version int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  v_at   timestamptz;
  v_ver  int;
  recent int;
begin
  if me is null then
    raise exception 'Please log in.' using errcode = '28000';
  end if;
  if p_version is null or p_version < 1 then
    raise exception 'A consent version is needed.' using errcode = '22023';
  end if;

  select ai_consent_at, ai_consent_version into v_at, v_ver from public.profiles where id = me;
  if v_at is null or v_ver is null or v_ver < p_version then
    return 'no_consent';
  end if;

  -- One request at a time per person, so two parallel calls cannot both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 19));
  delete from public.ai_call_log where user_id = me and called_at < now() - interval '1 day';
  select count(*) into recent from public.ai_call_log where user_id = me and called_at > now() - interval '1 hour';
  if recent >= 20 then
    return 'rate_limited';
  end if;
  insert into public.ai_call_log (user_id) values (me);
  return 'ok';
end;
$$;

revoke all on function public.ai_consume_call(int) from public, anon;
grant execute on function public.ai_consume_call(int) to authenticated;
