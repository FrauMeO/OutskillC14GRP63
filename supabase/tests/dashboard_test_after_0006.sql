-- Test for migration 0006 (Prompt 4). NOT a migration; rolls back via the deliberate exception.
-- Expected (2026-09-25): valid_row=saved default_source=manual neg_steps=blocked awake_2000=blocked
--   source_fitbit=blocked old_goal=saved new_goal_types_saved=4 steps_goal_50=blocked
--   unknown_goal=blocked duplicate_steps_goal=blocked b_sees_logs=0 b_sees_goals=0
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  valid_row text := 'FAILED'; default_source text; neg_steps text := 'blocked'; awake_big text := 'blocked'; bad_source text := 'blocked';
  new_goals int := 0; steps_low text := 'blocked'; unknown_goal text := 'blocked'; dup_goal text := 'blocked'; old_goal text := 'FAILED';
  b_sees int; b_goals int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dash-test-a@example.test', '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dash-test-b@example.test', '{}', now(), now());
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.habit_logs (log_date, steps, stand_hours, active_calories, time_in_bed_hours, awake_minutes, calories_consumed)
  values ('2026-01-01', 8000, 10, 450, 7.9, 25, 2100);
  valid_row := 'saved';
  select source into default_source from public.habit_logs where log_date = '2026-01-01';
  begin insert into public.habit_logs (log_date, steps) values ('2026-01-02', -5); neg_steps := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, awake_minutes) values ('2026-01-03', 2000); awake_big := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, source) values ('2026-01-04', 'fitbit'); bad_source := 'ALLOWED'; exception when check_violation then null; end;
  insert into public.goals (goal_type, target_value, unit) values ('exercise', 30, 'minutes/day');
  old_goal := 'saved';
  insert into public.goals (goal_type, target_value, unit) values ('steps', 8000, 'steps/day'), ('stand_hours', 12, 'hours/day'), ('active_calories', 500, 'kcal/day'), ('calories_consumed', 2000, 'kcal/day');
  get diagnostics new_goals = row_count;
  begin insert into public.goals (goal_type, target_value, unit) values ('steps', 50, 'steps/day'); steps_low := 'ALLOWED'; exception when others then null; end;
  begin insert into public.goals (goal_type, target_value, unit) values ('flights', 10, 'floors/day'); unknown_goal := 'ALLOWED'; exception when check_violation then null; end;
  begin insert into public.goals (goal_type, target_value, unit) values ('steps', 9000, 'steps/day'); dup_goal := 'ALLOWED'; exception when unique_violation then null; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into b_sees from public.habit_logs;
  select count(*) into b_goals from public.goals;
  raise exception 'RESULT valid_row=% default_source=% neg_steps=% awake_2000=% source_fitbit=% old_goal=% new_goal_types_saved=% steps_goal_50=% unknown_goal=% duplicate_steps_goal=% b_sees_logs=% b_sees_goals=%',
    valid_row, default_source, neg_steps, awake_big, bad_source, old_goal, new_goals, steps_low, unknown_goal, dup_goal, b_sees, b_goals;
end $$;
