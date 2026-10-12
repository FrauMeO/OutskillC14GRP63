-- Test for migration 0013. NOT a migration; rolls back via the deliberate exception.
-- Expected: join_ok=ok no_consent=blocked (false and null both refused; checked 2026-10-12: rows for refused addresses = 0) consent_recorded=true
--   default_mkt=false default_mkt_at=null default_health_at=null yes_mkt=true yes_mkt_at=set yes_health_at=set
--   other_value_mkt=false (metadata 'yes' is not 'true')
do $$
declare
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  join_ok text := 'FAILED'; no_consent text := 'ALLOWED'; consent_rec boolean;
  d_mkt boolean; d_mkt_at timestamptz; d_h timestamptz; y_mkt boolean; y_mkt_at timestamptz; y_h timestamptz; o_mkt boolean;
begin
  execute 'set local role anon';
  perform public.join_waitlist('c-test@example.test', true, false, true); join_ok := 'ok';
  begin perform public.join_waitlist('c-test2@example.test', true, false, false); exception when others then no_consent := 'blocked'; end;
  begin perform public.join_waitlist('c-test3@example.test', true, false, null); exception when others then null; end;
  execute 'reset role';
  select consent_at is not null into consent_rec from public.waitlist where email = 'c-test@example.test';
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@example.test', '{}', now(), now()),
         (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@example.test', '{"marketing_opt_in":"true","health_consent":"true"}', now(), now()),
         (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c3@example.test', '{"marketing_opt_in":"yes"}', now(), now());
  select marketing_opt_in, marketing_opt_in_at, health_consent_at into d_mkt, d_mkt_at, d_h from public.profiles where id = u1;
  select marketing_opt_in, marketing_opt_in_at, health_consent_at into y_mkt, y_mkt_at, y_h from public.profiles where id = u2;
  select marketing_opt_in into o_mkt from public.profiles where id = u3;
  raise exception 'RESULT join_ok=% no_consent=% consent_recorded=% default_mkt=% default_mkt_at=% default_health_at=% yes_mkt=% yes_mkt_at=% yes_health_at=% other_value_mkt=%',
    join_ok, no_consent, consent_rec, d_mkt, coalesce(d_mkt_at::text, 'null'), coalesce(d_h::text, 'null'), y_mkt,
    case when y_mkt_at is not null then 'set' else 'null' end, case when y_h is not null then 'set' else 'null' end, o_mkt;
end $$;
