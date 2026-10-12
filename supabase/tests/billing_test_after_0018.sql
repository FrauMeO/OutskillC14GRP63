-- Test for migration 0018 (billing). NOT a migration; rolls back via the deliberate exception.
-- Run after 0018 is applied. A is exactly 60 this month (the boundary, free), B is one month short of 60
-- (standard), C is a legacy account with no birth data, D pays for the caregiver plan.
-- Expected: see the RESULT line; every "bad" value must read blocked/false/0 and every control ok/true/1+.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  a_date date := (current_date - interval '60 years')::date;
  b_date date := (current_date - interval '60 years' + interval '1 month')::date;
  e record;
  -- pure age boundaries (today fixed at 2026-10-12)
  p_oct1966 text; p_nov1966 text; p_sep1966 text; p_null text; p_oct1967 text; p_future text;
  -- settings
  default_enforced text; auth_reads_setting int; client_updates_setting text := 'ALLOWED'; client_inserts_setting text := 'ALLOWED';
  -- beta (billing off)
  beta_a_std boolean; beta_b_std boolean; beta_c_std boolean; beta_b_cg boolean; beta_status text; beta_view boolean;
  -- billing on
  on_a_plan text; on_a_std boolean; on_a_cg boolean; on_a_status text;
  on_b_plan text; on_b_std boolean; on_b_status text;
  on_c_plan text; on_c_std boolean; on_c_status text;
  on_b_active boolean; on_b_trial boolean; on_b_pastdue boolean; on_b_canceled boolean;
  d_cg boolean; d_view boolean; b_view boolean; d_expired_view boolean; d_standard boolean; d_owner_view boolean;
  anon_view boolean;
  -- RLS and privileges
  b_sees_subs int; b_sees_customers int; b_insert_sub text := 'ALLOWED'; b_events text := 'ALLOWED'; b_plan_for text := 'ALLOWED';
  b_update_sub text := 'ALLOWED'; b_other_subs int;
  need_c boolean; need_a boolean; need_b boolean;
