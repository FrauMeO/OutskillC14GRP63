-- Synthetic fixtures only. Run with psql as database owner after 0021 on a test database.
-- Success ends with deliberate SQLSTATE ZB021 and RESULT: PASS; all fixtures/triggers roll back.
-- A different error is a failure. Never remove the rollback when adapting this test.
begin;
create function public.byp_test_atomic_failure() returns trigger language plpgsql as $$
begin
  if current_setting('byp.test.fail', true) = TG_ARGV[0] then
    raise exception 'Injected atomic write failure' using errcode = 'ZX001';
  end if;
  return NEW;
end $$;
create trigger byp_test_invite_insert before insert on public.care_shares for each row execute function public.byp_test_atomic_failure('create');
create trigger byp_test_scope_update after update on public.care_shares for each row execute function public.byp_test_atomic_failure('scope');
create trigger byp_test_consent_insert after insert on public.consents for each row execute function public.byp_test_atomic_failure('consent');
create trigger byp_test_request_insert after insert on public.care_share_invite_requests for each row execute function public.byp_test_atomic_failure('request');
do $$
declare
 a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
 req uuid := gen_random_uuid(); sid uuid; same_id uuid; failing_id uuid;
 ca text; cb text; cc text; fail_stage text; caught boolean;
 n int; v int; stored public.care_shares%rowtype; before_pause timestamptz;
