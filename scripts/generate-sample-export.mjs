// Generates a synthetic Apple Health export (export.xml) in Apple's real record format,
// plus expected.json: the true daily totals, computed from the generator's own ground truth.
// Deterministic: same seed, same file. No real person's data.
//
// Realism built in (each one is something the importer must handle):
//  - Philadelphia (-0400) with a 10-day Seattle trip (-0700): dates must follow local time
//  - Sleep that crosses midnight, split into Core/Deep/REM/Awake stages plus an InBed record
//  - Some nights a second source (iPhone) disagrees with the Watch: one source wins, as in Apple Health
//  - Exercise minutes arrive in small chunks from the Watch
//  - Water logged some days and not others (missing = null, not 0)
//  - Steps from two devices for the same hours (Watch and iPhone): count one source, not both
//  - Stand hours, active energy (Watch) and dietary energy (a food app, not every day)
//  - Heart rate, which the importer must ignore
// New fields added in Prompt 4 use a second random sequence (rand2), so every value that existed
// before (exercise, sleep, water, steps) is unchanged.
import { mkdirSync, writeFileSync } from 'node:fs';

const SEED = 20260924;
const DAYS = 60;
const END = { y: 2026, m: 9, d: 23 };            // last local date in the export
const TRIP = { startIdx: 25, endIdx: 34 };        // day indexes spent in Seattle
const OUT = new URL('../sample-data/', import.meta.url);

let s = SEED;
const rand = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let s2 = SEED + 4;
const rand2 = () => { s2 |= 0; s2 = (s2 + 0x6d2b79f5) | 0; let t = Math.imul(s2 ^ (s2 >>> 15), 1 | s2); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int2 = (a, b) => Math.floor(a + rand2() * (b - a + 1));
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));

