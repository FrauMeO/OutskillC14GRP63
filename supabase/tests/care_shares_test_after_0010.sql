-- Test for migration 0010 (care shares). NOT a migration; rolls back via the deliberate exception.
-- Run after 0010 is applied (it was run on 2026-10-12 and matched the expected line below). A owns the data, B is invited, C is a stranger, D is unconfirmed.
-- Expected: see the RESULT line at the end; every "bad" value must read blocked/0 and every control ok/1+.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  sid uuid; n int;
  invite text := 'FAILED'; self_share text := 'ALLOWED'; bad_email text := 'ALLOWED'; none_picked text := 'ALLOWED';
  dup text := 'ALLOWED'; sixth text := 'ALLOWED';
  c_sees_share int; b_sees_pending int; c_accepts text := 'ALLOWED'; d_accepts text := 'ALLOWED';
  b_accepts text := 'FAILED'; b_days int; b_notes_cols int; b_steps int; b_mood int; b_water numeric;
  c_days int; b_direct_logs int; a_direct_logs int; b_direct_write text := 'ALLOWED'; b_update text := 'ALLOWED';
  b_goals int; b_balance_goals int; before_accept int;
  after_move_off_steps int; after_balance_on_mood int; unlogged_day int;
  c_ends text := 'ALLOWED'; b_range text := 'ALLOWED';
  after_revoke int; b_following int;
