// Checks that the demo seed (seed_rows.json) matches its three sources exactly, date by date,
// and that the planted rain pattern is present in the seeded rows.
// Positive control: corrupts one mood and one rain value in a copy and confirms both are caught.
import { readFileSync } from 'node:fs';

const dir = new URL('../sample-data/', import.meta.url);
const csv = (name) => {
  const [header, ...lines] = readFileSync(new URL(name, dir), 'utf8').trim().split('\n');
  const cols = header.split(',');
  return new Map(lines.map((l) => {
    const r = Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]));
    return [r.log_date, r];
  }));
};
const num = (v) => (v === '' || v === undefined ? null : Number(v));

const habits = csv('habit_logs.csv');
const checkins = csv('checkins.csv');
const conditions = JSON.parse(readFileSync(new URL('conditions.json', dir), 'utf8'));
const seed = JSON.parse(readFileSync(new URL('seed_rows.json', dir), 'utf8'));

function compare(s) {
  const problems = [];
  const seeded = new Map(s.logs.map((l) => [l.log_date, l]));
  for (const d of habits.keys()) if (!seeded.has(d)) problems.push(`${d}: missing from seed`);
  for (const [d, l] of seeded) {
    const h = habits.get(d), c = checkins.get(d), w = conditions[d];
    if (!h) { problems.push(`${d}: not a sample day`); continue; }
    const expect = {
      exercise_minutes: num(h.exercise_minutes), sleep_hours: num(h.sleep_hours), water_liters: num(h.water_liters),
      mood: c ? num(c.mood) : null, energy: c ? num(c.energy) : null, stress: c ? num(c.stress) : null,
      feelings: c && c.feelings ? c.feelings : null,
      location_name: w.location_name, latitude: w.latitude, longitude: w.longitude,
    };
    for (const [k, e] of Object.entries(expect)) {
      const a = k === 'feelings' ? (l.feelings ? l.feelings.join(';') : null) : l[k];
      if (a !== e) problems.push(`${d} ${k}: expected ${e}, got ${a}`);
    }
  }
  for (const c of s.conditions) {
    const w = conditions[c.date];
    for (const k of Object.keys(w)) if (k !== 'location_source' && c[k] !== w[k]) problems.push(`${c.date} ${k}: expected ${w[k]}, got ${c[k]}`);
  }
  if (s.conditions.length !== s.logs.length) problems.push(`conditions rows ${s.conditions.length} != log rows ${s.logs.length}`);
  return problems;
}

function rainGap(s) {
  const rain = new Map(s.conditions.map((c) => [c.date, c.rain_mm]));
  const withMood = s.logs.filter((l) => l.mood !== null);
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const wet = withMood.filter((l) => rain.get(l.log_date) > 2).map((l) => l.mood);
  const dry = withMood.filter((l) => rain.get(l.log_date) <= 2).map((l) => l.mood);
  return { wet: avg(wet), dry: avg(dry), nWet: wet.length, nDry: dry.length };
}

const real = compare(seed);
const tampered = structuredClone(seed);
const probe = tampered.logs.find((l) => l.mood !== null);
probe.mood = probe.mood === 5 ? 4 : probe.mood + 1;
tampered.conditions[3].rain_mm += 1;
const control = compare(tampered);
const caught = control.some((p) => p.startsWith(`${probe.log_date} mood`)) && control.some((p) => p.startsWith(`${tampered.conditions[3].date} rain_mm`));
console.log(`Positive control (one mood and one rain value altered): ${caught ? 'CAUGHT' : 'NOT CAUGHT'}`);

const gap = rainGap(seed);
const planted = gap.dry - gap.wet >= 0.75;
console.log(`Planted pattern: mood ${gap.wet.toFixed(2)} on ${gap.nWet} rainy days vs ${gap.dry.toFixed(2)} on ${gap.nDry} dry days (${planted ? 'present' : 'MISSING'}).`);

if (real.length === 0) {
  console.log(`PASS: seed matches sources for ${seed.logs.length} days and ${seed.conditions.length} condition rows.`);
} else {
  console.log(`FAIL: ${real.length} mismatch(es)`); real.slice(0, 20).forEach((p) => console.log('  ' + p));
}
process.exit(real.length === 0 && caught && planted ? 0 : 1);
