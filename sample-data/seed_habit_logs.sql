-- Seed habit_logs for the demo account from the sample Apple Health export.
-- 1) Sign up demo@healthapp.test in the app first.  2) Run this in the Supabase SQL editor. Safe to re-run.
do $$ begin
  if not exists (select 1 from auth.users where email = 'demo@healthapp.test') then
    raise exception 'No user demo@healthapp.test. Sign up in the app first, then re-run.';
  end if;
end $$;

insert into public.habit_logs (user_id, log_date, exercise_minutes, sleep_hours, water_liters, notes)
select u.id, v.log_date::date, v.ex, v.sleep, v.water, 'Imported: sample Apple Health export'
from auth.users u
cross join (values
  ('2026-07-26', 1::int, 8.55::numeric, 1.855::numeric),
  ('2026-07-27', 55::int, 7.92::numeric, 2.08::numeric),
  ('2026-07-28', 4::int, 6.48::numeric, 2.24::numeric),
  ('2026-07-29', 59::int, null::numeric, 1.5::numeric),
  ('2026-07-30', 20::int, 7.67::numeric, null::numeric),
  ('2026-07-31', 65::int, null::numeric, 2.17::numeric),
  ('2026-08-01', 6::int, 7.07::numeric, 1.62::numeric),
  ('2026-08-02', 3::int, 6.65::numeric, null::numeric),
  ('2026-08-03', 63::int, 6.75::numeric, 1.855::numeric),
  ('2026-08-04', 41::int, 6.93::numeric, 2.725::numeric),
  ('2026-08-05', 71::int, 6.75::numeric, 3.355::numeric),
  ('2026-08-06', 42::int, null::numeric, 1.71::numeric),
  ('2026-08-07', 52::int, 7.98::numeric, 2.79::numeric),
  ('2026-08-08', 2::int, 8.35::numeric, null::numeric),
  ('2026-08-09', 57::int, 8.32::numeric, 2.435::numeric),
  ('2026-08-10', 4::int, 7.52::numeric, 1.015::numeric),
  ('2026-08-11', null::int, 7.68::numeric, null::numeric),
  ('2026-08-12', 36::int, 7::numeric, 2.015::numeric),
  ('2026-08-13', 66::int, 7.97::numeric, 1.54::numeric),
  ('2026-08-14', 31::int, 7.67::numeric, null::numeric),
  ('2026-08-15', null::int, 8.48::numeric, null::numeric),
  ('2026-08-16', null::int, null::numeric, 1.015::numeric),
  ('2026-08-17', null::int, 5.88::numeric, 2.21::numeric),
  ('2026-08-18', null::int, 6.42::numeric, 1.99::numeric),
  ('2026-08-19', 68::int, 6.18::numeric, 0.91::numeric),
  ('2026-08-20', 6::int, 7.37::numeric, 1.99::numeric),
  ('2026-08-21', 47::int, null::numeric, null::numeric),
  ('2026-08-22', 27::int, null::numeric, 3.265::numeric),
  ('2026-08-23', 1::int, 8.13::numeric, 1.87::numeric),
  ('2026-08-24', 20::int, 7.08::numeric, 2.83::numeric),
  ('2026-08-25', 55::int, 5.53::numeric, 1.37::numeric),
  ('2026-08-26', 54::int, 5.9::numeric, 1.515::numeric),
  ('2026-08-27', 44::int, 5.52::numeric, null::numeric),
  ('2026-08-28', 26::int, null::numeric, 2.54::numeric),
  ('2026-08-29', 44::int, 6.52::numeric, 1.685::numeric),
  ('2026-08-30', 57::int, 8.63::numeric, 1.355::numeric),
  ('2026-08-31', 64::int, 5.88::numeric, 2.2::numeric),
  ('2026-09-01', 20::int, 5.83::numeric, 2.24::numeric),
  ('2026-09-02', 36::int, 5.52::numeric, null::numeric),
  ('2026-09-03', 63::int, 6.6::numeric, 2.08::numeric),
  ('2026-09-04', 31::int, 6.83::numeric, 0.83::numeric),
  ('2026-09-05', 69::int, 7.27::numeric, null::numeric),
  ('2026-09-06', 2::int, 8.22::numeric, 2.515::numeric),
  ('2026-09-07', 71::int, 6.43::numeric, 1.99::numeric),
  ('2026-09-08', 35::int, null::numeric, 2.515::numeric),
  ('2026-09-09', 64::int, 7.92::numeric, null::numeric),
  ('2026-09-10', 5::int, 6.95::numeric, 2.79::numeric),
  ('2026-09-11', 47::int, null::numeric, 1.105::numeric),
  ('2026-09-12', 52::int, 7.67::numeric, 2.04::numeric),
  ('2026-09-13', 46::int, null::numeric, 1.845::numeric),
  ('2026-09-15', 5::int, 7.92::numeric, 2.62::numeric),
  ('2026-09-16', 4::int, 5.52::numeric, 1.54::numeric),
  ('2026-09-17', 70::int, 5.88::numeric, 3.25::numeric),
  ('2026-09-18', 1::int, 6.9::numeric, 2.685::numeric),
  ('2026-09-19', null::int, 8.5::numeric, 2.66::numeric),
  ('2026-09-20', 37::int, null::numeric, 1.355::numeric),
  ('2026-09-21', 24::int, 6.43::numeric, 2.25::numeric),
  ('2026-09-22', 17::int, null::numeric, 2.015::numeric),
  ('2026-09-23', 40::int, 6.37::numeric, 1.935::numeric)
) as v(log_date, ex, sleep, water)
where u.email = 'demo@healthapp.test'
on conflict (user_id, log_date) do update
  set exercise_minutes = excluded.exercise_minutes,
      sleep_hours      = excluded.sleep_hours,
      water_liters     = excluded.water_liters,
      notes            = excluded.notes;
