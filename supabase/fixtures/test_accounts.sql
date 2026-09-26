-- Browser-test fixtures for two throwaway accounts (NOT a migration, NOT the demo seed).
-- Sign up both accounts in the app first. Delete them afterwards in Supabase under
-- Authentication > Users; their rows are removed by ON DELETE CASCADE.
--
-- msolmsted+glow@gmail.com:    13 past entries, so the next new day saved is the 14th (glow).
-- msolmsted+checkin@gmail.com: 12 consecutive days of check-ins ending yesterday, 8 of them harder
--                              days (mood 2 or stress 4), no offers: the gentle check-in appears.
do $$
declare
  glow uuid := (select id from auth.users where email = 'msolmsted+glow@gmail.com');
  chk  uuid := (select id from auth.users where email = 'msolmsted+checkin@gmail.com');
begin
  if glow is null or chk is null then
    raise exception 'Sign up both test accounts in the app first.';
  end if;

  insert into public.habit_logs (user_id, log_date, exercise_minutes, sleep_hours, water_liters, mood, energy, stress, notes, source)
  select glow, current_date - g, 20 + g, 7, 2, 4, 3, 2, 'Test fixture (glow)', 'manual'
  from generate_series(1, 13) as g
  on conflict (user_id, log_date) do nothing;

  insert into public.habit_logs (user_id, log_date, exercise_minutes, sleep_hours, water_liters, mood, energy, stress, notes, source)
  select chk, current_date - g, 15, 6.5, 1.5,
         case when g <= 8 then 2 else 4 end,   -- 8 harder days (mood 2) among the last 12
         2,
         case when g in (3, 6) then 4 else 3 end,
         'Test fixture (gentle check-in)', 'manual'
  from generate_series(1, 12) as g
  on conflict (user_id, log_date) do nothing;
end $$;
