-- Test for migration 0005 (feelings use Apple State of Mind labels). NOT a migration.
-- Rolls back via the deliberate exception. Expected (2026-09-25):
--   all_six=saved(control) old_word_happy=blocked other_apple_label=blocked repeat=blocked
do $$
declare
  a uuid := gen_random_uuid();
  all_six text := 'FAILED'; old_word text := 'blocked'; other_apple text := 'blocked'; repeat text := 'blocked';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feelings-test@example.test', '{}', now(), now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.habit_logs (log_date, feelings) values ('2026-01-01', array['frustrated','overwhelmed','calm','peaceful','confident','grateful']);
  all_six := 'saved';
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-02', array['happy']); old_word := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-03', array['joyful']); other_apple := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-04', array['calm','calm']); repeat := 'ALLOWED'; exception when check_violation then null; end;
  raise exception 'RESULT all_six=% old_word_happy=% other_apple_label=% repeat=%', all_six, old_word, other_apple, repeat;
end $$;
