// Travel demo year (Miah, 2026-09-26): one real person's year of Apple Health totals, made
// public-proof, travelling through about 50 places she has been. Runs the app's own city search
// and weather code. Writes files only; loading them into the Demo account is a separate,
// approved step.
//
//   npx vite-node scripts/build-travel-demo.ts <habit_logs.csv from the importer> <output folder>
//
// Redaction (agreed with Miah):
//  - Only daily totals: steps, exercise, stand hours, active energy, sleep, time in bed, awake.
//    Nothing else from the export is read here. Calories eaten are left out.
//  - Dates are rotated by a fixed offset inside the year, so no value sits on its real date.
//  - Rounded: steps to 100, exercise to 5 min, active energy to 10 kcal, sleep, time in bed and
//    awake time to the quarter hour. Impossible values (over 24 hours) are dropped.
//  - Places are cities only (the city's own centre from the city search), never a real point.
//  - Water and mood/energy/stress/feelings are made up (Miah tracks water and mood elsewhere).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { searchCities } from '../src/lib/location';
import { fetchConditionRange } from '../src/lib/conditionsCore';
import { addDays } from '../src/lib/dashboard';

const [inputCsv, outDir] = process.argv.slice(2);
if (!inputCsv || !outDir) throw new Error('Usage: build-travel-demo.ts <habit_logs.csv> <output folder>');

const LAST_DAY = '2026-09-26'; // the demo year ends today (Philadelphia time)
const DAYS = 365;
const FIRST_DAY = addDays(LAST_DAY, -(DAYS - 1));
const ROTATE = 150; // demo day D shows the real totals from D - 150 days, wrapped within the year

// One plausible year of travel, in order. [search, state or province code, country, days]
const STAYS: [string, string, string, number][] = [
  ['Philadelphia', 'Pennsylvania', 'US', 7],
  ['North Wildwood', 'New Jersey', 'US', 3],
  ['New York', 'New York', 'US', 10],
  ['North Bergen', 'New Jersey', 'US', 2],
  ['Providence', 'Rhode Island', 'US', 6],
  ['Warwick', 'Rhode Island', 'US', 3],
  ['Richmond', 'Virginia', 'US', 7],
  ['Atlanta', 'Georgia', 'US', 15],
  ['Orlando', 'Florida', 'US', 7],
  ['Kissimmee', 'Florida', 'US', 5],
  ['New Orleans', 'Louisiana', 'US', 20],
  ['Austin', 'Texas', 'US', 15],
  ['San Antonio', 'Texas', 'US', 5],
  ['Missouri City', 'Texas', 'US', 3],
  ['Carlsbad', 'New Mexico', 'US', 3],
  ['Albuquerque', 'New Mexico', 'US', 10],
  ['Flagstaff', 'Arizona', 'US', 4],
  ['Las Vegas', 'Nevada', 'US', 6],
  ['San Diego', 'California', 'US', 22],
  ['San Jose', 'California', 'US', 6],
  ['Dixon', 'California', 'US', 3],
  ['Eureka', 'California', 'US', 4],
  ['Eugene', 'Oregon', 'US', 5],
  ['Portland', 'Oregon', 'US', 13],
  ['Seattle', 'Washington', 'US', 10],
  ['Edmonds', 'Washington', 'US', 6],
  ['Lynnwood', 'Washington', 'US', 5],
  ['Vancouver', 'British Columbia', 'CA', 8],
  ['Gibsons', 'British Columbia', 'CA', 4],
  ['Nanoose Bay', 'British Columbia', 'CA', 4],
  ['Kelowna', 'British Columbia', 'CA', 20],
  ['West Kelowna', 'British Columbia', 'CA', 6],
  ['Penticton', 'British Columbia', 'CA', 4],
  ['Spokane', 'Washington', 'US', 7],
  ['Deer Park', 'Washington', 'US', 3],
  ['Missoula', 'Montana', 'US', 8],
  ['Deer Lodge', 'Montana', 'US', 3],
  ['Billings', 'Montana', 'US', 4],
  ['Bismarck', 'North Dakota', 'US', 5],
  ['Fargo', 'North Dakota', 'US', 4],
  ['Prior Lake', 'Minnesota', 'US', 11],
  ['Eagan', 'Minnesota', 'US', 4],
  ['Hudson', 'Wisconsin', 'US', 3],
  ['Wisconsin Dells', 'Wisconsin', 'US', 4],
  ['Madison', 'Wisconsin', 'US', 5],
  ['Chicago', 'Illinois', 'US', 20],
  ['Schaumburg', 'Illinois', 'US', 3],
  ['Akron', 'Ohio', 'US', 6],
  ['State College', 'Pennsylvania', 'US', 4],
  ['Camden', 'New Jersey', 'US', 6],
  ['Philadelphia', 'Pennsylvania', 'US', 14],
];

