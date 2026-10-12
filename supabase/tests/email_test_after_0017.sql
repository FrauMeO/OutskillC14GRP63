-- Test for migration 0017 (email layer). NOT a migration; rolls back via the deliberate exception.
-- Needs 0010-0015 applied first (care_shares with level and paused_at). Run in the SQL editor or psql.
-- Expected, read the RESULT line: every "ok" must be ok; every "control" proves the check can fail.
--   nudge_default_blocked=blocked  nudge_after_owner_allows=sent(control)  bad_preset=blocked
--   second_same_day=blocked  stranger_set_pref=blocked  viewer_sets_owner_pref=blocked
--   owner_sets_digest_pref=blocked  viewer_sets_digest_pref=ok(control)
--   paused_nudge=blocked  revoked_nudge=blocked  other_sees_prefs=0  party_sees_prefs=1(control)
--   token_column_read=blocked  email_log_read=blocked  suppressions_read=blocked  confirmations_read=blocked
--   wrong_mute=false  right_mute=true(control)  mute_flag_after=false  wrong_digest_unsub=false  right_digest_unsub=true(control)
--   confirm_wrong=false  confirm_ok=true(control)  confirm_reuse=false  confirm_expired=false
--   waitlist_consent_kept_first=true  anon_may_not_call_set_pref=blocked
--   trend_lower=a_little_lower  trend_usual=about_usual(control)  trend_few_days=not_enough_days  trend_presence_level=0rows
--   digest_rows_paused=0  digest_rows_active=1(control)  digest_days=5  email_log_dup_key=blocked
do $$
declare
  a uuid := gen_random_uuid();   -- owner
  b uuid := gen_random_uuid();   -- supporter
  c uuid := gen_random_uuid();   -- stranger
  sh uuid; sh2 uuid;
  r_default text := 'FAILED'; r_after text := 'FAILED'; r_preset text := 'ALLOWED'; r_second text := 'ALLOWED';
  r_stranger text := 'ALLOWED'; r_viewer_owner text := 'ALLOWED'; r_owner_digest text := 'ALLOWED'; r_viewer_digest text := 'FAILED';
  r_paused text := 'ALLOWED'; r_revoked text := 'ALLOWED';
  other_sees int; party_sees int;
  r_tok text := 'ALLOWED'; r_log text := 'ALLOWED'; r_supp text := 'ALLOWED'; r_conf text := 'ALLOWED';
  m_wrong boolean; m_right boolean; m_flag boolean; d_wrong boolean; d_right boolean;
  c_wrong boolean; c_ok boolean; c_reuse boolean; c_exp boolean; first_kept boolean;
  r_anon text := 'ALLOWED';
  t_lower text; t_usual text; t_few text; t_presence int;
  dig_paused int; dig_active int; dig_days int; r_dup text := 'ALLOWED';
  tok_mute text := 'mute-token-for-test-0123456789';
  tok_dig text := 'digest-token-for-test-0123456789';
  tok_w1 text := 'waitlist-token-one-0123456789';
  tok_w2 text := 'waitlist-token-two-0123456789';
  first_consent timestamptz;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-0017@example.test', now(), '{"full_name":"Anna Smith"}', now(), now()),
         (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'supporter-0017@example.test', now(), '{}', now(), now()),
         (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-0017@example.test', now(), '{}', now(), now());

  insert into public.care_shares (owner_id, viewer_email, viewer_id, status, accepted_at, share_sleep, share_eat, share_move, share_balance, level)
  values (a, 'supporter-0017@example.test', b, 'active', now(), true, false, false, false, 'summary') returning id into sh;

  -- ===== supporter (b) tries to nudge before the owner allows it =====
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'email', 'supporter-0017@example.test')::text, true);
  begin perform public.send_care_nudge(sh, 'Thinking of you'); r_default := 'ALLOWED'; exception when others then r_default := 'blocked'; end;

  -- supporter may not set the owner's flag; may set their own digest flag
  begin perform public.set_nudge_pref(sh, true); r_viewer_owner := 'ALLOWED'; exception when others then r_viewer_owner := 'blocked'; end;
  begin perform public.set_digest_pref(sh, true, 'America/Vancouver'); r_viewer_digest := 'ok'; exception when others then r_viewer_digest := 'FAILED'; end;

  -- stranger (c) cannot set anything on this share
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin perform public.set_nudge_pref(sh, true); r_stranger := 'ALLOWED'; exception when others then r_stranger := 'blocked'; end;
  select count(*) into other_sees from public.care_share_email_prefs;

  -- ===== owner (a) allows nudges; cannot set the supporter's digest flag =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.set_nudge_pref(sh, true, 'America/Vancouver');
  begin perform public.set_digest_pref(sh, false); r_owner_digest := 'ALLOWED'; exception when others then r_owner_digest := 'blocked'; end;

  -- ===== supporter nudges: ok once, never twice, never free text =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into party_sees from public.care_share_email_prefs;
  begin perform public.send_care_nudge(sh, 'Hello, why are you not answering?'); r_preset := 'ALLOWED'; exception when others then r_preset := 'blocked'; end;
  begin perform public.send_care_nudge(sh, 'Want to take a walk?'); r_after := 'sent'; exception when others then r_after := 'FAILED'; end;
  begin perform public.send_care_nudge(sh, 'Thinking of you'); r_second := 'ALLOWED'; exception when others then r_second := 'blocked'; end;

  -- browser roles cannot read tokens, the log, the suppression list or confirmations
  begin perform mute_token_hash from public.care_share_email_prefs; r_tok := 'ALLOWED'; exception when insufficient_privilege then r_tok := 'blocked'; end;
  begin perform 1 from public.email_log; r_log := 'ALLOWED'; exception when insufficient_privilege then r_log := 'blocked'; end;
  begin perform 1 from public.email_suppressions; r_supp := 'ALLOWED'; exception when insufficient_privilege then r_supp := 'blocked'; end;
  begin perform 1 from public.waitlist_confirmations; r_conf := 'ALLOWED'; exception when insufficient_privilege then r_conf := 'blocked'; end;

  -- ===== pause and revoke send nothing =====
  execute 'reset role';
  delete from public.care_nudges;                       -- clear the daily limit so only the pause/revoke rules are tested
  update public.care_shares set paused_at = now() where id = sh;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.send_care_nudge(sh, 'Thinking of you'); r_paused := 'ALLOWED'; exception when others then r_paused := 'blocked'; end;
  execute 'reset role';
  update public.care_shares set paused_at = null, status = 'revoked', ended_at = now() where id = sh;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.send_care_nudge(sh, 'Thinking of you'); r_revoked := 'ALLOWED'; exception when others then r_revoked := 'blocked'; end;
  execute 'reset role';

  -- ===== link tokens (called signed out) =====
  update public.care_shares set status = 'active', ended_at = null where id = sh;
  update public.care_share_email_prefs
     set mute_token_hash = encode(sha256(convert_to(tok_mute, 'utf8')), 'hex'),
         digest_token_hash = encode(sha256(convert_to(tok_dig, 'utf8')), 'hex'),
         owner_allows_nudges = true, supporter_digest = true
   where share_id = sh;
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  m_wrong := public.mute_nudges_by_token('not-the-right-token-0123456789');
  d_wrong := public.unsubscribe_digest_by_token(tok_mute);       -- the mute token must not work as an unsubscribe token
  m_right := public.mute_nudges_by_token(tok_mute);
  d_right := public.unsubscribe_digest_by_token(tok_dig);
  begin perform public.set_nudge_pref(sh, true); r_anon := 'ALLOWED'; exception when others then r_anon := 'blocked'; end;
  execute 'reset role';
  select owner_allows_nudges into m_flag from public.care_share_email_prefs where share_id = sh;

  -- ===== waiting list: double opt-in =====
  insert into public.waitlist (email, want_ios, want_android, consent_at) values ('first@example.test', true, false, '2026-01-01 00:00+00');
  insert into public.waitlist_confirmations (token_hash, email, want_ios, want_android)
  values (encode(sha256(convert_to(tok_w1, 'utf8')), 'hex'), 'first@example.test', false, true);
  insert into public.waitlist_confirmations (token_hash, email, want_ios, want_android, created_at, expires_at)
  values (encode(sha256(convert_to(tok_w2, 'utf8')), 'hex'), 'second@example.test', true, false, now() - interval '3 days', now() - interval '1 day');
  execute 'set local role anon';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  c_wrong := public.confirm_waitlist('not-the-right-token-0123456789');
  c_ok := public.confirm_waitlist(tok_w1);
  c_reuse := public.confirm_waitlist(tok_w1);
  c_exp := public.confirm_waitlist(tok_w2);
  execute 'reset role';
  select consent_at into first_consent from public.waitlist where email = 'first@example.test';
  first_kept := first_consent = '2026-01-01 00:00+00' and (select want_ios and want_android from public.waitlist where email = 'first@example.test');

  -- ===== log: one live row per dedupe key =====
  insert into public.email_log (kind, recipient_hash, status, dedupe_key) values ('weekly_digest', repeat('a', 64), 'sent', 'weekly_digest:x:2026-10-12');
  begin
    insert into public.email_log (kind, recipient_hash, status, dedupe_key) values ('weekly_digest', repeat('a', 64), 'queued', 'weekly_digest:x:2026-10-12');
  exception when unique_violation then r_dup := 'blocked'; end;

  -- ===== trends: baseline 8 sleep hours; a week at 6 hours is lower; a week of 3 days is not enough =====
  insert into public.habit_logs (user_id, log_date, sleep_hours)
  select a, current_date - g, 8 from generate_series(8, 40) g;
  insert into public.habit_logs (user_id, log_date, sleep_hours)
  select a, current_date - g, 6 from generate_series(1, 5) g;
  select trend into t_lower from public.email_week_trends(sh) where pillar = 'sleep';
  delete from public.habit_logs where user_id = a and log_date >= current_date - 5;
  insert into public.habit_logs (user_id, log_date, sleep_hours) select a, current_date - g, 8 from generate_series(1, 5) g;   -- control: same as usual
  select trend into t_usual from public.email_week_trends(sh) where pillar = 'sleep';
  delete from public.habit_logs where user_id = a and log_date >= current_date - 5;
  insert into public.habit_logs (user_id, log_date, sleep_hours) select a, current_date - g, 6 from generate_series(1, 3) g;   -- only 3 days
  select trend into t_few from public.email_week_trends(sh) where pillar = 'sleep';
  update public.care_shares set level = 'presence' where id = sh;
  select count(*) into t_presence from public.email_week_trends(sh);
  update public.care_shares set level = 'summary' where id = sh;

  -- ===== digest inputs: active+opted-in shows up with a day count; paused does not =====
  update public.care_share_email_prefs set supporter_digest = true where share_id = sh;   -- the unsubscribe link above turned it off
  delete from public.habit_logs where user_id = a and log_date >= current_date - 6;
  insert into public.habit_logs (user_id, log_date, sleep_hours, notes) select a, current_date - g, 7, 'private note' from generate_series(0, 4) g;
  select count(*), max(days_logged) into dig_active, dig_days from public.email_digest_inputs() where share_id = sh;
  update public.care_shares set paused_at = now() where id = sh;
  select count(*) into dig_paused from public.email_digest_inputs() where share_id = sh;

  raise exception 'RESULT nudge_default_blocked=% nudge_after_owner_allows=% bad_preset=% second_same_day=% stranger_set_pref=% viewer_sets_owner_pref=% owner_sets_digest_pref=% viewer_sets_digest_pref=% paused_nudge=% revoked_nudge=% other_sees_prefs=% party_sees_prefs=% token_column_read=% email_log_read=% suppressions_read=% confirmations_read=% wrong_mute=% right_mute=% mute_flag_after=% wrong_digest_unsub=% right_digest_unsub=% confirm_wrong=% confirm_ok=% confirm_reuse=% confirm_expired=% waitlist_consent_kept_first=% anon_may_not_call_set_pref=% trend_lower=% trend_usual=% trend_few_days=% trend_presence_level=%rows digest_rows_paused=% digest_rows_active=% digest_days=% email_log_dup_key=%',
    r_default, r_after, r_preset, r_second, r_stranger, r_viewer_owner, r_owner_digest, r_viewer_digest, r_paused, r_revoked,
    other_sees, party_sees, r_tok, r_log, r_supp, r_conf, m_wrong, m_right, m_flag, d_wrong, d_right,
    c_wrong, c_ok, c_reuse, c_exp, first_kept, r_anon, t_lower, t_usual, t_few, t_presence,
    dig_paused, dig_active, dig_days, r_dup;
end $$;
