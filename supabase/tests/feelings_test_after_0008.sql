-- Test for migration 0008 (13 feelings). NOT a migration; rolls back via the deliberate exception.
-- Expected (2026-09-26): all_13=saved(control) apple_word_content=blocked happy=blocked repeat=blocked
do $$
declare
  a uuid := gen_random_uuid();
  all13 text := 'FAILED'; content_word text := 'blocked'; happy text := 'blocked'; rep text := 'blocked';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feelings13-test@example.test', '{}', now(), now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.habit_logs (log_date, feelings) values ('2026-01-01', array['calm','peaceful','confident','grateful','hopeful','proud','steady','meh','frustrated','overwhelmed','anxious','lonely','tired']);
  all13 := 'saved';
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-02', array['content']); content_word := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-03', array['happy']); happy := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-04', array['meh','meh']); rep := 'ALLOWED'; exception when check_violation then null; end;
  raise exception 'RESULT all_13=% apple_word_content=% happy=% repeat=%', all13, content_word, happy, rep;
end $$;
