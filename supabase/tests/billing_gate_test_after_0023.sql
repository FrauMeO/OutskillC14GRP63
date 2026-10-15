-- Test for migration 0023 (billing gate on shared views). NOT a migration; synthetic fixtures only.
-- The deliberate ZB023 "RESULT: PASS" exception rolls everything back, including the billing_enforced flip.
-- A shares with B (no plan) and C (paid caregiver plan). Positive controls: with billing OFF, B sees data;
-- with billing ON, C still sees data and A's own preview still works. Only B's reads must come back empty.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  ca text; cb text; cc text; sid_b uuid; sid_c uuid; n int; views_before int; views_after int;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    (a, 'gate-a@example.test', now(), '{}'), (b, 'gate-b@example.test', now(), '{}'), (c, 'gate-c@example.test', now(), '{}');
  insert into public.habit_logs (user_id, log_date, sleep_hours, mood) values (a, current_date, 7, 3);
  insert into public.goals (user_id, goal_type, target_value, unit) values (a, 'sleep', 8, 'hours/night');
  insert into public.subscriptions (stripe_subscription_id, user_id, plan, status, current_period_end)
    values ('sub_gate_c', c, 'caregiver_yearly', 'active', now() + interval '200 days');
  ca := json_build_object('sub', a, 'email', 'gate-a@example.test', 'role', 'authenticated')::text;
  cb := json_build_object('sub', b, 'email', 'gate-b@example.test', 'role', 'authenticated')::text;
  cc := json_build_object('sub', c, 'email', 'gate-c@example.test', 'role', 'authenticated')::text;

  -- Uniform live detail shares, sleep and balance, so all three legacy endpoints return rows.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ca, true);
  sid_b := public.invite_care_share_atomic(gen_random_uuid(), 'gate-b@example.test', false, true, false, true, 'detail', 1, repeat('a', 64));
  sid_c := public.invite_care_share_atomic(gen_random_uuid(), 'gate-c@example.test', false, true, false, true, 'detail', 1, repeat('a', 64));
  perform set_config('request.jwt.claims', cb, true); perform public.accept_care_share(sid_b);
  perform set_config('request.jwt.claims', cc, true); perform public.accept_care_share(sid_c);

  -- ===== billing OFF (beta default): B, with no plan, sees everything (positive control) =====
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into n from public.shared_days(a, current_date, current_date);
  if n <> 1 then raise exception 'FAIL beta control shared_days: % (want 1)', n; end if;
  select count(*) into n from public.shared_week_summary(a);
  if n <> 2 then raise exception 'FAIL beta control shared_week_summary: % (want 2)', n; end if;
  select count(*) into n from public.shared_goals(a);
  if n <> 1 then raise exception 'FAIL beta control shared_goals: % (want 1)', n; end if;

  -- ===== billing ON =====
  execute 'reset role';
  update public.app_settings set value = 'true'::jsonb where key = 'billing_enforced';
  if not found then raise exception 'FAIL could not switch billing on'; end if;
  select coalesce(sum(views), 0) into views_before from public.care_share_views where share_id = sid_b;
  execute 'set local role authenticated';

  -- B (no plan): nothing.
  perform set_config('request.jwt.claims', cb, true);
  select count(*) into n from public.shared_days(a, current_date, current_date);
  if n <> 0 then raise exception 'FAIL unpaid shared_days: % (want 0)', n; end if;
  select count(*) into n from public.shared_week_summary(a);
  if n <> 0 then raise exception 'FAIL unpaid shared_week_summary: % (want 0)', n; end if;
  select count(*) into n from public.shared_goals(a);
  if n <> 0 then raise exception 'FAIL unpaid shared_goals: % (want 0)', n; end if;
  -- B still sees that A shares with them, so the app can offer the plan.
  select count(*) into n from public.followed_people() f where f.owner_id = a;
  if n <> 1 then raise exception 'FAIL unpaid followed_people: % (want 1)', n; end if;

  -- C (paid caregiver plan): the usual rows (positive control).
  perform set_config('request.jwt.claims', cc, true);
  select count(*) into n from public.shared_days(a, current_date, current_date);
  if n <> 1 then raise exception 'FAIL paid shared_days: % (want 1)', n; end if;
  select count(*) into n from public.shared_week_summary(a);
  if n <> 2 then raise exception 'FAIL paid shared_week_summary: % (want 2)', n; end if;
  select count(*) into n from public.shared_goals(a);
  if n <> 1 then raise exception 'FAIL paid shared_goals: % (want 1)', n; end if;

  -- A refused read is not counted as a view.
  execute 'reset role';
  select coalesce(sum(views), 0) into views_after from public.care_share_views where share_id = sid_b;
  if views_after <> views_before then raise exception 'FAIL refused read counted as a view'; end if;

  -- Per-pillar shares go through shared_pillar_report.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', ca, true);
  perform public.set_care_share_matrix(sid_b, '{"eat":"off","sleep":"detail","move":"off","balance":"presence"}', 'live');
  perform public.set_care_share_matrix(sid_c, '{"eat":"off","sleep":"detail","move":"off","balance":"presence"}', 'live');
  if public.shared_pillar_report(a, sid_b) is null then raise exception 'FAIL owner preview is gated'; end if;
  perform set_config('request.jwt.claims', cb, true);
  if public.shared_pillar_report(a) is not null then raise exception 'FAIL unpaid shared_pillar_report'; end if;
  perform set_config('request.jwt.claims', cc, true);
  if public.shared_pillar_report(a) is null then raise exception 'FAIL paid shared_pillar_report'; end if;

  -- Expired plan: C's period ends, C loses access.
  execute 'reset role';
  update public.subscriptions set current_period_end = now() - interval '1 day' where stripe_subscription_id = 'sub_gate_c';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', cc, true);
  if public.shared_pillar_report(a) is not null then raise exception 'FAIL expired plan still reads'; end if;

  raise exception 'RESULT: PASS beta controls, unpaid blocked on all four endpoints, paid allowed, owner preview open, followed_people kept, no view counted, expired plan blocked. ALL FIXTURES ROLLED BACK.' using errcode = 'ZB023';
end $$;
rollback;