begin
 insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
 values (a, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','atomic-a@example.test',now(),'{}',now(),now()),
 (b, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','atomic-b@example.test',now(),'{}',now(),now()),
 (c, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','atomic-c@example.test',now(),'{}',now(),now());
 insert into public.habit_logs(user_id, log_date, sleep_hours, water_liters) values(a,current_date,7,2);
 ca := json_build_object('sub',a,'role','authenticated','email','atomic-a@example.test')::text;
 cb := json_build_object('sub',b,'role','authenticated','email','atomic-b@example.test')::text;
 cc := json_build_object('sub',c,'role','authenticated','email','atomic-c@example.test')::text;
 if has_function_privilege('anon','public.invite_care_share_atomic(uuid,text,boolean,boolean,boolean,boolean,text,integer,text)','EXECUTE')
    or has_function_privilege('anon','public.update_care_share_scope(uuid,boolean,boolean,boolean,boolean,text)','EXECUTE') then
   raise exception 'FAIL: anonymous RPC execute permission';
 end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claims',ca,true);
 -- Inject after every server write stage. No share may survive or become acceptable.
 foreach fail_stage in array array['create','scope','consent','request'] loop
   perform set_config('byp.test.fail',fail_stage,true); caught := false;
   begin
     failing_id := public.invite_care_share_atomic(gen_random_uuid(),'atomic-b@example.test',true,true,false,false,'detail',1,repeat('a',64));
   exception when sqlstate 'ZX001' then caught := true; end;
   if not caught then raise exception 'FAIL: injection % not exercised', fail_stage; end if;
   select count(*) into n from public.care_shares where owner_id=a;
   if n <> 0 then raise exception 'FAIL: partial invitation survived %', fail_stage; end if;
   select count(*) into n from public.consents where user_id=a;
   if n <> 0 then raise exception 'FAIL: consent survived %', fail_stage; end if;
   perform set_config('request.jwt.claims',cb,true);
   select count(*) into n from public.followed_people();
   if n <> 0 then raise exception 'FAIL: recipient discovered partial invitation %', fail_stage; end if;
   perform set_config('request.jwt.claims',ca,true);
 end loop;
 perform set_config('byp.test.fail','',true);
 -- Positive control: complete invitation succeeds; repeat gives one share and one ledger grant.
 sid := public.invite_care_share_atomic(req,'atomic-b@example.test',false,true,false,false,'detail',1,repeat('a',64));
 same_id := public.invite_care_share_atomic(req,'atomic-b@example.test',false,true,false,false,'detail',1,repeat('a',64));
 if same_id <> sid then raise exception 'FAIL: retry changed share'; end if;
 select count(*) into n from public.consents where user_id=a and share_id=sid and granted;
 if n <> 1 then raise exception 'FAIL: retry duplicated consent'; end if;
 caught := false;
 begin perform public.invite_care_share_atomic(req,'atomic-b@example.test',true,true,false,false,'detail',1,repeat('a',64));
 exception when invalid_parameter_value then caught := true; end;
 if not caught then raise exception 'FAIL: payload mismatch accepted'; end if;
 -- The different recipient/owner cannot accept or update this share.
 perform set_config('request.jwt.claims',cc,true); caught := false;
 begin perform public.accept_care_share(sid); exception when no_data_found then caught:=true; end;
 if not caught then raise exception 'FAIL: wrong recipient accepted'; end if;
 caught := false;
 begin perform public.update_care_share_scope(sid,true,true,false,false,'presence'); exception when no_data_found then caught:=true; end;
 if not caught then raise exception 'FAIL: wrong owner updated'; end if;
 caught := false;
 begin execute 'select count(*) from public.care_share_invite_requests'; exception when insufficient_privilege then caught:=true; end;
 if not caught then raise exception 'FAIL: private request ledger readable'; end if;
 perform set_config('request.jwt.claims',cb,true); perform public.accept_care_share(sid);
 select count(*), count(sleep_hours) into n,v from public.shared_days(a,current_date,current_date);
 if n<>1 or v<>1 then raise exception 'FAIL: detail positive control'; end if;
 -- Inject an AFTER UPDATE failure for detail/Sleep -> presence/Sleep+Drink.
 perform set_config('request.jwt.claims',ca,true); perform set_config('byp.test.fail','scope',true); caught:=false;
 begin perform public.update_care_share_scope(sid,true,true,false,false,'presence'); exception when sqlstate 'ZX001' then caught:=true; end;
 if not caught then raise exception 'FAIL: scope failure not exercised'; end if;
 perform set_config('byp.test.fail','',true);
 select * into stored from public.care_shares where id=sid;
 if stored.level <> 'detail' or stored.share_eat or not stored.share_sleep then raise exception 'FAIL: partial scope changed'; end if;
 perform set_config('request.jwt.claims',cb,true);
 select count(sleep_hours),count(water_liters) into n,v from public.shared_days(a,current_date,current_date);
 if n<>1 or v<>0 then raise exception 'FAIL: recipient scope changed on failure'; end if;
 -- Successful decrease exposes presence dates only, never numeric values.
 perform set_config('request.jwt.claims',ca,true);
 perform public.update_care_share_scope(sid,true,true,false,false,'presence');
 perform set_config('request.jwt.claims',cb,true);
 select count(*),count(sleep_hours)+count(water_liters) into n,v from public.shared_days(a,current_date,current_date);
 if n<>1 or v<>0 then raise exception 'FAIL: presence leaked numeric values'; end if;
 -- Pause stays unchanged even while increasing level and removing a pillar.
 perform set_config('request.jwt.claims',ca,true);
 perform public.set_care_share_options(sid,null,true);
 select paused_at into before_pause from public.care_shares where id=sid;
 perform public.update_care_share_scope(sid,true,false,false,false,'detail');
 select * into stored from public.care_shares where id=sid;
 if stored.paused_at is distinct from before_pause or stored.share_sleep or not stored.share_eat then raise exception 'FAIL: pause/scope lost'; end if;
 perform set_config('request.jwt.claims',cb,true);
 select count(*) into n from public.shared_days(a,current_date,current_date);
 if n<>0 then raise exception 'FAIL: pause leaked'; end if;
 perform set_config('request.jwt.claims',ca,true); perform public.set_care_share_options(sid,null,false);
 perform set_config('request.jwt.claims',cb,true);
 select count(sleep_hours),count(water_liters) into n,v from public.shared_days(a,current_date,current_date);
 if n<>0 or v<>1 then raise exception 'FAIL: removed pillar leaked'; end if;
 -- Reject invalid settings without touching the current state.
 perform set_config('request.jwt.claims',ca,true); caught:=false;
 begin perform public.update_care_share_scope(sid,false,false,false,false,'detail');
 exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'FAIL: empty pillar selection accepted'; end if;
 caught:=false;
 begin perform public.update_care_share_scope(sid,true,false,false,false,null);
 exception when invalid_parameter_value then caught:=true; end;
 if not caught then raise exception 'FAIL: invalid level accepted'; end if;
 -- Retry after revocation returns original record without reviving it.
 perform set_config('request.jwt.claims',ca,true); perform public.end_care_share(sid);
 same_id := public.invite_care_share_atomic(req,'atomic-b@example.test',false,true,false,false,'detail',1,repeat('a',64));
 select * into stored from public.care_shares where id=sid;
 if same_id<>sid or stored.status<>'revoked' then raise exception 'FAIL: retry revived ended share'; end if;
 caught:=false;
 begin perform public.update_care_share_scope(sid,true,false,false,false,'presence');
 exception when no_data_found then caught:=true; end;
 if not caught then raise exception 'FAIL: revoked share updated'; end if;
 raise exception 'RESULT: PASS atomic rollback at create/scope/consent/request; idempotency; authorization; recipient disclosure; pause; no resurrection. ALL FIXTURES ROLLED BACK.' using errcode='ZB021';
end $$;
rollback;