begin
  -- Fixtures as the database owner (bypasses RLS). The sign-up trigger creates the profiles.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bill-a@example.test', now(), '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bill-b@example.test', now(), '{}', now(), now()),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bill-c@example.test', now(), '{}', now(), now()),
         (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bill-d@example.test', now(), '{}', now(), now());
  update public.profiles set birth_month = extract(month from a_date)::int, birth_year = extract(year from a_date)::int where id = a;
  update public.profiles set birth_month = extract(month from b_date)::int, birth_year = extract(year from b_date)::int where id = b;
  update public.profiles set birth_month = extract(month from b_date)::int, birth_year = extract(year from b_date)::int where id = d;
  -- C keeps null birth data (legacy account).

  -- Pure age boundaries
  p_oct1966 := public.plan_from_birth(10, 1966, date '2026-10-12');   -- turns 60 this month: free
  p_nov1966 := public.plan_from_birth(11, 1966, date '2026-10-12');   -- one month short: standard
  p_sep1966 := public.plan_from_birth(9, 1966, date '2026-10-12');    -- already 60: free
  p_null    := public.plan_from_birth(null, null, date '2026-10-12'); -- unknown
  p_oct1967 := public.plan_from_birth(10, 1967, date '2026-10-12');   -- control: 59, standard
  p_future  := public.plan_from_birth(1, 2000, date '2026-10-12');    -- control: 26, standard

  select value::text into default_enforced from public.app_settings where key = 'billing_enforced';

  -- Subscriptions as the owner of the database (what the webhook does with the service role)
  insert into public.subscriptions (stripe_subscription_id, user_id, plan, status, current_period_end)
  values ('sub_d_cg',  d, 'caregiver_yearly', 'active', now() + interval '200 days'),
         ('sub_b_cg_expired', b, 'caregiver_yearly', 'active', now() - interval '1 day');
  -- b's expired caregiver row must not grant anything; keep b's standard states in a loop below.

  execute 'set local role authenticated';

  -- ===== billing OFF (the beta default) =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'bill-a@example.test')::text, true);
  select count(*) into auth_reads_setting from public.app_settings where key = 'billing_enforced';
  begin update public.app_settings set value = 'true'::jsonb where key = 'billing_enforced'; if found then client_updates_setting := 'ALLOWED'; else client_updates_setting := 'blocked'; end if;
  exception when others then client_updates_setting := 'blocked'; end;
  begin insert into public.app_settings (key, value) values ('x', '1'::jsonb); exception when others then client_inserts_setting := 'blocked'; end;
  select e2.has_standard into beta_a_std from public.my_entitlement() e2;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.has_standard, e2.has_caregiver, e2.status into beta_b_std, beta_b_cg, beta_status from public.my_entitlement() e2;
  beta_view := public.viewer_may_view(a);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'email', 'bill-c@example.test')::text, true);
  select e2.has_standard into beta_c_std from public.my_entitlement() e2;

  -- ===== billing ON =====
  execute 'reset role';
  update public.app_settings set value = 'true'::jsonb where key = 'billing_enforced';
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'bill-a@example.test')::text, true);
  select e2.plan, e2.has_standard, e2.has_caregiver, e2.status into on_a_plan, on_a_std, on_a_cg, on_a_status from public.my_entitlement() e2;
  need_a := public.profile_birth_needed();

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.plan, e2.has_standard, e2.status into on_b_plan, on_b_std, on_b_status from public.my_entitlement() e2;
  b_view := public.viewer_may_view(a);          -- only an expired caregiver row: must be false
  d_expired_view := b_view;
  need_b := public.profile_birth_needed();

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'email', 'bill-c@example.test')::text, true);
  select e2.plan, e2.has_standard, e2.status into on_c_plan, on_c_std, on_c_status from public.my_entitlement() e2;
  need_c := public.profile_birth_needed();

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated', 'email', 'bill-d@example.test')::text, true);
  select e2.has_caregiver, e2.has_standard into d_cg, d_standard from public.my_entitlement() e2;
  d_view := public.viewer_may_view(a);
  d_owner_view := public.viewer_may_view(null);   -- null owner is refused
  select count(*) into b_other_subs from public.subscriptions;  -- D sees only D's own row (1)

  -- B's standard subscription in each state
  execute 'reset role';
  insert into public.subscriptions (stripe_subscription_id, user_id, plan, status, current_period_end)
  values ('sub_b_std', b, 'standard_monthly', 'active', now() + interval '20 days');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.has_standard into on_b_active from public.my_entitlement() e2;
  select count(*) into b_sees_subs from public.subscriptions;                 -- own two rows only
  select count(*) into b_sees_customers from public.customers;
  begin insert into public.subscriptions (stripe_subscription_id, user_id, plan, status) values ('sub_hack', b, 'caregiver_yearly', 'active'); exception when others then b_insert_sub := 'blocked'; end;
  begin update public.subscriptions set status = 'active' where stripe_subscription_id = 'sub_b_std'; b_update_sub := 'ALLOWED'; exception when others then b_update_sub := 'blocked'; end;
  begin perform 1 from public.stripe_events; exception when others then b_events := 'blocked'; end;
  begin perform public.plan_for(a); exception when others then b_plan_for := 'blocked'; end;

  execute 'reset role';
  update public.subscriptions set status = 'trialing' where stripe_subscription_id = 'sub_b_std';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.has_standard into on_b_trial from public.my_entitlement() e2;

  execute 'reset role';
  update public.subscriptions set status = 'past_due' where stripe_subscription_id = 'sub_b_std';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.has_standard into on_b_pastdue from public.my_entitlement() e2;

  execute 'reset role';
  update public.subscriptions set status = 'canceled' where stripe_subscription_id = 'sub_b_std';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'bill-b@example.test')::text, true);
  select e2.has_standard into on_b_canceled from public.my_entitlement() e2;

  -- signed-out caller
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  anon_view := public.viewer_may_view(a);

  raise exception 'RESULT % | age: oct1966=% (free) nov1966=% (standard) sep1966=% (free) null=% (unknown) CONTROL oct1967=% (standard) 2000=% (standard) | settings: default=% (false) auth_reads=% (1) client_update=% (blocked) client_insert=% (blocked) | beta: a_std=% b_std=% c_std=% (all true) b_cg=% (true) status=% (beta) view=% (true) | on: A plan=% std=% cg=% status=% (free_60_plus true false free) B plan=% std=% status=% (standard false none) C plan=% std=% status=% (unknown false needs_birth) | B subscription: active=% (true) trialing=% (true) past_due=% (false) canceled=% (false) | caregiver: D cg=% (true) view=% (true) D_standard=% (false) B_expired_view=% (false) null_owner=% (false) anon=% (false) | rls: D_sees=% (1) B_sees_subs=% (2) B_sees_customers=% (0) insert=% (blocked) update=% (blocked) events=% (blocked) plan_for=% (blocked) | birth_needed: C=% (true) A=% (false) B=% (false)',
    case when
      p_oct1966 = 'free_60_plus' and p_nov1966 = 'standard' and p_sep1966 = 'free_60_plus' and p_null = 'unknown' and p_oct1967 = 'standard' and p_future = 'standard'
      and default_enforced = 'false' and auth_reads_setting = 1 and client_updates_setting = 'blocked' and client_inserts_setting = 'blocked'
      and beta_a_std and beta_b_std and beta_c_std and beta_b_cg and beta_status = 'beta' and beta_view
      and on_a_plan = 'free_60_plus' and on_a_std and not on_a_cg and on_a_status = 'free'
      and on_b_plan = 'standard' and not on_b_std and on_b_status = 'none'
      and on_c_plan = 'unknown' and not on_c_std and on_c_status = 'needs_birth'
      and on_b_active and on_b_trial and not on_b_pastdue and not on_b_canceled
      and d_cg and d_view and not d_standard and not d_expired_view and not d_owner_view and not anon_view
      and b_other_subs = 1 and b_sees_subs = 2 and b_sees_customers = 0
      and b_insert_sub = 'blocked' and b_update_sub = 'blocked' and b_events = 'blocked' and b_plan_for = 'blocked'
      and need_c and not need_a and not need_b
    then 'ALL PASS' else 'FAIL' end,
    p_oct1966, p_nov1966, p_sep1966, p_null, p_oct1967, p_future,
    default_enforced, auth_reads_setting, client_updates_setting, client_inserts_setting,
    beta_a_std, beta_b_std, beta_c_std, beta_b_cg, beta_status, beta_view,
    on_a_plan, on_a_std, on_a_cg, on_a_status,
    on_b_plan, on_b_std, on_b_status,
    on_c_plan, on_c_std, on_c_status,
    on_b_active, on_b_trial, on_b_pastdue, on_b_canceled,
    d_cg, d_view, d_standard, d_expired_view, d_owner_view, anon_view,
    b_other_subs, b_sees_subs, b_sees_customers, b_insert_sub, b_update_sub, b_events, b_plan_for,
    need_c, need_a, need_b;
end $$;
