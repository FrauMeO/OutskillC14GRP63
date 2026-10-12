-- Test for migration 0020 (consent ledger, privacy requests, minimum age 18). NOT a migration; it
-- rolls back through the deliberate exception at the end. Run after 0020 is applied.
-- Every "blocked" has a matching control that shows the same step succeeding when it should.
-- Expected result line (RESULT then these, in this order; split here for reading):
--  age18_ok=ok age_17y11m=blocked age_16y=blocked age_none_ok=ok name40=40 birth_one_only=null mkt_flag=true health_flag=set
--  anon_record=blocked grant_ok=ok bad_kind=blocked bad_version=blocked bad_hash_upper=blocked bad_hash_short=blocked
--  null_granted=blocked share_no_id=blocked share_not_mine=blocked share_mine=ok id_on_non_share=blocked details_array=blocked
--  latest_after_withdraw=false mkt_flag_after_withdraw=false latest_after_regrant=true mkt_flag_after_regrant=true
--  health_flag_after_withdraw=null kinds_in_my_consents=2 share_rows_in_my_consents=1
--  client_insert=blocked client_update=blocked client_delete=blocked rows_unchanged=true
--  rate_limit_60=ok rate_limit_61=blocked b_direct_select=0 b_my_consents=0 a_direct_select_control=ok
--  owner_update=blocked owner_truncate=blocked
--  anon_request=blocked req_ok=ok due_days=30 due_is_not_45=true bad_type=blocked correct_needs_details=blocked toolong=blocked
--  open_5=ok open_6=blocked notes_read=blocked client_request_insert=blocked my_requests_has_no_notes=true
--  a_sees_own_requests=ok b_cannot_see_a_requests=0
--  a_consents_before=6 a_consents_after=0 b_consents_after=1 requests_kept=1 request_user_null=true request_details_null=true request_type_kept=delete
-- Checked 2026-10-12 against a scratch local PostgreSQL 17 with stub auth/anon/authenticated roles and migrations 0001-0018 + 0020
-- (NOT against the live project): output matched this line exactly.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  u18 uuid := gen_random_uuid(); u17 uuid := gen_random_uuid(); u16 uuid := gen_random_uuid(); un uuid := gen_random_uuid();
  um uuid := gen_random_uuid();
  r text := ''; n int; n2 int; v boolean; s text; share_a uuid; share_b uuid;
  d date := (current_date - interval '18 years')::date;
  d_young date := (date_trunc('month', (current_date - interval '18 years')::date) + interval '1 month')::date;
  cnt_before int; cnt_after int; ts timestamptz; due timestamptz; i int; reqs_before int;
