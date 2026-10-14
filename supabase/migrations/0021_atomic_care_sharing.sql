-- DRAFT: live schema/migration drift not yet verified. Apply only after that read-only check.
-- Additive R1/R2 fix. Existing APIs remain for old clients; new UI never falls back to them.
-- Requests contain sharing choices, not health values. Account/share deletion cascades cleanup.
create table public.care_share_invite_requests (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  share_id uuid not null references public.care_shares(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);
alter table public.care_share_invite_requests enable row level security;
revoke all on public.care_share_invite_requests from public, anon, authenticated;

create function public.update_care_share_scope(
  p_id uuid, p_eat boolean, p_sleep boolean, p_move boolean, p_balance boolean, p_level text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_level is null or p_level not in ('presence', 'summary', 'detail') then
    raise exception 'Choose how much they see.' using errcode = '22023';
  end if;
  if not (coalesce(p_eat, false) or coalesce(p_sleep, false) or coalesce(p_move, false) or coalesce(p_balance, false)) then
    raise exception 'Choose at least one pillar to share.' using errcode = '22023';
  end if;
  -- One UPDATE, one transaction. Pause is read/preserved by the database, never a stale UI copy.
  update public.care_shares set share_eat = coalesce(p_eat, false),
    share_sleep = coalesce(p_sleep, false), share_move = coalesce(p_move, false),
    share_balance = coalesce(p_balance, false), level = p_level
    where id = p_id and owner_id = auth.uid() and status <> 'revoked';
  if not found then raise exception 'Share not found.' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_care_share_scope(uuid, boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.update_care_share_scope(uuid, boolean, boolean, boolean, boolean, text) to authenticated;

create function public.invite_care_share_atomic(
  p_request_id uuid, p_email text, p_eat boolean, p_sleep boolean, p_move boolean,
  p_balance boolean, p_level text, p_version int, p_text_hash text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean_email text := lower(btrim(coalesce(p_email, '')));
  request_payload jsonb;
  previous public.care_share_invite_requests%rowtype;
  new_id uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if p_request_id is null then raise exception 'An invitation request ID is required.' using errcode = '22023'; end if;
  request_payload := jsonb_build_object('email', clean_email, 'eat', coalesce(p_eat, false),
    'sleep', coalesce(p_sleep, false), 'move', coalesce(p_move, false), 'balance', coalesce(p_balance, false),
    'level', p_level, 'version', p_version, 'text_hash', p_text_hash);
  -- Same owner lock as create_care_share: serializes concurrent retries and the five-share limit.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  select * into previous from public.care_share_invite_requests
    where owner_id = me and request_id = p_request_id;
  if found then
    if previous.payload is distinct from request_payload then
      raise exception 'This request ID was already used with different choices.' using errcode = '22023';
    end if;
    -- Return original result even after acceptance/revocation. Never resurrect an ended share.
    return previous.share_id;
  end if;
  new_id := public.create_care_share(clean_email, p_eat, p_sleep, p_move, p_balance);
  perform public.update_care_share_scope(new_id, p_eat, p_sleep, p_move, p_balance, p_level);
  perform public.record_consent('share_caregiver', p_version, true, p_text_hash, new_id,
    jsonb_build_object('recipient', clean_email, 'level', p_level,
      'pillars', to_jsonb(array_remove(array[
        case when p_eat then 'Drink' end, case when p_sleep then 'Sleep' end,
        case when p_move then 'Move' end, case when p_balance then 'Balance' end], null))));
  insert into public.care_share_invite_requests(owner_id, request_id, share_id, payload)
    values (me, p_request_id, new_id, request_payload);
  return new_id;
  -- No exception compensation: any error rolls back invitation, scope, ledger and request together.
end;
$$;
revoke all on function public.invite_care_share_atomic(uuid, text, boolean, boolean, boolean, boolean, text, int, text) from public, anon;
grant execute on function public.invite_care_share_atomic(uuid, text, boolean, boolean, boolean, boolean, text, int, text) to authenticated;
