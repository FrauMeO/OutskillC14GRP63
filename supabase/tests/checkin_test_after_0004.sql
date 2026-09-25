-- Test for migration 0004 (Prompt 3A). NOT a migration. Same pattern as rls_test_after_0001.sql:
-- two throwaway users, checks as each, then a deliberate exception rolls everything back.
-- Expected:
--   home_saved=Philadelphia/US/40.0/-75.2 bad_meta_profile=1 bad_meta_home=null
--   valid_row=saved(control) mood_6=blocked feeling_unknown=blocked feeling_repeat=blocked
--   location_source_bad=blocked a_sees_conditions=1(control) b_sees_conditions=0
--   b_updates_conditions=0 b_insert_as_a=blocked b_sees_a_checkin=0
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  home text; bad_profiles int; bad_home text;
  valid_row text := 'FAILED';
  mood_6 text := 'blocked'; feeling_unknown text := 'blocked'; feeling_repeat text := 'blocked';
  source_bad text := 'blocked';
  a_sees int; b_sees int; b_update int; b_insert_as_a text := 'blocked'; b_sees_checkin int;
begin
  -- Sign-up trigger: good metadata is copied and rounded; bad metadata must not break sign-up.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkin-test-a@example.test',
     '{"full_name":"Test A","home_city":"Philadelphia","home_country_code":"us","home_latitude":"39.95","home_longitude":"-75.16"}', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkin-test-b@example.test',
     '{"full_name":"Test B"}', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'checkin-test-c@example.test',
     '{"full_name":"Test C","home_country_code":"USA","home_latitude":"north","home_longitude":"999"}', now(), now());
  select home_city || '/' || home_country_code || '/' || home_latitude || '/' || home_longitude
    into home from public.profiles where id = a;
  select count(*), coalesce(max(home_country_code || home_latitude || home_longitude), 'null')
    into bad_profiles, bad_home from public.profiles where id = c;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  -- Control: a fully valid check-in row saves.
  insert into public.habit_logs (log_date, mood, energy, stress, feelings, location_name, latitude, longitude, location_source)
  values ('2026-01-01', 4, 3, 2, array['happy', 'stable'], 'Philadelphia', 39.95, -75.16, 'home');
  valid_row := 'saved';

  begin insert into public.habit_logs (log_date, mood) values ('2026-01-02', 6); mood_6 := 'ALLOWED';
  exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-03', array['joyful']); feeling_unknown := 'ALLOWED';
  exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, feelings) values ('2026-01-04', array['happy', 'happy']); feeling_repeat := 'ALLOWED';
  exception when check_violation then null; end;
  begin insert into public.habit_logs (log_date, location_source) values ('2026-01-05', 'gps'); source_bad := 'ALLOWED';
  exception when check_violation then null; end;

  insert into public.daily_conditions (date, latitude, longitude, rain_mm, moon_illumination, is_final)
  values ('2026-01-01', 40.0, -75.2, 3.1, 0.5, true);
  select count(*) into a_sees from public.daily_conditions;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into b_sees from public.daily_conditions;
  update public.daily_conditions set rain_mm = 0; get diagnostics b_update = row_count;
  begin
    insert into public.daily_conditions (user_id, date, latitude, longitude) values (a, '2026-01-02', 40.0, -75.2);
    b_insert_as_a := 'ALLOWED';
  exception when others then null;
  end;
  select count(*) into b_sees_checkin from public.habit_logs where mood is not null;

  raise exception 'RESULT home_saved=% bad_meta_profile=% bad_meta_home=% valid_row=% mood_6=% feeling_unknown=% feeling_repeat=% location_source_bad=% a_sees_conditions=% b_sees_conditions=% b_updates_conditions=% b_insert_as_a=% b_sees_a_checkin=%',
    home, bad_profiles, bad_home, valid_row, mood_6, feeling_unknown, feeling_repeat, source_bad,
    a_sees, b_sees, b_update, b_insert_as_a, b_sees_checkin;
end $$;