// Wall-clock arithmetic: store local times as ms in a UTC "frame", attach the offset when printing.
const pad = (n) => String(n).padStart(2, '0');
const wall = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
const fmt = (ms, off) => { const t = new Date(ms); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())} ${off}`; };
const dateOf = (ms) => fmt(ms, '').slice(0, 10);
const MIN = 60_000;

const WATCH = 'sourceName="Demo’s Apple Watch" sourceVersion="11.0" device="&lt;&lt;HKDevice: 0x0&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch7,1, software:11.0&gt;"';
const PHONE = 'sourceName="Demo’s iPhone" sourceVersion="19.0" device="&lt;&lt;HKDevice: 0x0&gt;, name:iPhone, manufacturer:Apple Inc., model:iPhone, hardware:iPhone17,1, software:19.0&gt;"';
const WATERAPP = 'sourceName="WaterMinder" sourceVersion="5.2"';
const FOODAPP = 'sourceName="MyFitnessPal" sourceVersion="24.1"';

const records = [];
const rec = (type, src, unit, start, end, value, off, tz) => {
  const u = unit ? ` unit="${unit}"` : '';
  const line = `<Record type="${type}" ${src}${u} creationDate="${fmt(end, off)}" startDate="${fmt(start, off)}" endDate="${fmt(end, off)}" value="${value}"`;
  records.push(tz ? `${line}>\n  <MetadataEntry key="HKTimeZone" value="${tz}"/>\n </Record>` : `${line}/>`);
};

const FIELDS = ['exercise_minutes', 'sleep_hours', 'water_liters', 'steps', 'stand_hours', 'active_calories', 'time_in_bed_hours', 'awake_minutes', 'calories_consumed'];
const expected = {}; // date -> one value per field, null when not logged
const touch = (d) => (expected[d] ??= Object.fromEntries(FIELDS.map((f) => [f, null])));

for (let i = 0; i < DAYS; i++) {
  const inSeattle = i >= TRIP.startIdx && i <= TRIP.endIdx;
  const off = inSeattle ? '-0700' : '-0400';
  const tz = inSeattle ? 'America/Los_Angeles' : 'America/New_York';
  const base = wall(END.y, END.m, END.d) - (DAYS - 1 - i) * 1440 * MIN;
  const day = dateOf(base);
  const weekend = [0, 6].includes(new Date(base).getUTCDay());

  // ---- Sleep that ENDS this morning (attributed to the wake-up date) ----
  if (rand() < 0.9) {
    let t = base - 1440 * MIN + (22 * 60 + int(10, 150)) * MIN; // bedtime 22:10 to 00:30
    const inBedStart = t;
    let asleep = 0, awake = 0;
    const target = between(weekend ? 6.5 : 5.5, weekend ? 9 : 8) * 60;
    const stages = ['Core', 'Deep', 'Core', 'REM', 'Awake'];
    let k = 0;
    while (asleep < target) {
      const st = stages[k++ % stages.length];
      const len = st === 'Awake' ? int(2, 12) : Math.min(int(15, 60), Math.ceil(target - asleep));
      rec('HKCategoryTypeIdentifierSleepAnalysis', WATCH, '', t, t + len * MIN, `HKCategoryValueSleepAnalysisAsleep${st === 'Awake' ? '' : st}`.replace('AsleepAwake', 'Awake').replace(/Asleep$/, 'Awake'), off);
      if (st !== 'Awake') asleep += len; else awake += len;
      t += len * MIN;
    }
    rec('HKCategoryTypeIdentifierSleepAnalysis', PHONE, '', inBedStart - 10 * MIN, t + 8 * MIN, 'HKCategoryValueSleepAnalysisInBed', off);
    // A second source (iPhone) on some nights that disagrees with the Watch about awake minutes.
    // Apple Health uses one source per night (Watch by default), so this must not change the total.
    if (i % 9 === 4) rec('HKCategoryTypeIdentifierSleepAnalysis', PHONE, '', inBedStart + 30 * MIN, inBedStart + 150 * MIN, 'HKCategoryValueSleepAnalysisAsleepUnspecified', off);
    touch(day).sleep_hours = Math.round((asleep / 60) * 100) / 100;
    touch(day).awake_minutes = awake;
    touch(day).time_in_bed_hours = Math.round(((t + 8 * MIN - (inBedStart - 10 * MIN)) / 3_600_000) * 100) / 100;
  }

  // ---- Exercise (Apple Exercise Time, in chunks) ----
  let ex = 0;
  if (rand() < (weekend ? 0.55 : 0.75)) {
    let t = base + (int(6, 18) * 60 + int(0, 50)) * MIN;
    let remaining = int(15, 70);
    while (remaining > 0) { const c = Math.min(remaining, int(3, 10)); rec('HKQuantityTypeIdentifierAppleExerciseTime', WATCH, 'min', t, t + c * MIN, c, off, tz); ex += c; remaining -= c; t += c * MIN; }
  }
  if (rand() < 0.5) { const c = int(1, 6); const t = base + 15 * 60 * MIN; rec('HKQuantityTypeIdentifierAppleExerciseTime', WATCH, 'min', t, t + c * MIN, c, off); ex += c; }
  if (ex > 0) touch(day).exercise_minutes = ex;

  // ---- Water (mL; not logged every day) ----
  if (rand() < 0.75) {
    let ml = 0;
    for (let n = int(3, 9); n > 0; n--) { const v = [250, 330, 355, 500][int(0, 3)]; const t = base + int(7 * 60, 21 * 60) * MIN; rec('HKQuantityTypeIdentifierDietaryWater', WATERAPP, 'mL', t, t, v, off); ml += v; }
    touch(day).water_liters = Math.round(ml) / 1000;
  }

  // ---- Steps from both devices (the Watch counts; the iPhone overlaps it) and heart rate ----
  let watchSteps = 0;
  for (let h = 8; h <= 20; h += 4) {
    const t = base + h * 60 * MIN; const n = int(200, 2500);
    const w = n + int(-50, 50);
    rec('HKQuantityTypeIdentifierStepCount', PHONE, 'count', t, t + 55 * MIN, n, off);
    rec('HKQuantityTypeIdentifierStepCount', WATCH, 'count', t, t + 55 * MIN, w, off);
    rec('HKQuantityTypeIdentifierHeartRate', WATCH, 'count/min', t, t, int(58, 110), off);
    watchSteps += w;
  }
  touch(day).steps = watchSteps;

  // ---- Prompt 4 fields (rand2 only) ----
  // Stand hours: one record per waking hour, Stood or Idle.
  let stood = 0;
  for (let h = 7; h <= 21; h++) {
    const t = base + h * 60 * MIN;
    const up = rand2() < (weekend ? 0.55 : 0.7);
    rec('HKCategoryTypeIdentifierAppleStandHour', WATCH, '', t, t + 60 * MIN, up ? 'HKCategoryValueAppleStandHourStood' : 'HKCategoryValueAppleStandHourIdle', off);
    if (up) stood++;
  }
  touch(day).stand_hours = stood;
  // Active energy: hourly chunks from the Watch, more on exercise days.
  let kcal = 0;
  for (let h = 7; h <= 21; h++) {
    const t = base + h * 60 * MIN;
    const v = int2(8, 30) + (ex > 0 && h === 18 ? int2(120, 320) : 0);
    rec('HKQuantityTypeIdentifierActiveEnergyBurned', WATCH, 'kcal', t, t + 60 * MIN, v, off);
    kcal += v;
  }
  touch(day).active_calories = kcal;
  // Food: logged on about 60% of days, three or four entries.
  if (rand2() < 0.6) {
    let food = 0;
    for (let n = int2(3, 4); n > 0; n--) { const v = int2(250, 850); const t = base + int2(7 * 60, 21 * 60) * MIN; rec('HKQuantityTypeIdentifierDietaryEnergyConsumed', FOODAPP, 'kcal', t, t, v, off); food += v; }
    touch(day).calories_consumed = food;
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord|Audiogram|VisionPrescription)*)>
]>
<HealthData locale="en_US">
 <ExportDate value="2026-09-24 08:00:00 -0400"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet" HKCharacteristicTypeIdentifierFitzpatrickSkinType="HKFitzpatrickSkinTypeNotSet" HKCharacteristicTypeIdentifierCardioFitnessMedicationsUse="None"/>
 ${records.join('\n ')}
</HealthData>
`;

mkdirSync(new URL('apple_health_export/', OUT), { recursive: true });
writeFileSync(new URL('apple_health_export/export.xml', OUT), xml);
writeFileSync(new URL('expected.json', OUT), JSON.stringify(expected, null, 2) + '\n');
console.log(`Wrote ${records.length} records across ${DAYS} days; ${Object.keys(expected).length} days have habit data.`);
