-- Goals rules test used after migration 0002 (copied from the Prompt 2 build chat).
-- It is NOT a migration. Same rolled-back pattern: read the "RESULT ..." error message.
-- Expected at the time it was run:
--   valid=saved duplicate=blocked (unique) bad_type=blocked (check) out_of_range=blocked (check)
--   replaced_to=7.5 b_sees_a=0 b_own_sleep_goal=saved
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  valid_insert text; dup text := 'ALLOWED'; bad_type text := 'ALLOWED'; bad_range text := 'ALLOWED';
  other_user_same_type text; replaced numeric; b_sees int;
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-test-a@example.test',now(),now()),
    (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-test-b@example.test',now(),now());
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  insert into public.goals (goal_type,target_value,unit) values ('sleep',8,'hours/night');
  valid_insert := 'saved';
  begin insert into public.goals (goal_type,target_value,unit) values ('sleep',7,'hours/night'); exception when unique_violation then dup := 'blocked (unique)'; end;
  begin insert into public.goals (goal_type,target_value,unit) values ('steps',8000,'steps/day'); exception when check_violation then bad_type := 'blocked (check)'; end;
  begin insert into public.goals (goal_type,target_value,unit) values ('water',25,'liters/day'); exception when check_violation then bad_range := 'blocked (check)'; end;
  update public.goals set target_value = 7.5 where goal_type = 'sleep';
  select target_value into replaced from public.goals where goal_type = 'sleep';

  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);
  select count(*) into b_sees from public.goals;
  insert into public.goals (goal_type,target_value,unit) values ('sleep',9,'hours/night');
  other_user_same_type := 'saved';

  raise exception 'RESULT valid=% duplicate=% bad_type=% out_of_range=% replaced_to=% b_sees_a=% b_own_sleep_goal=%',
    valid_insert, dup, bad_type, bad_range, replaced, b_sees, other_user_same_type;
end $$;
