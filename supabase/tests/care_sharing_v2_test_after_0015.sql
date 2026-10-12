-- Test for migration 0015 (care sharing v2). NOT a migration; rolls back via the deliberate exception.
-- Run after 0015 is applied. A owns the data and invites B. C is a stranger. E follows a different owner F
-- (a viewer of a different share). Dates are relative to current_date, the same clock the functions use.
-- Data for A (k = days before today; this week is k 0..6, the baseline is k 7..62):
--   sleep 6.0 on k 0..3 (4 days) vs 7.0 on k 7..16 (exactly 10 days)   -> enough data, lower
--   water 2.0 on k 0..2 (3 days) vs 12 baseline days                    -> 3 this week: not enough
--   steps 8000 on k 0..4 (5 days) vs 9 baseline days                    -> 9 in baseline: not enough
--   mood 3 on k 0..3 (4 days) vs 12 baseline days                       -> enough data, about usual
-- Expected: see the RESULT line at the bottom; every "bad" value must read blocked/0 and every control ok/1+.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); f uuid := gen_random_uuid();
  ca text; cb text; cc text; ce text; cf text;
  today date := current_date;
  sid uuid; sid2 uuid;
  v_default_level text; v_default_unpaused boolean;
  -- presence
  p_days int; p_cells int; p_sum int; p_goals int;
  -- summary
  s_days int; s_cells int; s_words text; s_bad int; s_goals int; v_sig boolean; v_fp_cols boolean;
  -- detail
  d_days int; d_cells int; d_goals int; d_sum int;
  c_days int; c_sum int; c_goals int; e_days int; e_sum int; e_goals int;
  -- one pillar
  o_days int; o_cells int; o_sum int; o_goals int;
  -- trends
  t_lower text; t_usual text; t_higher text;
  -- pause / resume
  z_flag boolean; z_days int; z_sum int; z_goals int; z_views_delta bigint; z_fp_paused boolean; z_fp_level text;
  r_days int; r_fp_paused boolean; r_views_delta bigint; one_row_today int;
  vs1 bigint; vs2 bigint; n int;
  -- views access
  a_rows int; b_rows int; c_rows int; e_rows int; f_rows int; total_rows int;
  -- direct writes
  w_b_insert text := 'ALLOWED'; w_b_update text := 'ALLOWED'; w_b_delete text := 'ALLOWED';
  w_a_insert text := 'ALLOWED'; w_a_update text := 'ALLOWED'; w_a_delete text := 'ALLOWED';
  w_a_level text := 'ALLOWED';
  -- options / confirm
  x_b_options text := 'ALLOWED'; x_b_confirm text := 'ALLOWED'; x_e_options text := 'ALLOWED';
  x_still_old boolean; x_bad_level text := 'ALLOWED'; x_a_recent boolean;
  -- revoked
  v_days int; v_sum int; v_goals int; v_options text := 'ALLOWED';
