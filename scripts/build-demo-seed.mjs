// Builds the one seed file for the demo account from the three sample sources:
//   habit_logs.csv  (from the Apple Health importer)
//   checkins.csv    (from generate-sample-checkins.mjs)
//   conditions.json (real Open-Meteo data, from fetch-sample-conditions.mjs)
//   node scripts/build-demo-seed.mjs [demo-email]
// Outputs: sample-data/seed_habit_logs.sql (run it in the SQL editor or through the connector)
//          sample-data/seed_rows.json      (the exact rows in the seed, checked by verify-seed.mjs)
import { readFileSync, writeFileSync } from 'node:fs';

const email = process.argv[2] ?? 'msolmsted+demo@gmail.com';
const dir = new URL('../sample-data/', import.meta.url);

const csv = (name) => {
  const [header, ...lines] = readFileSync(new URL(name, dir), 'utf8').trim().split('\n');
  const cols = header.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};
const num = (v) => (v === '' || v === undefined ? null : Number(v));

const habits = csv('habit_logs.csv');
const checkins = new Map(csv('checkins.csv').map((r) => [r.log_date, r]));
const conditions = JSON.parse(readFileSync(new URL('conditions.json', dir), 'utf8'));

const logs = habits.map((h) => {
  const c = checkins.get(h.log_date);
  const where = conditions[h.log_date];
  if (!where) throw new Error(`No conditions for ${h.log_date}`);
  return {
    log_date: h.log_date,
    exercise_minutes: num(h.exercise_minutes),
    sleep_hours: num(h.sleep_hours),
    water_liters: num(h.water_liters),
    steps: num(h.steps),
    stand_hours: num(h.stand_hours),
    active_calories: num(h.active_calories),
    time_in_bed_hours: num(h.time_in_bed_hours),
    awake_minutes: num(h.awake_minutes),
    calories_consumed: num(h.calories_consumed),
    source: 'apple_health',
    mood: c ? num(c.mood) : null,
    energy: c ? num(c.energy) : null,
    stress: c ? num(c.stress) : null,
    feelings: c && c.feelings ? c.feelings.split(';') : null,
    location_name: where.location_name,
    latitude: where.latitude,
    longitude: where.longitude,
    location_source: where.location_source,
  };
});
const logged = new Set(logs.map((l) => l.log_date));
const conditionRows = Object.values(conditions).filter((c) => logged.has(c.date));

writeFileSync(new URL('seed_rows.json', dir), JSON.stringify({ email, logs, conditions: conditionRows }, null, 2) + '\n');

const q = (v) => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a === null ? 'null::text[]' : `array[${a.map(q).join(', ')}]`);
const C_COLS = [
  'date', 'location_name', 'latitude', 'longitude', 'precipitation_mm', 'rain_mm', 'snowfall_cm',
  'humidity_mean_pct', 'pressure_mean_hpa', 'temp_min_c', 'temp_max_c', 'apparent_temp_max_c',
  'uv_index_max', 'daylight_hours', 'sunshine_hours', 'us_aqi_max', 'pm2_5_mean', 'pollen_max',
  'moon_illumination', 'moon_phase', 'is_final',
];
// A column that is null on every sample day (pollen outside Europe) would otherwise be read as text.
const C_TYPES = Object.fromEntries(
  C_COLS.filter((k) => !['date', 'location_name', 'moon_phase', 'is_final'].includes(k)).map((k) => [k, k === 'us_aqi_max' ? 'int' : 'numeric']),
);
const cval = (c, k) => (k === 'date' ? `'${c.date}'::date` : k === 'is_final' ? String(c.is_final) : q(c[k]));

writeFileSync(new URL('seed_habit_logs.sql', dir), `-- Seed for the demo account: habits (sample Apple Health export), check-ins (synthetic),
-- locations, and real Open-Meteo conditions for each sample day. Built by scripts/build-demo-seed.mjs.
-- 1) Sign up ${email} in the app first.  2) Run this in the Supabase SQL editor. Safe to re-run.
do $$ begin
  if not exists (select 1 from auth.users where email = '${email}') then
    raise exception 'No user ${email}. Sign up in the app first, then re-run.';
  end if;
end $$;

insert into public.habit_logs (user_id, log_date, exercise_minutes, sleep_hours, water_liters, notes,
  steps, stand_hours, active_calories, time_in_bed_hours, awake_minutes, calories_consumed, source,
  mood, energy, stress, feelings, location_name, latitude, longitude, location_source)
select u.id, v.log_date::date, v.ex, v.sleep, v.water, 'Imported: sample Apple Health export and sample check-in',
  v.steps, v.stand, v.active, v.in_bed, v.awake, v.food, 'apple_health',
  v.mood, v.energy, v.stress, v.feelings, v.place, v.lat, v.lon, v.src
from auth.users u
cross join (values
${logs
  .map(
    (r) =>
      `  ('${r.log_date}', ${q(r.exercise_minutes)}::int, ${q(r.sleep_hours)}::numeric, ${q(r.water_liters)}::numeric, ` +
      `${q(r.steps)}::int, ${q(r.stand_hours)}::numeric, ${q(r.active_calories)}::int, ${q(r.time_in_bed_hours)}::numeric, ` +
      `${q(r.awake_minutes)}::int, ${q(r.calories_consumed)}::int, ` +
      `${q(r.mood)}::smallint, ${q(r.energy)}::smallint, ${q(r.stress)}::smallint, ${arr(r.feelings)}, ` +
      `${q(r.location_name)}, ${r.latitude}::numeric, ${r.longitude}::numeric, '${r.location_source}')`,
  )
  .join(',\n')}
) as v(log_date, ex, sleep, water, steps, stand, active, in_bed, awake, food, mood, energy, stress, feelings, place, lat, lon, src)
where u.email = '${email}'
on conflict (user_id, log_date) do update
  set exercise_minutes = excluded.exercise_minutes,
      sleep_hours      = excluded.sleep_hours,
      water_liters     = excluded.water_liters,
      notes            = excluded.notes,
      steps            = excluded.steps,
      stand_hours      = excluded.stand_hours,
      active_calories  = excluded.active_calories,
      time_in_bed_hours = excluded.time_in_bed_hours,
      awake_minutes    = excluded.awake_minutes,
      calories_consumed = excluded.calories_consumed,
      source           = excluded.source,
      mood             = excluded.mood,
      energy           = excluded.energy,
      stress           = excluded.stress,
      feelings         = excluded.feelings,
      location_name    = excluded.location_name,
      latitude         = excluded.latitude,
      longitude        = excluded.longitude,
      location_source  = excluded.location_source;

insert into public.daily_conditions (user_id, ${C_COLS.join(', ')})
select u.id, ${C_COLS.map((k) => `v.${k}${C_TYPES[k] ? `::${C_TYPES[k]}` : ''}`).join(', ')}
from auth.users u
cross join (values
${conditionRows.map((c) => `  (${C_COLS.map((k) => cval(c, k)).join(', ')})`).join(',\n')}
) as v(${C_COLS.join(', ')})
where u.email = '${email}'
on conflict (user_id, date) do update
  set ${C_COLS.filter((k) => k !== 'date').map((k) => `${k} = excluded.${k}`).join(',\n      ')},
      fetched_at = now();
`);

console.log(`Seed: ${logs.length} habit_logs rows (${logs.filter((l) => l.mood !== null).length} with a check-in), ${conditionRows.length} daily_conditions rows, for ${email}.`);
