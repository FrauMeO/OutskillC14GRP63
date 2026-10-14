-- Synthetic fixtures; isolated database only. Deliberate ZB022 PASS rolls everything back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); sid uuid; r jsonb; n int; caught boolean;
 ca text; cb text; cc text; prev date:=date_trunc('month',current_date)::date-1; lev text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (a,'scope-a@example.test',now(),'{}'),(b,'scope-b@example.test',now(),'{}'),(c,'scope-c@example.test',now(),'{}');
 insert into public.habit_logs(user_id,log_date,sleep_hours,mood,feelings,notes,water_liters,exercise_minutes) values
 (a,current_date,7,2,array['calm'],'PRIVATE-NEVER-RETURN',2,30),(a,prev,8,4,array['calm'],'PRIVATE-NEVER-RETURN',2,30);
 ca:=json_build_object('sub',a,'email','scope-a@example.test','role','authenticated')::text;
 cb:=json_build_object('sub',b,'email','scope-b@example.test','role','authenticated')::text;
 cc:=json_build_object('sub',c,'email','scope-c@example.test','role','authenticated')::text;
 if has_function_privilege('anon','public.shared_pillar_report(uuid,uuid)','EXECUTE') then raise exception 'FAIL anon'; end if;
 execute 'set local role authenticated'; perform set_config('request.jwt.claims',ca,true);
 sid:=public.invite_care_share_atomic(gen_random_uuid(),'scope-b@example.test',false,true,false,true,'detail',1,repeat('a',64));
 perform set_config('request.jwt.claims',cb,true);perform public.accept_care_share(sid);
 select count(sleep_hours) into n from public.shared_days(a,current_date,current_date);
 if n<>1 then raise exception 'FAIL positive detail control'; end if;
 perform set_config('request.jwt.claims',ca,true);
 perform public.set_care_share_matrix(sid,'{"eat":"off","sleep":"detail","move":"off","balance":"presence"}','live');
 perform set_config('request.jwt.claims',cb,true); r:=public.shared_pillar_report(a);
 if r#>>'{pillars,0,entries,0,values,sleep_hours}' is null then raise exception 'FAIL allowed sleep'; end if;
 if r#>>'{pillars,1,mood_logged}'<>'true' or r#>>'{pillars,1,feelings_logged}'<>'true' then raise exception 'FAIL Balance presence'; end if;
 if (r->'pillars'->1)::text ~ '"values"|"mood":|"feelings":|calm|PRIVATE' then raise exception 'FAIL Balance disclosure'; end if;
 if jsonb_array_length(r->'pillars')<>2 or r::text ~ 'water_liters|exercise_minutes' then raise exception 'FAIL off pillars'; end if;
 if r::text ~ 'PRIVATE|calm|notes|location' then raise exception 'FAIL private content'; end if;
 select count(*) into n from public.shared_days(a,current_date-27,current_date); if n<>0 then raise exception 'FAIL legacy daily bypass'; end if;
 select count(*) into n from public.shared_week_summary(a); if n<>0 then raise exception 'FAIL legacy summary bypass'; end if;
 select count(*) into n from public.shared_goals(a); if n<>0 then raise exception 'FAIL legacy goals bypass'; end if;
 -- Each non-detail level must omit values, regardless of cadence.
 foreach lev in array array['presence','summary'] loop
  perform set_config('request.jwt.claims',ca,true);
  perform public.set_care_share_matrix(sid,jsonb_build_object('eat','off','sleep',lev,'move','off','balance',lev),'live');
  perform set_config('request.jwt.claims',cb,true);r:=public.shared_pillar_report(a);
  if r::text ~ '"values"|"measures"' then raise exception 'FAIL non-detail values'; end if;
 end loop;
 perform set_config('request.jwt.claims',ca,true);
 perform public.set_care_share_matrix(sid,'{"eat":"off","sleep":"detail","move":"off","balance":"presence"}','monthly');
 perform set_config('request.jwt.claims',cb,true);r:=public.shared_pillar_report(a);
 if (r->>'to')::date<>prev or r::text ~ '"entries"|"values"' then raise exception 'FAIL monthly raw/current data'; end if;
 if (r#>>'{pillars,0,measures,sleep_hours,average}')::numeric<>8 then raise exception 'FAIL monthly average'; end if;
 if (r#>>'{pillars,0,measures,sleep_hours,days}')::int<>1 then raise exception 'FAIL monthly coverage'; end if;
 -- Another user cannot read, preview or change scope.
 perform set_config('request.jwt.claims',cc,true);
 if public.shared_pillar_report(a) is not null or public.shared_pillar_report(a,sid) is not null then raise exception 'FAIL stranger access'; end if;
 caught:=false;
 begin perform public.set_care_share_matrix(sid,'{"eat":"off","sleep":"detail","move":"off","balance":"detail"}','live');
 exception when no_data_found then caught:=true;end;
 if not caught then raise exception 'FAIL wrong-owner write';end if;
 perform set_config('request.jwt.claims',ca,true);
 -- Saved owner preview matches recipient report; recipient cannot use preview path.
 if public.shared_pillar_report(a,sid) is distinct from r then raise exception 'FAIL preview parity'; end if;
 caught:=false;
 begin perform public.update_care_share_scope(sid,true,true,true,true,'detail');exception when invalid_parameter_value then caught:=true;end;
 if not caught then raise exception 'FAIL legacy overwrite';end if;
 caught:=false;
 begin perform public.set_care_share_matrix(sid,'{"eat":"off","sleep":"off","move":"off","balance":"off"}','monthly');exception when invalid_parameter_value then caught:=true;end;
 if not caught then raise exception 'FAIL empty grant';end if;
 caught:=false;
 begin perform public.set_care_share_matrix(sid,'{"eat":"off","sleep":null,"move":"off","balance":"detail"}','monthly');exception when invalid_parameter_value then caught:=true;end;
 if not caught then raise exception 'FAIL null level';end if;
 perform public.set_care_share_options(sid,null,true);
 perform set_config('request.jwt.claims',cb,true);if public.shared_pillar_report(a) is not null then raise exception 'FAIL paused';end if;
 perform set_config('request.jwt.claims',ca,true);perform public.set_care_share_options(sid,null,false);
 perform set_config('request.jwt.claims',cb,true);if public.shared_pillar_report(a) is null then raise exception 'FAIL resume';end if;
 perform set_config('request.jwt.claims',ca,true);perform public.end_care_share(sid);
 perform set_config('request.jwt.claims',cb,true);if public.shared_pillar_report(a) is not null then raise exception 'FAIL revoked';end if;
 raise exception 'RESULT: PASS scoped disclosure, legacy bypass, monthly restriction, preview, authorization, invalid scope, pause/revoke. ALL FIXTURES ROLLED BACK.' using errcode='ZB022';
end $$;
rollback;
