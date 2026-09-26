// Checks importer output (habit_logs.csv) against the generator's ground truth (expected.json).
// Includes a positive control: it corrupts one value in a copy and confirms the check catches it.
// A test that cannot fail proves nothing.
import { readFileSync } from 'node:fs';

const dir = new URL('../sample-data/', import.meta.url);
const FIELDS = ['exercise_minutes', 'sleep_hours', 'water_liters', 'steps', 'stand_hours', 'active_calories', 'time_in_bed_hours', 'awake_minutes', 'calories_consumed'];
const expected = JSON.parse(readFileSync(new URL('expected.json', dir), 'utf8'));
const [header, ...lines] = readFileSync(new URL('habit_logs.csv', dir), 'utf8').trim().split('\n');
const cols = header.split(',');
const actual = Object.fromEntries(lines.map((l) => {
  const v = l.split(',');
  const row = {};
  cols.slice(1).forEach((c, i) => (row[c] = v[i + 1] === '' ? null : Number(v[i + 1])));
  return [v[0], row];
}));

function compare(exp, act) {
  const problems = [];
  const dates = new Set([...Object.keys(exp), ...Object.keys(act)]);
  for (const d of [...dates].sort()) {
    if (!exp[d]) { problems.push(`${d}: unexpected row`); continue; }
    if (!act[d]) { problems.push(`${d}: missing row`); continue; }
    for (const k of FIELDS) {
      const e = exp[d][k], a = act[d][k];
      const ok = e === null || a === null ? e === a : Math.abs(e - a) < 1e-9;
      if (!ok) problems.push(`${d} ${k}: expected ${e}, got ${a}`);
    }
  }
  return { problems, days: dates.size };
}

const real = compare(expected, actual);

const tampered = structuredClone(actual);
const failing = new Set(real.problems.map((p) => p.slice(0, 10)));
const probe = Object.keys(tampered).find((d) => tampered[d].sleep_hours !== null && !failing.has(d));
tampered[probe].sleep_hours += 0.25;
// Second control on a Prompt 4 field: double-counting steps (Watch plus iPhone) must be caught.
const stepProbe = Object.keys(tampered).find((d) => tampered[d].steps !== null && !failing.has(d));
tampered[stepProbe].steps *= 2;
const control = compare(expected, tampered);
const caught =
  control.problems.some((p) => p.startsWith(`${probe} sleep_hours`)) &&
  control.problems.some((p) => p.startsWith(`${stepProbe} steps`));

console.log(`Positive control (sleep on ${probe} altered by 15 min; steps on ${stepProbe} doubled): ${caught ? 'CAUGHT' : 'NOT CAUGHT'}`);
if (real.problems.length === 0) {
  const n = (k) => Object.values(actual).filter((r) => r[k] !== null).length;
  console.log(`PASS: ${real.days} days match exactly on ${FIELDS.length} fields. Days with ${FIELDS.map((f) => `${f} ${n(f)}`).join(', ')}.`);
} else {
  console.log(`FAIL: ${real.problems.length} mismatch(es)`); real.problems.slice(0, 20).forEach((p) => console.log('  ' + p));
}
process.exit(real.problems.length === 0 && caught ? 0 : 1);