begin
  -- Fixtures as the database owner (bypasses RLS).
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v2-a@example.test', now(), '{"full_name":"Alex Owner"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v2-b@example.test', now(), '{}', now(), now()),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v2-c@example.test', now(), '{}', now(), now()),
         (e, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v2-e@example.test', now(), '{}', now(), now()),
         (f, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v2-f@example.test', now(), '{}', now(), now());
  insert into public.habit_logs (user_id, log_date, water_liters, sleep_hours, steps, mood, notes)
  select a, today - k,
         case when k <= 2 or k between 7 and 18 then 2.0 end,
         case when k <= 3 then 6.0 when k between 7 and 16 then 7.0 end,
         case when k <= 4 or k between 7 and 15 then 8000 end,
         case when k <= 3 or k between 7 and 18 then 3 end,
         case when k = 0 then 'PRIVATE NOTE' end
    from generate_series(0, 18) k;
  insert into public.goals (user_id, goal_type, target_value, unit)
  values (a, 'water', 2, 'liters/day'), (a, 'steps', 8000, 'steps/day'), (a, 'sleep', 7.5, 'hours/night');

  ca := json_build_object('sub', a, 'role', 'authenticated', 'email', 'v2-a@example.test')::text;
  cb := json_build_object('sub', b, 'role', 'authenticated', 'email', 'v2-b@example.test')::text;
  cc := json_build_object('sub', c, 'role', 'authenticated', 'email', 'v2-c@example.test')::text;
  ce := json_build_object('sub', e, 'role', 'authenticated', 'email', 'v2-e@example.test')::text;
  cf := json_build_object('sub', f, 'role', 'authenticated', 'email', 'v2-f@example.test')::text;

  execute 'set local role authenticated';

  -- A invites B (all four pillars); a new share starts at presence, not paused. F invites E.
  perform set_config('request.jwt.claims', ca, true);
  sid := public.create_care_share('v2-b@example.test', true, true, true, true);
  select s.level, s.paused_at is null into v_default_level, v_default_unpaused from public.care_shares s where s.id = sid;
  perform set_config('request.jwt.claims', cf, true);
  sid2 := public.create_care_share('v2-e@example.test', true, false, false, false);
  perform set_config('request.jwt.claims', cb, true);
  perform public.accept_care_share(sid);
  perform set_config('request.jwt.claims', ce, true);
  perform public.accept_care_share(sid2);

  -- ===== PRESENCE: dates only, every value null; no summary; no goals =====
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into p_days from public.shared_days(a, today - 6, today);
  select count(*) into p_cells from public.shared_days(a, today - 6, today) sd, jsonb_each(to_jsonb(sd) - 'log_date') je
   where je.value <> 'null'::jsonb;
  select count(*) into p_sum from public.shared_week_summary(a);
  select count(*) into p_goals from public.shared_goals(a);

  -- ===== SUMMARY: still dates only, plus trend words =====
  perform set_config('request.jwt.claims', ca, true);
  perform public.set_care_share_options(sid, 'summary', false);
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into s_days from public.shared_days(a, today - 6, today);
  select count(*) into s_cells from public.shared_days(a, today - 6, today) sd, jsonb_each(to_jsonb(sd) - 'log_date') je
   where je.value <> 'null'::jsonb;
  select coalesce(string_agg(w.pillar || ':' || w.days_logged || ':' || w.trend, ',' order by w.pillar), '') into s_words
    from public.shared_week_summary(a) w;
  select count(*) into s_bad from public.shared_week_summary(a) w
   where w.trend not in ('about_usual', 'a_little_lower', 'a_little_higher', 'not_enough_days');
  select count(*) into s_goals from public.shared_goals(a);
  -- the function's only output columns are a pillar name, a day count and a trend word: no number of values
  v_sig := pg_get_function_result('public.shared_week_summary(uuid)'::regprocedure) = 'TABLE(pillar text, days_logged integer, trend text)';
  v_fp_cols := pg_get_function_result('public.followed_people()'::regprocedure)
               like '%, accepted_at timestamp with time zone, level text, paused boolean)';

  -- ===== DETAIL: values for ticked pillars; goals appear; strangers still get nothing =====
  perform set_config('request.jwt.claims', ca, true);
  perform public.set_care_share_options(sid, 'detail', false);
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into d_days from public.shared_days(a, today - 6, today);
  select count(*) into d_cells from public.shared_days(a, today - 6, today) sd, jsonb_each(to_jsonb(sd) - 'log_date') je
   where je.value <> 'null'::jsonb;
  select count(*) into d_goals from public.shared_goals(a);
  select count(*) into d_sum from public.shared_week_summary(a);
  perform set_config('request.jwt.claims', cc, true);
  select count(*) into c_days from public.shared_days(a, today - 6, today);
  select count(*) into c_sum from public.shared_week_summary(a);
  select count(*) into c_goals from public.shared_goals(a);
  perform set_config('request.jwt.claims', ce, true);
  select count(*) into e_days from public.shared_days(a, today - 6, today);
  select count(*) into e_sum from public.shared_week_summary(a);
  select count(*) into e_goals from public.shared_goals(a);

  -- ===== DETAIL with only Sleep ticked: only sleep values, only sleep goal =====
  perform set_config('request.jwt.claims', ca, true);
  perform public.update_care_share(sid, false, true, false, false);
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into o_days from public.shared_days(a, today - 6, today);
  select count(*) into o_cells from public.shared_days(a, today - 6, today) sd, jsonb_each(to_jsonb(sd) - 'log_date') je
   where je.value <> 'null'::jsonb;
  select count(*) into o_sum from public.shared_week_summary(a);
  select count(*) into o_goals from public.shared_goals(a);
  perform set_config('request.jwt.claims', ca, true);
  perform public.update_care_share(sid, true, true, true, true);

  -- ===== TREND WORDS: lower, about usual (+8.6%), higher (+14.3%) on the same baseline of 7.0 =====
  perform set_config('request.jwt.claims', cb, true);
  select w.trend into t_lower from public.shared_week_summary(a) w where w.pillar = 'sleep';
  execute 'reset role';
  update public.habit_logs set sleep_hours = 7.6 where user_id = a and log_date between today - 3 and today;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', cb, true);
  select w.trend into t_usual from public.shared_week_summary(a) w where w.pillar = 'sleep';
  execute 'reset role';
  update public.habit_logs set sleep_hours = 8.0 where user_id = a and log_date between today - 3 and today;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', cb, true);
  select w.trend into t_higher from public.shared_week_summary(a) w where w.pillar = 'sleep';

  -- ===== VIEW COUNTING: one row per share per day, the counter goes up by one per look =====
  perform set_config('request.jwt.claims', ca, true);
  select count(*) into one_row_today from public.care_share_views v where v.share_id = sid and v.viewed_on = today;
  select coalesce(sum(v.views), 0) into vs1 from public.care_share_views v where v.share_id = sid;
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into n from public.shared_days(a, today - 6, today);
  perform set_config('request.jwt.claims', ca, true);
  select coalesce(sum(v.views), 0) into vs2 from public.care_share_views v where v.share_id = sid;
  r_views_delta := vs2 - vs1;

  -- ===== PAUSE: nothing is returned and nothing is recorded; resume restores =====
  perform public.set_care_share_options(sid, null, true);
  select s.paused_at is not null into z_flag from public.care_shares s where s.id = sid;
  select coalesce(sum(v.views), 0) into vs1 from public.care_share_views v where v.share_id = sid;
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into z_days from public.shared_days(a, today - 6, today);
  select count(*) into z_sum from public.shared_week_summary(a);
  select count(*) into z_goals from public.shared_goals(a);
  select fp.paused, fp.level into z_fp_paused, z_fp_level from public.followed_people() fp where fp.share_id = sid;
  perform set_config('request.jwt.claims', ca, true);
  select coalesce(sum(v.views), 0) into vs2 from public.care_share_views v where v.share_id = sid;
  z_views_delta := vs2 - vs1;
  perform public.set_care_share_options(sid, null, false);
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into r_days from public.shared_days(a, today - 6, today);
  select fp.paused into r_fp_paused from public.followed_people() fp where fp.share_id = sid;

  -- ===== WHO CAN READ THE ACCESS HISTORY =====
  -- E looks at F's share once, so a different owner's history exists too.
  perform set_config('request.jwt.claims', ce, true);
  select count(*) into n from public.shared_days(f, today - 6, today);
  -- as the database owner: an extra past day for A's share (this also proves the table is writable by definer code)
  execute 'reset role';
  insert into public.care_share_views (share_id, viewed_on, views) values (sid, today - 1, 2);
  select count(*) into total_rows from public.care_share_views;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ca, true);
  select count(*) into a_rows from public.care_share_views;
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into b_rows from public.care_share_views;
  perform set_config('request.jwt.claims', cc, true);
  select count(*) into c_rows from public.care_share_views;
  perform set_config('request.jwt.claims', ce, true);
  select count(*) into e_rows from public.care_share_views;
  perform set_config('request.jwt.claims', cf, true);
  select count(*) into f_rows from public.care_share_views;

  -- ===== NO CLIENT WRITES to care_share_views (or to level) =====
  perform set_config('request.jwt.claims', cb, true);
  begin insert into public.care_share_views (share_id, viewed_on) values (sid, today - 5); exception when others then w_b_insert := 'blocked'; end;
  begin update public.care_share_views set views = 99; exception when others then w_b_update := 'blocked'; end;
  begin delete from public.care_share_views; exception when others then w_b_delete := 'blocked'; end;
  perform set_config('request.jwt.claims', ca, true);
  begin insert into public.care_share_views (share_id, viewed_on) values (sid, today - 5); exception when others then w_a_insert := 'blocked'; end;
  begin update public.care_share_views set views = 99; exception when others then w_a_update := 'blocked'; end;
  begin delete from public.care_share_views; exception when others then w_a_delete := 'blocked'; end;
  begin update public.care_shares set level = 'detail' where id = sid; exception when others then w_a_level := 'blocked'; end;

  -- ===== A VIEWER CANNOT CHANGE OPTIONS OR CONFIRM; THE OWNER CAN =====
  execute 'reset role';
  update public.care_shares set last_confirmed_at = now() - interval '100 days' where id = sid;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', cb, true);
  begin perform public.set_care_share_options(sid, 'detail', false); exception when others then x_b_options := 'blocked'; end;
  begin perform public.confirm_care_share(sid); exception when others then x_b_confirm := 'blocked'; end;
  select s.last_confirmed_at < now() - interval '90 days' into x_still_old from public.care_shares s where s.id = sid;
  perform set_config('request.jwt.claims', ce, true);
  begin perform public.set_care_share_options(sid, 'detail', false); exception when others then x_e_options := 'blocked'; end;
  perform set_config('request.jwt.claims', ca, true);
  begin perform public.set_care_share_options(sid, 'everything', false); exception when others then x_bad_level := 'blocked'; end;
  perform public.confirm_care_share(sid);
  select s.last_confirmed_at > now() - interval '1 day' into x_a_recent from public.care_shares s where s.id = sid;

  -- ===== REVOKED: nothing returned, options rejected =====
  perform public.end_care_share(sid);
  begin perform public.set_care_share_options(sid, 'detail', false); exception when others then v_options := 'blocked'; end;
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into v_days from public.shared_days(a, today - 6, today);
  select count(*) into v_sum from public.shared_week_summary(a);
  select count(*) into v_goals from public.shared_goals(a);

  raise exception 'RESULT default=%/% | presence: days=% cells=% summary_rows=% goals=% | summary: days=% cells=% words=% bad_words=% goals=% sig_ok=% followed_cols_ok=% | detail: days=% cells=% goals=% summary_rows=% | stranger: days=% summary=% goals=% | other_viewer: days=% summary=% goals=% | sleep_only: days=% cells=% summary_rows=% goals=% | trends: lower=% usual=% higher=% | views: rows_today=% delta_active=% | pause: flag=% days=% summary=% goals=% views_delta=% followed_paused=% followed_level=% | resume: days=% followed_paused=% | history: owner=% viewer=% stranger=% other_viewer=% other_owner=% all=% | writes: b_ins=% b_upd=% b_del=% a_ins=% a_upd=% a_del=% a_level=% | options: b_set=% b_confirm=% e_set=% still_old=% bad_level=% a_confirm_recent=% | revoked: days=% summary=% goals=% options=%',
    v_default_level, v_default_unpaused,
    p_days, p_cells, p_sum, p_goals,
    s_days, s_cells, s_words, s_bad, s_goals, v_sig, v_fp_cols,
    d_days, d_cells, d_goals, d_sum,
    c_days, c_sum, c_goals,
    e_days, e_sum, e_goals,
    o_days, o_cells, o_sum, o_goals,
    t_lower, t_usual, t_higher,
    one_row_today, r_views_delta,
    z_flag, z_days, z_sum, z_goals, z_views_delta, z_fp_paused, z_fp_level,
    r_days, r_fp_paused,
    a_rows, b_rows, c_rows, e_rows, f_rows, total_rows,
    w_b_insert, w_b_update, w_b_delete, w_a_insert, w_a_update, w_a_delete, w_a_level,
    x_b_options, x_b_confirm, x_e_options, x_still_old, x_bad_level, x_a_recent,
    v_days, v_sum, v_goals, v_options;
end $$;

-- Expected (every "bad" value reads 0/blocked; every positive control reads ok/the number shown):
-- RESULT default=presence/t
--  | presence: days=5 cells=0 summary_rows=0 goals=0
--      (5 logged days appear as dates; days=5 is the control that the viewer can see this share at all, and
--       the detail line below shows cells=16 for the same days, so cells=0 here is the redaction working)
--  | summary: days=5 cells=0 words=balance:4:about_usual,eat:3:not_enough_days,move:5:not_enough_days,sleep:4:a_little_lower bad_words=0 goals=0 sig_ok=t followed_cols_ok=t
--      (sleep: 4 days this week, exactly 10 in baseline, 6.0 vs 7.0 -> lower; eat: 3 days this week -> not enough;
--       move: 9 baseline days -> not enough; balance: 4 and 12 days, 3 vs 3 -> about usual)
--  | detail: days=5 cells=16 goals=3 summary_rows=4
--  | stranger: days=0 summary=0 goals=0 | other_viewer: days=0 summary=0 goals=0
--  | sleep_only: days=4 cells=4 summary_rows=1 goals=1
--  | trends: lower=a_little_lower usual=about_usual higher=a_little_higher
--  | views: rows_today=1 delta_active=1
--  | pause: flag=t days=0 summary=0 goals=0 views_delta=0 followed_paused=t followed_level=detail
--  | resume: days=5 followed_paused=f
--  | history: owner=2 viewer=0 stranger=0 other_viewer=0 other_owner=1 all=3
--  | writes: b_ins=blocked b_upd=blocked b_del=blocked a_ins=blocked a_upd=blocked a_del=blocked a_level=blocked
--  | options: b_set=blocked b_confirm=blocked e_set=blocked still_old=t bad_level=blocked a_confirm_recent=t
--  | revoked: days=0 summary=0 goals=0 options=blocked
-- Notes: rows_today=1 is read by the owner after many looks (one row per share per day); delta_active=1 is one extra
-- look raising the counter by exactly 1; views_delta=0 under pause shows a paused share records nothing.
