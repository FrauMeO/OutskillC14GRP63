-- Test for migration 0019 (AI consent record and rate limit). NOT a migration; rolls back via the deliberate exception.
-- Needs 0001-0018 applied first. Run in the SQL editor or psql.
-- Expected, read the RESULT line (booleans print as t/f; "control" lines prove the check can fail):
--   before_grant_consume=no_consent grant_sets=t grant_version=1 consume_after_grant=ok(control)
--   regrant_keeps_first_time=t new_version_changes_time=t old_version_refused=no_consent
--   withdraw_clears=t consume_after_withdraw=no_consent other_user_untouched=t other_user_withdraw_leaves_mine=t
--   direct_update_blocked=blocked direct_other_column=ok(control) null_granted=blocked bad_version=blocked
--   consume_bad_version=blocked anon_set=blocked anon_consume=blocked
--   twenty_calls_ok=20 call_21=rate_limited other_user_not_limited=ok(control) old_calls_expire=ok(control)
--   call_log_read=blocked call_log_write=blocked log_rows_for_a=20
-- (Verified 2026-10-12 against a scratch local Postgres with stubbed auth/profiles; not yet run on Supabase.)
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  r_before text; r_after text; r_old text; r_withdrawn text; r_21 text; r_b text; r_expire text; r_loop text;
  grant_sets boolean; grant_version int; first_time timestamptz; regrant_keeps boolean; newver_changes boolean;
  withdraw_clears boolean; b_untouched boolean; b_withdraw_leaves boolean;
  r_direct text := 'ALLOWED'; r_other text := 'FAILED'; r_null text := 'ALLOWED'; r_badver text := 'ALLOWED'; r_consume_bad text := 'ALLOWED';
  r_anon_set text := 'ALLOWED'; r_anon_consume text := 'ALLOWED'; r_logread text := 'ALLOWED'; r_logwrite text := 'ALLOWED';
  ok_count int := 0; log_rows int; i int;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-0019@example.test', now(), '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-0019@example.test', now(), '{}', now(), now());

  -- ===== person a, before any consent =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r_before := public.ai_consume_call(1);

  -- ===== grant =====
  perform public.set_ai_consent(true, 1);
  select (ai_consent_at is not null), ai_consent_version, ai_consent_at into grant_sets, grant_version, first_time from public.profiles where id = a;
  r_after := public.ai_consume_call(1);   -- control: consent on record, so it goes through

  -- a repeat yes to the same version keeps the first time; a new version changes it
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);   -- no signed-in person: the SQL editor / service role
  update public.profiles set ai_consent_at = '2026-01-01 00:00+00' where id = a;   -- SQL editor / service role is not blocked
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.set_ai_consent(true, 1);
  select ai_consent_at = '2026-01-01 00:00+00' into regrant_keeps from public.profiles where id = a;
  perform public.set_ai_consent(true, 2);
  select ai_consent_at > '2026-01-01 00:00+00' and ai_consent_version = 2 into newver_changes from public.profiles where id = a;
  -- the server now needs version 3: version 2 is too old
  r_old := public.ai_consume_call(3);

  -- ===== the browser may not edit the columns directly =====
  begin update public.profiles set ai_consent_at = now(), ai_consent_version = 9 where id = a; r_direct := 'ALLOWED'; exception when others then r_direct := 'blocked'; end;
  begin update public.profiles set full_name = 'Anna' where id = a; r_other := 'ok'; exception when others then r_other := 'FAILED'; end;   -- control: other columns still editable

  -- ===== bad arguments =====
  begin perform public.set_ai_consent(null, 1); r_null := 'ALLOWED'; exception when others then r_null := 'blocked'; end;
  begin perform public.set_ai_consent(true, 0); r_badver := 'ALLOWED'; exception when others then r_badver := 'blocked'; end;
  begin perform public.ai_consume_call(null); r_consume_bad := 'ALLOWED'; exception when others then r_consume_bad := 'blocked'; end;

  -- ===== person b: untouched by a; b's withdraw leaves a alone =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select ai_consent_at is null and ai_consent_version is null into b_untouched from public.profiles where id = b;   -- RLS: b sees only b
  perform public.set_ai_consent(false, 1);
  execute 'reset role';
  select ai_consent_version = 2 into b_withdraw_leaves from public.profiles where id = a;

  -- ===== withdraw (a) =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.set_ai_consent(false, 2);
  select ai_consent_at is null and ai_consent_version is null into withdraw_clears from public.profiles where id = a;
  r_withdrawn := public.ai_consume_call(1);

  -- ===== anon is blocked =====
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin perform public.set_ai_consent(true, 1); r_anon_set := 'ALLOWED'; exception when others then r_anon_set := 'blocked'; end;
  begin perform public.ai_consume_call(1); r_anon_consume := 'ALLOWED'; exception when others then r_anon_consume := 'blocked'; end;

  -- ===== rate limit: 20 an hour =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.set_ai_consent(true, 1);
  execute 'reset role';
  delete from public.ai_call_log where user_id = a;   -- start the count clean
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  for i in 1..20 loop
    r_loop := public.ai_consume_call(1);
    if r_loop = 'ok' then ok_count := ok_count + 1; end if;
  end loop;
  r_21 := public.ai_consume_call(1);
  execute 'reset role';
  select count(*) into log_rows from public.ai_call_log where user_id = a and called_at > now() - interval '1 hour';
  execute 'set local role authenticated';

  -- b is not limited by a's calls (control)
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.set_ai_consent(true, 1);
  r_b := public.ai_consume_call(1);

  -- calls older than an hour stop counting (control)
  execute 'reset role';
  update public.ai_call_log set called_at = now() - interval '2 hours' where user_id = a;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  r_expire := public.ai_consume_call(1);

  -- the call log is not readable or writable by a signed-in browser
  begin perform count(*) from public.ai_call_log; r_logread := 'ALLOWED'; exception when others then r_logread := 'blocked'; end;
  begin insert into public.ai_call_log (user_id) values (a); r_logwrite := 'ALLOWED'; exception when others then r_logwrite := 'blocked'; end;

  raise exception 'RESULT before_grant_consume=% grant_sets=% grant_version=% consume_after_grant=% regrant_keeps_first_time=% new_version_changes_time=% old_version_refused=% withdraw_clears=% consume_after_withdraw=% other_user_untouched=% other_user_withdraw_leaves_mine=% direct_update_blocked=% direct_other_column=% null_granted=% bad_version=% consume_bad_version=% anon_set=% anon_consume=% twenty_calls_ok=% call_21=% other_user_not_limited=% old_calls_expire=% call_log_read=% call_log_write=% log_rows_for_a=%',
    r_before, grant_sets, grant_version, r_after, regrant_keeps, newver_changes, r_old, withdraw_clears, r_withdrawn,
    b_untouched, b_withdraw_leaves, r_direct, r_other, r_null, r_badver, r_consume_bad, r_anon_set, r_anon_consume,
    ok_count, r_21, r_b, r_expire, r_logread, r_logwrite, log_rows;
end $$;
