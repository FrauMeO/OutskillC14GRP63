# Demo account snapshot, 2026-09-25

Exported from Supabase project `gzsawayrorlcjmpssalc` (PersonalHealthManager) for the demo
account `msolmsted+demo@gmail.com`, just before migration 0006 (Prompt 4). It doubles as a
backup of the data at that point.

- `habit_logs.csv`: 60 rows. 59 sample days (2026-07-26 to 2026-09-23, from the seed) and one
  real entry Miah made in the app on 2026-09-25 (device location, weather not yet final).
- `daily_conditions.csv`: 60 rows. Real Open-Meteo weather and air quality for the same days.
- Profile: home city Philadelphia, Pennsylvania (US, 40.0, -75.2).

Blank cells mean "not logged" (null), never zero. Feelings are separated by semicolons.
Data from Open-Meteo.com (CC BY 4.0), free for non-commercial use.
To recreate the 59 sample days, run `sample-data/seed_habit_logs.sql`.