// ---------- helpers ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const rand = rng(20260926);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));

// ---------- 1. real daily totals, redacted and rotated ----------
const [header, ...lines] = readFileSync(inputCsv, 'utf8').trim().split('\n');
const cols = header.split(',');
const real = new Map(lines.map((l) => {
  const r = Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]));
  return [r.log_date, r];
}));

function realFor(demoDate: string) {
  const offset = Math.round((Date.parse(demoDate) - Date.parse(FIRST_DAY)) / 86_400_000);
  const src = addDays(FIRST_DAY, (offset - ROTATE + DAYS * 10) % DAYS);
  const r = real.get(src);
  if (!r) return null;
  const hours = (v: number | null) => (v === null || v > 24 ? null : roundTo(v, 0.25));
  const out = {
    steps: num(r.steps) === null ? null : roundTo(num(r.steps)!, 100),
    exercise_minutes: num(r.exercise_minutes) === null ? null : Math.min(1440, roundTo(num(r.exercise_minutes)!, 5)),
    stand_hours: num(r.stand_hours) === null || num(r.stand_hours)! > 24 ? null : num(r.stand_hours),
    active_calories: num(r.active_calories) === null ? null : roundTo(num(r.active_calories)!, 10),
    sleep_hours: hours(num(r.sleep_hours)),
    time_in_bed_hours: hours(num(r.time_in_bed_hours)),
    awake_minutes: num(r.awake_minutes) === null || num(r.awake_minutes)! > 1440 ? null : roundTo(num(r.awake_minutes)!, 15),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

// ---------- 2. places and dates ----------
const total = STAYS.reduce((n, s) => n + s[3], 0);
if (total !== DAYS) throw new Error(`Stays add up to ${total} days, not ${DAYS}`);

type Place = { name: string; latitude: number; longitude: number; home: boolean };
const places = new Map<string, Place>();
for (const [q, admin, country] of STAYS) {
  const key = `${q}|${admin}`;
  if (places.has(key)) continue;
  const matches = await searchCities(q);
  const m =
    matches.find((x) => x.countryCode === country && x.city === `${q}, ${admin}`) ??
    matches.find((x) => x.countryCode === country && x.city.includes(admin)) ??
    matches.find((x) => x.countryCode === country);
  if (!m) throw new Error(`No match for ${q}, ${admin}`);
  // The city's own name as the person would say it; coordinates from the search.
  places.set(key, { name: `${q}, ${admin}`, latitude: m.latitude, longitude: m.longitude, home: q === 'Philadelphia' });
  await new Promise((r) => setTimeout(r, 150));
}

const schedule: { date: string; key: string }[] = [];
let cursor = FIRST_DAY;
for (const [q, admin, , n] of STAYS) {
  for (let i = 0; i < n; i++) {
    schedule.push({ date: cursor, key: `${q}|${admin}` });
    cursor = addDays(cursor, 1);
  }
}

// ---------- 3. real weather for each stay ----------
const conditions = new Map<string, Record<string, unknown>>();
let s = 0;
while (s < schedule.length) {
  let e = s;
  while (e + 1 < schedule.length && schedule[e + 1].key === schedule[s].key) e++;
  const p = places.get(schedule[s].key)!;
  const rows = await fetchConditionRange(p, schedule[s].date, schedule[e].date, LAST_DAY);
  for (const r of rows) conditions.set(r.date, r as unknown as Record<string, unknown>);
  s = e + 1;
  await new Promise((r) => setTimeout(r, 200));
}

// ---------- 4. made-up water and check-ins, gently tied to the real days ----------
const HAPPY = ['calm', 'grateful', 'hopeful', 'peaceful', 'proud', 'confident', 'steady'];
const LOW = ['tired', 'anxious', 'frustrated', 'overwhelmed', 'meh', 'lonely'];
const logs: Record<string, unknown>[] = [];
for (const { date, key } of schedule) {
  const p = places.get(key)!;
  const w = conditions.get(date) ?? {};
  const d = realFor(date);
  const hot = Number(w.temp_max_c ?? 0) >= 28;
  const water = rand() < 0.8 ? roundTo(clamp(1.6 + (hot ? 0.5 : 0) + (rand() - 0.5) * 1.2, 1.2, 2.8), 0.1) : null;
  if (!d && water === null) continue; // a quiet day: nothing logged

  let checkin: Record<string, unknown> = { mood: null, energy: null, stress: null, feelings: null };
  // About 60% of days have a check-in, like real life; the last week always does, so the demo's
  // "This week and your usual" includes mood, energy and stress.
  if (rand() < 0.6 || date > addDays(LAST_DAY, -7)) {
    const sleep = d?.sleep_hours ?? 6.5;
    const heavy = (d?.exercise_minutes ?? 0) >= 180;
    const grey = Number(w.sunshine_hours ?? 8) < 2;
    const rainy = Number(w.rain_mm ?? 0) > 2;
    const mood = clamp(Math.round(3.5 + (rand() - 0.5) * 1.8 - (grey ? 0.6 : 0) - (rainy ? 0.4 : 0) + (sleep >= 7 ? 0.3 : 0)), 1, 5);
    const energy = clamp(Math.round(3 + 0.45 * (sleep - 6.5) + (rand() - 0.5) * 1.6), 1, 5);
    const stress = clamp(Math.round(2.7 + (heavy ? 1 : 0) + (sleep < 4 ? 0.6 : 0) + (rand() - 0.5) * 1.6), 1, 5);
    const pool = mood >= 4 ? HAPPY : mood <= 2 ? LOW : [...HAPPY.slice(0, 3), 'meh', 'tired'];
    const feelings = [...new Set([pick(pool), ...(rand() < 0.5 ? [pick(pool)] : []), ...(sleep < 4 ? ['tired'] : [])])];
    // The recording week stays gentle, so the reflection and the coach speak for themselves;
    // hard days elsewhere in the year are kept (the app answers those with a fixed, caring message).
    const recent = date > addDays(LAST_DAY, -7);
    checkin = recent
      ? { mood: Math.max(mood, 3), energy, stress: Math.min(stress, 3), feelings: feelings.filter((f) => f !== 'overwhelmed' && f !== 'lonely').concat(mood < 3 ? ['steady'] : []) }
      : { mood, energy, stress, feelings };
  }
  logs.push({
    log_date: date,
    ...(d ?? {}),
    water_liters: water,
    calories_consumed: null,
    ...checkin,
    notes: null,
    source: d ? 'apple_health' : 'manual',
    location_name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    location_source: p.home ? 'home' : 'device',
  });
}

// ---------- 5. write ----------
mkdirSync(outDir, { recursive: true });
const condRows = [...conditions.values()].filter((c) => logs.some((l) => l.log_date === c.date));
writeFileSync(`${outDir}/travel_demo_rows.json`, JSON.stringify({ logs, conditions: condRows }, null, 2) + '\n');

const byPlace = new Map<string, number>();
for (const l of logs) byPlace.set(String(l.location_name), (byPlace.get(String(l.location_name)) ?? 0) + 1);
const count = (f: (l: Record<string, unknown>) => boolean) => logs.filter(f).length;
const summary = [
  `Demo year ${FIRST_DAY} to ${LAST_DAY}: ${logs.length} logged days in ${byPlace.size} places.`,
  `Philadelphia days: ${schedule.filter((x) => x.key.startsWith('Philadelphia')).length}; Seattle area days: ${schedule.filter((x) => /^(Seattle|Edmonds|Lynnwood)\|/.test(x.key)).length}.`,
  `With Apple Health totals: ${count((l) => l.source === 'apple_health')}; with a check-in: ${count((l) => l.mood !== null)}; with water: ${count((l) => l.water_liters !== null)}.`,
  `Weather rows: ${condRows.length}.`,
  '',
  ...[...byPlace].map(([k, v]) => `  ${k}: ${v}`),
].join('\n');
writeFileSync(`${outDir}/travel_demo_summary.txt`, summary + '\n');
console.log(summary);