begin
  -- ===== age 18 =====
  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (u18, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k18@example.test',
            json_build_object('birth_month', extract(month from d)::int::text, 'birth_year', extract(year from d)::int::text)::jsonb, now(), now());
    r := r || ' age18_ok=ok';
  exception when others then r := r || ' age18_ok=BLOCKED'; end;

  begin
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (u17, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k17@example.test',
            json_build_object('birth_month', extract(month from d_young)::int::text, 'birth_year', extract(year from d_young)::int::text)::jsonb, now(), now());
    r := r || ' age_17y11m=ALLOWED';
  exception when others then r := r || ' age_17y11m=blocked'; end;

  begin  -- the old limit: exactly 16 years old must now be refused
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (u16, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'k16@example.test',
            json_build_object('birth_month', extract(month from (current_date - interval '16 years'))::int::text,
                              'birth_year', extract(year from (current_date - interval '16 years'))::int::text)::jsonb, now(), now());
    r := r || ' age_16y=ALLOWED';
  exception when others then r := r || ' age_16y=blocked'; end;

  begin  -- no birth date at all still works (accounts made before 0016, and the optional path)
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (un, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'knone@example.test', '{}', now(), now());
    r := r || ' age_none_ok=ok';
  exception when others then r := r || ' age_none_ok=BLOCKED'; end;

  -- behaviours kept from 0016 / 0013: name capped at 40, month alone is dropped, flags copied
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (um, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kmeta@example.test',
          json_build_object('full_name', repeat('a', 60), 'birth_month', '5', 'marketing_opt_in', 'true', 'health_consent', 'true')::jsonb, now(), now());
  r := r || ' name40=' || (select length(full_name) from public.profiles where id = um);
  r := r || ' birth_one_only=' || coalesce((select birth_year::text from public.profiles where id = um), 'null');
  r := r || ' mkt_flag=' || (select marketing_opt_in::text from public.profiles where id = um);
  r := r || ' health_flag=' || (select case when health_consent_at is not null then 'set' else 'null' end from public.profiles where id = um);

  -- ===== users for the ledger tests =====
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'led-a@example.test', now(), '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'led-b@example.test', now(), '{}', now(), now()),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'led-c@example.test', now(), '{}', now(), now());
  insert into public.care_shares (owner_id, viewer_email) values (a, 'viewer-a@example.test') returning id into share_a;
  insert into public.care_shares (owner_id, viewer_email) values (b, 'viewer-b@example.test') returning id into share_b;

  -- anon cannot record
  execute 'set local role anon';
  begin perform public.record_consent('collect_use', 1, true, repeat('a', 64)); r := r || ' anon_record=ALLOWED';
  exception when others then r := r || ' anon_record=blocked'; end;

  -- ===== user A =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'led-a@example.test')::text, true);

  begin perform public.record_consent('collect_use', 1, true, repeat('a', 64)); r := r || ' grant_ok=ok';
  exception when others then r := r || ' grant_ok=FAILED:' || sqlerrm; end;
  begin perform public.record_consent('sell_my_data', 1, true, repeat('a', 64)); r := r || ' bad_kind=ALLOWED';
  exception when others then r := r || ' bad_kind=blocked'; end;
  begin perform public.record_consent('collect_use', 0, true, repeat('a', 64)); r := r || ' bad_version=ALLOWED';
  exception when others then r := r || ' bad_version=blocked'; end;
  begin perform public.record_consent('collect_use', 1, true, repeat('A', 64)); r := r || ' bad_hash_upper=ALLOWED';
  exception when others then r := r || ' bad_hash_upper=blocked'; end;
  begin perform public.record_consent('collect_use', 1, true, 'abc'); r := r || ' bad_hash_short=ALLOWED';
  exception when others then r := r || ' bad_hash_short=blocked'; end;
  begin perform public.record_consent('collect_use', 1, null, repeat('a', 64)); r := r || ' null_granted=ALLOWED';
  exception when others then r := r || ' null_granted=blocked'; end;
  begin perform public.record_consent('share_caregiver', 1, true, repeat('b', 64)); r := r || ' share_no_id=ALLOWED';
  exception when others then r := r || ' share_no_id=blocked'; end;
  begin perform public.record_consent('share_caregiver', 1, true, repeat('b', 64), share_b); r := r || ' share_not_mine=ALLOWED';
  exception when others then r := r || ' share_not_mine=blocked'; end;
  begin perform public.record_consent('share_caregiver', 1, true, repeat('b', 64), share_a, '{"level":"summary","pillars":["sleep"]}'::jsonb); r := r || ' share_mine=ok';
  exception when others then r := r || ' share_mine=FAILED:' || sqlerrm; end;
  begin perform public.record_consent('ai_processing', 1, true, repeat('c', 64), share_a); r := r || ' id_on_non_share=ALLOWED';
  exception when others then r := r || ' id_on_non_share=blocked'; end;
  begin perform public.record_consent('ai_processing', 1, true, repeat('c', 64), null, '[1]'::jsonb); r := r || ' details_array=ALLOWED';
  exception when others then r := r || ' details_array=blocked'; end;

  -- state: grant, withdraw, re-grant of email_marketing; my_consents shows the latest
  perform public.record_consent('email_marketing', 1, true, repeat('d', 64));
  perform public.record_consent('email_marketing', 1, false, repeat('d', 64));
  select granted into v from public.my_consents() where kind = 'email_marketing';
  r := r || ' latest_after_withdraw=' || v;
  execute 'reset role';
  r := r || ' mkt_flag_after_withdraw=' || (select marketing_opt_in::text from public.profiles where id = a);
  execute 'set local role authenticated';
  perform public.record_consent('email_marketing', 1, true, repeat('d', 64));
  select granted into v from public.my_consents() where kind = 'email_marketing';
  r := r || ' latest_after_regrant=' || v;
  execute 'reset role';
  r := r || ' mkt_flag_after_regrant=' || (select marketing_opt_in::text from public.profiles where id = a);
  execute 'set local role authenticated';
  perform public.record_consent('collect_use', 1, false, repeat('a', 64));
  execute 'reset role';
  r := r || ' health_flag_after_withdraw=' || (select case when health_consent_at is not null then 'set' else 'null' end from public.profiles where id = a);
  execute 'set local role authenticated';
  select count(*) into n from public.my_consents() where share_id is null;      -- collect_use, email_marketing (ai never granted)
  select count(*) into n2 from public.my_consents() where share_id is not null;
  r := r || ' kinds_in_my_consents=' || n || ' share_rows_in_my_consents=' || n2;   -- collect_use and email_marketing; ai was never granted

  -- append-only for clients
  select count(*) into cnt_before from public.consents;
  begin insert into public.consents (user_id, kind, version, granted, text_hash) values (a, 'collect_use', 1, true, repeat('a', 64)); r := r || ' client_insert=ALLOWED';
  exception when others then r := r || ' client_insert=blocked'; end;
  begin update public.consents set granted = not granted; r := r || ' client_update=ALLOWED';
  exception when others then r := r || ' client_update=blocked'; end;
  begin delete from public.consents; r := r || ' client_delete=ALLOWED';
  exception when others then r := r || ' client_delete=blocked'; end;
  select count(*) into cnt_after from public.consents;
  r := r || ' rows_unchanged=' || (cnt_before = cnt_after);

  -- rate limit: user C, 60 rows fine, the 61st refused (control: the first 60 succeeded)
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'email', 'led-c@example.test')::text, true);
  begin
    for i in 1..60 loop perform public.record_consent('ai_processing', 1, (i % 2 = 0), repeat('e', 64)); end loop;
    r := r || ' rate_limit_60=ok';
  exception when others then r := r || ' rate_limit_60=FAILED:' || sqlerrm; end;
  begin perform public.record_consent('ai_processing', 1, true, repeat('e', 64)); r := r || ' rate_limit_61=ALLOWED';
  exception when others then r := r || ' rate_limit_61=blocked'; end;

  -- ===== user B cannot see A =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'led-b@example.test')::text, true);
  perform public.record_consent('collect_use', 1, true, repeat('a', 64));      -- B has exactly one row, so "0" below is meaningful
  select count(*) into n from public.consents where user_id = a;
  r := r || ' b_direct_select=' || n;
  select count(*) into n from public.my_consents() where kind <> 'collect_use';
  r := r || ' b_my_consents=' || n;
  -- control: A sees A's own rows
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'led-a@example.test')::text, true);
  select count(*) into n from public.consents where user_id = a;
  r := r || ' a_direct_select_control=' || case when n >= 5 then 'ok' else 'EMPTY' end;

  -- ===== the owner cannot edit either (trigger), even past the privileges =====
  execute 'reset role';
  begin update public.consents set granted = not granted where user_id = a; r := r || ' owner_update=ALLOWED';
  exception when others then r := r || ' owner_update=blocked'; end;
  begin truncate public.consents; r := r || ' owner_truncate=ALLOWED';
  exception when others then r := r || ' owner_truncate=blocked'; end;

  -- ===== privacy requests =====
  execute 'set local role anon';
  begin perform * from public.create_privacy_request('access'); r := r || ' anon_request=ALLOWED';
  exception when others then r := r || ' anon_request=blocked'; end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'led-a@example.test')::text, true);
  begin
    select request_created_at, request_due_at into ts, due from public.create_privacy_request('access', null);
    r := r || ' req_ok=ok';
    r := r || ' due_days=' || extract(day from (due - ts))::int;
    r := r || ' due_is_not_45=' || (due - ts <> interval '45 days');
  exception when others then r := r || ' req_ok=FAILED:' || sqlerrm; end;
  begin perform * from public.create_privacy_request('sell', null); r := r || ' bad_type=ALLOWED';
  exception when others then r := r || ' bad_type=blocked'; end;
  begin perform * from public.create_privacy_request('correct', '  '); r := r || ' correct_needs_details=ALLOWED';
  exception when others then r := r || ' correct_needs_details=blocked'; end;
  begin perform * from public.create_privacy_request('access', repeat('x', 2001)); r := r || ' toolong=ALLOWED';
  exception when others then r := r || ' toolong=blocked'; end;
  -- 5 open allowed (one already exists), the 6th refused
  begin
    perform * from public.create_privacy_request('correct', 'My name is wrong');
    perform * from public.create_privacy_request('object', 'Please stop using my data for this');
    perform * from public.create_privacy_request('list_third_parties', null);
    perform * from public.create_privacy_request('delete', 'Please delete my account data');
    r := r || ' open_5=ok';
  exception when others then r := r || ' open_5=FAILED:' || sqlerrm; end;
  begin perform * from public.create_privacy_request('appeal', 'I disagree'); r := r || ' open_6=ALLOWED';
  exception when others then r := r || ' open_6=blocked'; end;
  begin perform notes from public.privacy_requests; r := r || ' notes_read=ALLOWED';
  exception when others then r := r || ' notes_read=blocked'; end;
  begin insert into public.privacy_requests (user_id, request_type) values (a, 'access'); r := r || ' client_request_insert=ALLOWED';
  exception when others then r := r || ' client_request_insert=blocked'; end;
  r := r || ' my_requests_has_no_notes=' || (not exists (
    select 1 from pg_proc p, unnest(p.proargnames) as nm
     where p.proname = 'my_privacy_requests' and p.pronamespace = 'public'::regnamespace and nm = 'notes'));
  select count(*) into n from public.my_privacy_requests();
  r := r || ' a_sees_own_requests=' || case when n = 5 then 'ok' else 'WRONG_' || n end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'led-b@example.test')::text, true);
  select count(*) into n from public.my_privacy_requests();
  r := r || ' b_cannot_see_a_requests=' || n;

  -- ===== delete_my_account: ledger cascades, the request stays but is anonymised =====
  execute 'reset role';
  select count(*) into n from public.consents where user_id = a;
  r := r || ' a_consents_before=' || n;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'led-a@example.test')::text, true);
  perform public.delete_my_account();
  execute 'reset role';
  select count(*) into n from public.consents where user_id = a;
  select count(*) into n2 from public.consents where user_id = b;
  r := r || ' a_consents_after=' || n || ' b_consents_after=' || n2;
  -- after the delete, A's five requests have no user and no words; keep one delete-type row to inspect
  select count(*) into n from public.privacy_requests where user_id is null and details is null and request_type = 'delete';
  r := r || ' requests_kept=' || n;
  r := r || ' request_user_null=' || (not exists (select 1 from public.privacy_requests where request_type = 'delete' and user_id is not null));
  r := r || ' request_details_null=' || (not exists (select 1 from public.privacy_requests where request_type = 'delete' and details is not null));
  r := r || ' request_type_kept=' || (select request_type from public.privacy_requests where request_type = 'delete' limit 1);

  raise exception 'RESULT%', r;
end $$;