begin
  -- Fixtures as the database owner (bypasses RLS): four users, A's data, and A's goals.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'share-a@example.test', now(), '{"full_name":"Alex Owner"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'share-b@example.test', now(), '{}', now(), now()),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'share-c@example.test', now(), '{}', now(), now()),
         (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'share-d@example.test', null, '{}', now(), now());
  insert into public.habit_logs (user_id, log_date, water_liters, sleep_hours, steps, mood, notes)
  values (a, '2026-10-01', 2.0, 7.5, 9000, 4, 'PRIVATE NOTE'),
         (a, '2026-10-02', null, null, null, 3, 'only mood logged');
  insert into public.goals (user_id, goal_type, target_value, unit)
  values (a, 'water', 2, 'liters/day'), (a, 'steps', 8000, 'steps/day'), (a, 'sleep', 7.5, 'hours/night');

  execute 'set local role authenticated';

  -- A invites B
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'share-a@example.test')::text, true);
  sid := public.create_care_share(' Share-B@Example.test ', true, true, true, false); invite := 'ok';
  begin perform public.create_care_share('share-a@example.test', true, true, true, false); exception when others then self_share := 'blocked'; end;
  begin perform public.create_care_share('not-an-email', true, true, true, false); exception when others then bad_email := 'blocked'; end;
  begin perform public.create_care_share('share-c@example.test', false, false, false, false); exception when others then none_picked := 'blocked'; end;
  begin perform public.create_care_share('share-b@example.test', true, true, true, false); exception when others then dup := 'blocked'; end;
  select count(*) into a_direct_logs from public.habit_logs;
  -- fill to the limit of 5 open shares, then the 6th is blocked
  perform public.create_care_share('x1@example.test', true, false, false, false);
  perform public.create_care_share('x2@example.test', true, false, false, false);
  perform public.create_care_share('x3@example.test', true, false, false, false);
  perform public.create_care_share('x4@example.test', true, false, false, false);
  begin perform public.create_care_share('x5@example.test', true, false, false, false); exception when others then sixth := 'blocked'; end;

  -- C (stranger) sees nothing, cannot accept
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'email', 'share-c@example.test')::text, true);
  select count(*) into c_sees_share from public.care_shares;
  begin perform public.accept_care_share(sid); exception when others then c_accepts := 'blocked'; end;
  begin perform public.end_care_share(sid); exception when others then c_ends := 'blocked'; end;
  select count(*) into c_days from public.shared_days(a, '2026-09-01', '2026-10-31');

  -- D has the right email claim? no: D is unconfirmed and has a different address, so cannot accept
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated', 'email', 'share-b@example.test')::text, true);
  begin perform public.accept_care_share(sid); exception when others then d_accepts := 'blocked'; end;

  -- B sees the pending invite, cannot read A's data yet, accepts
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'share-b@example.test')::text, true);
  select count(*) into b_sees_pending from public.care_shares;
  select count(*) into before_accept from public.shared_days(a, '2026-09-01', '2026-10-31');
  perform public.accept_care_share(sid); b_accepts := 'ok';
  select count(*) into b_following from public.followed_people() where status = 'active';

  -- B's view: one day (the mood-only day is hidden because Balance is not shared), no notes column
  select count(*), max(sd.steps), max(sd.mood), max(sd.water_liters) into b_days, b_steps, b_mood, b_water
    from public.shared_days(a, '2026-09-01', '2026-10-31') sd;
  select count(*) into b_notes_cols from pg_proc p, unnest(p.proargnames) as an
   where p.proname = 'shared_days' and p.pronamespace = 'public'::regnamespace and an in ('notes', 'feelings', 'latitude', 'longitude', 'location_name');
  select count(*) into b_direct_logs from public.habit_logs;
  begin insert into public.care_shares (owner_id, viewer_email, status, viewer_id, accepted_at) values (a, 'x@example.test', 'active', b, now()); exception when others then b_direct_write := 'blocked'; end;
  begin perform public.update_care_share(sid, true, true, true, true); exception when others then b_update := 'blocked'; end;
  select count(*) into b_goals from public.shared_goals(a);
  begin perform * from public.shared_days(a, '2020-01-01', '2026-10-31'); exception when others then b_range := 'blocked'; end;

  -- A widens to Balance: B now sees mood, and the mood-only day appears
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'share-a@example.test')::text, true);
  perform public.update_care_share(sid, true, true, true, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'share-b@example.test')::text, true);
  select count(*), max(sd.mood) into n, after_balance_on_mood from public.shared_days(a, '2026-09-01', '2026-10-31') sd;
  unlogged_day := n;

  -- A turns Move off: steps disappear; goals for Move disappear
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'share-a@example.test')::text, true);
  perform public.update_care_share(sid, true, true, false, false);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'share-b@example.test')::text, true);
  select count(sd.steps) into after_move_off_steps from public.shared_days(a, '2026-09-01', '2026-10-31') sd;
  select count(*) into b_balance_goals from public.shared_goals(a) where goal_type = 'steps';

  -- A ends the share: B gets nothing
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'share-a@example.test')::text, true);
  perform public.end_care_share(sid);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'share-b@example.test')::text, true);
  select count(*) into after_revoke from public.shared_days(a, '2026-09-01', '2026-10-31');

  raise exception 'RESULT invite=% self=% bad_email=% none_picked=% dup=% sixth=% | c_sees_share=% c_accepts=% c_ends=% c_days=% d_accepts=% | b_sees_pending=% before_accept=% b_accepts=% b_following=% | b_days=% b_steps=% b_mood=% b_water=% b_forbidden_cols=% b_direct_logs=% a_direct_logs=% b_direct_write=% b_update=% b_goals=% b_range=% | balance_on: days=% mood=% | move_off_steps=% steps_goal_after_move_off=% | after_revoke=%',
    invite, self_share, bad_email, none_picked, dup, sixth, c_sees_share, c_accepts, c_ends, c_days, d_accepts,
    b_sees_pending, before_accept, b_accepts, b_following, b_days, b_steps, b_mood, b_water, b_notes_cols, b_direct_logs, a_direct_logs,
    b_direct_write, b_update, b_goals, b_range, unlogged_day, after_balance_on_mood, after_move_off_steps, b_balance_goals, after_revoke;
end $$;

-- Expected:
-- invite=ok self=blocked bad_email=blocked none_picked=blocked dup=blocked sixth=blocked |
-- c_sees_share=0 c_accepts=blocked c_ends=blocked c_days=0 d_accepts=blocked |
-- b_sees_pending=1 before_accept=0 b_accepts=ok b_following=1 |
-- b_days=1 b_steps=9000 b_mood=(null) b_water=2.0 b_forbidden_cols=0 b_direct_logs=0 a_direct_logs=2(control)
--   b_direct_write=blocked b_update=blocked b_goals=3(water,steps,sleep) b_range=blocked |
-- balance_on: days=2 mood=4 | move_off_steps=0 steps_goal_after_move_off=0 | after_revoke=0
