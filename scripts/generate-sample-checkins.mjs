// Synthetic daily check-ins (mood, energy, stress, feelings) for the sample days.
// Apple Health has none of these, so they live in their own file instead of the export.
//   node scripts/generate-sample-checkins.mjs   -> sample-data/checkins.csv
// Deterministic: same seed and inputs, same file. No real person's data.
//
// Planted, on purpose (Prompt 3B must find it as a Likely pattern):
//  - Mood is 1 point lower on days with more than 2 mm of rain (sample-data/conditions.json).
// Planted nothing else involving weather or the moon (moon is the negative control).
// Background structure, so the data looks like a person's:
//  - Energy rises a little with the night's sleep; stress moves opposite to mood.
//  - Feelings follow the day's mood; a few days have no check-in at all.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../sample-data/', import.meta.url);
const SEED = 20260925;
export const RAIN_MM = 2;
export const RAIN_EFFECT = -1;
const SKIP_RATE = 0.07;

let s = SEED;
const rand = () => {
  // mulberry32
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const scale = (x) => Math.min(5, Math.max(1, Math.round(x)));
const pick = (list, n) => {
  const pool = [...list], out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
};

const conditions = JSON.parse(readFileSync(new URL('conditions.json', dir), 'utf8'));
const [header, ...lines] = readFileSync(new URL('habit_logs.csv', dir), 'utf8').trim().split('\n');
const cols = header.split(',');
const col = (row, name) => row[cols.indexOf(name)];
// Check-ins are drawn only for days with exercise, sleep or water data (the original 59 sample
// days). Days that only gained steps or stand hours in Prompt 4 (2026-09-14) get no check-in, so
// adding them never shifts the random draws, and the check-ins stay exactly as validated in 3B.
const days = lines
  .map((l) => l.split(','))
  .filter((r) => ['exercise_minutes', 'sleep_hours', 'water_liters'].some((f) => col(r, f) !== ''))
  .map((r) => ({ date: col(r, 'log_date'), sleep: col(r, 'sleep_hours') === '' ? null : Number(col(r, 'sleep_hours')) }));

const rows = [];
for (const { date, sleep } of days) {
  // Draw every random number every day, so skipping a day never shifts the others.
  const skip = rand() < SKIP_RATE;
  const moodNoise = normal(), energyNoise = normal(), stressNoise = normal(), feelCount = rand();
  const c = conditions[date];
  if (!c) throw new Error(`No conditions for ${date}; run scripts/fetch-sample-conditions.mjs first.`);
  const rainy = c.rain_mm > RAIN_MM;

  const moodRaw = 3.7 + 0.75 * moodNoise + (rainy ? RAIN_EFFECT : 0);
  const mood = scale(moodRaw);
  const energy = scale(3.2 + (sleep === null ? 0 : 0.35 * (sleep - 7)) + 0.6 * energyNoise);
  const stress = scale(2.6 - 0.4 * (moodRaw - 3.7) + 0.6 * stressNoise);

  let feelings;
  if (mood <= 2) feelings = pick(['frustrated', 'overwhelmed'], feelCount < 0.5 ? 1 : 2);
  else if (mood === 3) feelings = feelCount < 0.35 ? [] : pick(['calm', 'overwhelmed', 'frustrated'], 1);
  else feelings = pick(['calm', 'peaceful', 'confident', 'grateful'], feelCount < 0.5 ? 1 : 2);

  if (!skip) rows.push({ date, mood, energy, stress, feelings, rainy });
}

writeFileSync(
  new URL('checkins.csv', dir),
  'log_date,mood,energy,stress,feelings\n' +
    rows.map((r) => [r.date, r.mood, r.energy, r.stress, r.feelings.join(';')].join(',')).join('\n') + '\n',
);

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const wet = rows.filter((r) => r.rainy), dry = rows.filter((r) => !r.rainy);
console.log(`Wrote ${rows.length} check-ins for ${days.length} sample days (${days.length - rows.length} skipped).`);
console.log(`Mood on rainy days ${avg(wet.map((r) => r.mood)).toFixed(2)} (${wet.length}) vs dry ${avg(dry.map((r) => r.mood)).toFixed(2)} (${dry.length}).`);
