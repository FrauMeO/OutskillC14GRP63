-- Test for migration 0007 (Prompt 3C). NOT a migration; rolls back via the deliberate exception.
-- Expected: setting_default=true offer_only=saved full=saved phq9_without_item9=blocked
--   score_without_date=blocked phq9_28=blocked a_sees=2(control) b_sees=0 b_deletes=0
--   b_insert_as_a=blocked a_deletes_own=2
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  setting boolean; offer text := 'FAILED'; full_row text := 'FAILED';
  partial text := 'blocked'; nodate text := 'blocked'; big text := 'blocked';
  a_sees int; b_sees int; b_del int; b_ins text := 'blocked'; a_del int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reflect-test-a@example.test', '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reflect-test-b@example.test', '{}', now(), now());
  select gentle_checkin_enabled into setting from public.profiles where id = a;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.reflections (offered_on) values ('2026-09-01'); offer := 'saved';
  insert into public.reflections (offered_on, taken_on, phq2_score, phq9_score, phq9_item9) values ('2026-09-20', '2026-09-20', 4, 12, 0); full_row := 'saved';
  begin insert into public.reflections (taken_on, phq9_score) values (current_date, 9); partial := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.reflections (phq2_score) values (2); nodate := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.reflections (taken_on, phq9_score, phq9_item9) values (current_date, 28, 0); big := 'ALLOWED'; exception when check_violation then null; end;
  select count(*) into a_sees from public.reflections;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into b_sees from public.reflections;
  delete from public.reflections; get diagnostics b_del = row_count;
  begin insert into public.reflections (user_id) values (a); b_ins := 'ALLOWED'; exception when others then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.reflections; get diagnostics a_del = row_count;
  raise exception 'RESULT setting_default=% offer_only=% full=% phq9_without_item9=% score_without_date=% phq9_28=% a_sees=% b_sees=% b_deletes=% b_insert_as_a=% a_deletes_own=%',
    setting, offer, full_row, partial, nodate, big, a_sees, b_sees, b_del, b_ins, a_del;
end $$;
