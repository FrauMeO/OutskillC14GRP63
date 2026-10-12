-- Test for migration 0012. NOT a migration; rolls back via the deliberate exception.
-- Expected: anon_call=blocked a_rows_before=5 a_rows_after=0 a_user_after=0 b_user_after=1 b_rows_after=2 shares_gone=0
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  anon_call text := 'ALLOWED'; before_n int; after_n int; a_user int; b_user int; b_rows int; shares int;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-a@example.test', now(), '{}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'del-b@example.test', now(), '{}', now(), now());
  insert into public.habit_logs (user_id, log_date, steps) values (a, '2026-10-01', 1), (b, '2026-10-01', 2);
  insert into public.goals (user_id, goal_type, target_value, unit) values (a, 'water', 2, 'liters/day'), (b, 'water', 2, 'liters/day');
  insert into public.reflections (user_id, offered_on) values (a, '2026-10-01');
  insert into public.care_shares (owner_id, viewer_email) values (a, 'del-b@example.test');
  select (select count(*) from public.habit_logs where user_id = a) + (select count(*) from public.goals where user_id = a)
       + (select count(*) from public.reflections where user_id = a) + (select count(*) from public.care_shares where owner_id = a)
       + (select count(*) from public.profiles where id = a) into before_n;
  execute 'set local role anon';
  begin perform public.delete_my_account(); exception when others then anon_call := 'blocked'; end;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'email', 'del-a@example.test')::text, true);
  perform public.delete_my_account();
  execute 'reset role';
  select (select count(*) from public.habit_logs where user_id = a) + (select count(*) from public.goals where user_id = a)
       + (select count(*) from public.reflections where user_id = a) + (select count(*) from public.care_shares where owner_id = a)
       + (select count(*) from public.profiles where id = a) into after_n;
  select count(*) into a_user from auth.users where id = a;
  select count(*) into b_user from auth.users where id = b;
  select count(*) into b_rows from (select 1 from public.habit_logs where user_id = b union all select 1 from public.goals where user_id = b) x;
  select count(*) into shares from public.care_shares where owner_id = a or viewer_email = 'del-a@example.test';
  raise exception 'RESULT anon_call=% a_rows_before=% a_rows_after=% a_user_after=% b_user_after=% b_rows_after=% shares_gone=%', anon_call, before_n, after_n, a_user, b_user, b_rows, shares;
end $$;
