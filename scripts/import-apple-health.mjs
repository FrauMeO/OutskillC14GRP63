// Reads an Apple Health export.xml and produces one habit_logs row per local date.
//   node scripts/import-apple-health.mjs [path/to/export.xml]
// Output: sample-data/habit_logs.csv (scripts/build-demo-seed.mjs turns it into the demo seed)
//
// Rules:
//  - Dates follow the local time printed in each record (its own UTC offset), so data logged in
//    Seattle and Philadelphia both land on the day the person experienced.
//  - exercise_minutes = sum of AppleExerciseTime by local start date.
//  - water_liters     = sum of DietaryWater (mL or L) by local start date.
//  - sleep_hours      = time actually asleep (Core, Deep, REM, Unspecified; not InBed, not Awake),
//    credited to the date you wake up. Anything ending after 6 pm counts toward the next date.
//    Like Apple Health, one source wins per night: an Apple Watch if present, otherwise the source
//    with the most sleep. Sources are never added together. Overlaps within that source are merged.
//  - A habit with no records that day is null (not logged), which is different from 0.
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const input = process.argv[2] ?? new URL('../sample-data/apple_health_export/export.xml', import.meta.url).pathname;
const OUT = new URL('../sample-data/', import.meta.url);

const ASLEEP = new Set(['AsleepCore', 'AsleepDeep', 'AsleepREM', 'AsleepUnspecified', 'Asleep']);

function parseTs(ts) {
  // "2026-09-20 07:14:00 -0400" -> { local: '2026-09-20', ms: absolute epoch ms, wallMs }
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!m) throw new Error(`Unrecognized timestamp: ${ts}`);
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  const wallMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const offMs = (sign === '-' ? -1 : 1) * (+oh * 60 + +om) * 60_000;
  return { local: `${y}-${mo}-${d}`, wallMs, ms: wallMs - offMs };
}
const wallDate = (wallMs) => new Date(wallMs).toISOString().slice(0, 10);

const days = new Map(); // date -> { ex, waterMl, sleep: [[startMs, endMs], ...] }
const day = (d) => { if (!days.has(d)) days.set(d, { ex: null, waterMl: null, sleep: [] }); return days.get(d); };
const counts = { records: 0, used: 0, ignoredTypes: new Map() };

const rl = createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity });
for await (const line of rl) {
  const i = line.indexOf('<Record ');
  if (i === -1) continue;
  counts.records++;
  const a = {};
  for (const [, k, v] of line.slice(i).matchAll(/(\w+)="([^"]*)"/g)) a[k] = v;

  switch (a.type) {
    case 'HKQuantityTypeIdentifierAppleExerciseTime': {
      const d = day(parseTs(a.startDate).local);
      d.ex = (d.ex ?? 0) + Number(a.value);
      counts.used++;
      break;
    }
    case 'HKQuantityTypeIdentifierDietaryWater': {
      const d = day(parseTs(a.startDate).local);
      const ml = a.unit === 'L' ? Number(a.value) * 1000 : Number(a.value);
      d.waterMl = (d.waterMl ?? 0) + ml;
      counts.used++;
      break;
    }
    case 'HKCategoryTypeIdentifierSleepAnalysis': {
      const stage = a.value.replace('HKCategoryValueSleepAnalysis', '');
      if (!ASLEEP.has(stage)) break;
      const start = parseTs(a.startDate), end = parseTs(a.endDate);
      const wake = wallDate(end.wallMs + 6 * 3600_000); // 6 pm boundary
      day(wake).sleep.push({ src: a.sourceName, s: start.ms, e: end.ms });
      counts.used++;
      break;
    }
    default:
      counts.ignoredTypes.set(a.type, (counts.ignoredTypes.get(a.type) ?? 0) + 1);
  }
}

function nightMinutes(records) {
  const bySrc = new Map();
  for (const r of records) (bySrc.get(r.src) ?? bySrc.set(r.src, []).get(r.src)).push([r.s, r.e]);
  const totals = [...bySrc].map(([src, iv]) => ({ src, mins: mergedMinutes(iv) }));
  const watch = totals.find((t) => /watch/i.test(t.src));
  return (watch ?? totals.sort((x, y) => y.mins - x.mins)[0]).mins;
}

function mergedMinutes(intervals) {
  const sorted = [...intervals].sort((x, y) => x[0] - y[0]);
  let total = 0, cs = null, ce = null;
  for (const [s, e] of sorted) {
    if (ce === null || s > ce) { if (ce !== null) total += ce - cs; cs = s; ce = e; }
    else ce = Math.max(ce, e);
  }
  if (ce !== null) total += ce - cs;
  return total / 60_000;
}

const rows = [...days.keys()].sort().map((date) => {
  const d = days.get(date);
  return {
    log_date: date,
    exercise_minutes: d.ex,
    sleep_hours: d.sleep.length ? Math.round((nightMinutes(d.sleep) / 60) * 100) / 100 : null,
    water_liters: d.waterMl === null ? null : Math.round(d.waterMl) / 1000,
  };
});

const cell = (v) => (v === null ? '' : v);
writeFileSync(new URL('habit_logs.csv', OUT),
  'log_date,exercise_minutes,sleep_hours,water_liters\n' +
  rows.map((r) => [r.log_date, cell(r.exercise_minutes), cell(r.sleep_hours), cell(r.water_liters)].join(',')).join('\n') + '\n');

console.log(`Read ${counts.records} records, used ${counts.used}, produced ${rows.length} daily rows.`);
console.log('Ignored types:', Object.fromEntries(counts.ignoredTypes));
