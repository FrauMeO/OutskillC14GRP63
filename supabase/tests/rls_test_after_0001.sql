-- RLS isolation test used after migration 0001 (copied from the Prompt 1 build chat).
-- It is NOT a migration. It creates two throwaway users, runs checks as each one, and then
-- raises an exception on purpose so the whole transaction rolls back and leaves no data.
-- Read the results in the "RESULT ..." error message. Expected at the time it was run:
--   profiles_created=2 a_sees_own=1 b_sees=0 b_rows_updated=0 b_insert_as_a=blocked
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  profiles_made int; a_sees int; b_sees int; b_update int; b_insert_as_a text := 'blocked';
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-a@example.test', '{"full_name":"Test A"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-b@example.test', '{"full_name":"Test B"}', now(), now());
  select count(*) into profiles_made from public.profiles where id in (a,b);

  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.habit_logs (exercise_minutes, sleep_hours, water_liters) values (30, 7.5, 2);
  select count(*) into a_sees from public.habit_logs;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into b_sees from public.habit_logs;
  update public.habit_logs set notes = 'tampered'; get diagnostics b_update = row_count;
  begin
    insert into public.habit_logs (user_id, exercise_minutes) values (a, 99);
    b_insert_as_a := 'ALLOWED';
  exception when others then null;
  end;

  raise exception 'RESULT profiles_created=% a_sees_own=% b_sees=% b_rows_updated=% b_insert_as_a=%',
    profiles_made, a_sees, b_sees, b_update, b_insert_as_a;
end $$;
