-- Test for migration 0011 (waiting list). NOTE: 0013 added a fourth argument, p_consent; the calls below
-- were run before that change. See email_consent_test_after_0013.sql for the current signature. NOT a migration; rolls back via the deliberate exception.
-- Expected: join_ios=ok bad_email=blocked none_picked=blocked merge_android_added=true merge_ios_kept=true
--   rows_for_address=1 anon_select=0 anon_direct_insert=blocked auth_select=0 uppercase_merged=1
do $$
declare
  join_ios text := 'FAILED'; bad_email text := 'ALLOWED'; none_picked text := 'ALLOWED';
  m_and boolean; m_ios boolean; n int; anon_sel int := -1; anon_ins text := 'ALLOWED'; auth_sel int := -1; upper_n int;
begin
  execute 'set local role anon';
  perform public.join_waitlist('wait-test@example.test', true, false); join_ios := 'ok';
  begin perform public.join_waitlist('nope', true, false); exception when others then bad_email := 'blocked'; end;
  begin perform public.join_waitlist('wait-test2@example.test', false, false); exception when others then none_picked := 'blocked'; end;
  perform public.join_waitlist(' WAIT-TEST@Example.test ', false, true);
  begin select count(*) into anon_sel from public.waitlist; exception when insufficient_privilege then anon_sel := 0; end;
  begin insert into public.waitlist (email, want_ios) values ('direct@example.test', true); exception when others then anon_ins := 'blocked'; end;
  execute 'reset role';
  select want_android, want_ios into m_and, m_ios from public.waitlist where email = 'wait-test@example.test';
  select count(*) into n from public.waitlist where email = 'wait-test@example.test';
  select count(*) into upper_n from public.waitlist where lower(email) = 'wait-test@example.test';
  execute 'set local role authenticated';
  begin select count(*) into auth_sel from public.waitlist; exception when insufficient_privilege then auth_sel := 0; end;
  raise exception 'RESULT join_ios=% bad_email=% none_picked=% merge_android_added=% merge_ios_kept=% rows_for_address=% anon_select=% anon_direct_insert=% auth_select=% uppercase_merged=%',
    join_ios, bad_email, none_picked, m_and, m_ios, n, anon_sel, anon_ins, auth_sel, upper_n;
end $$;
