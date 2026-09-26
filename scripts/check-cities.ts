// City check (Miah, 2026-09-26): does weather and location work for people anywhere, not just the
// team's cities? Runs the app's own code (no copies) for 16 cities chosen to cover both
// hemispheres, the date line, deserts, the tropics, high altitude, Europe (pollen) and places
// with poor air. Nothing is written to Supabase and no accounts are created.
//
//   npx vite-node scripts/check-cities.ts
//   -> sample-data/cities/<date>/conditions.json, check-ins.json, report.md
import { mkdirSync, writeFileSync } from 'node:fs';
import { searchCities } from '../src/lib/location';
import { fetchConditionRange } from '../src/lib/conditionsCore';
import { weatherParts } from '../src/lib/todayWeather';
import { runInsights, type InsightDay } from '../src/lib/insights/engine';
import { addDays } from '../src/lib/dashboard';

type City = { query: string; country: string; tz: string; why: string; europe: boolean };

const CITIES: City[] = [
  { query: 'Philadelphia', country: 'US', tz: 'America/New_York', why: 'Demo account home', europe: false },
  { query: 'Atlanta', country: 'US', tz: 'America/New_York', why: 'Team member', europe: false },
  { query: 'Toronto', country: 'CA', tz: 'America/Toronto', why: 'Canada, crisis line country', europe: false },
  { query: 'Honolulu', country: 'US', tz: 'Pacific/Honolulu', why: 'UTC-10, far behind', europe: false },
  { query: 'Sao Paulo', country: 'BR', tz: 'America/Sao_Paulo', why: 'Southern hemisphere, accent-free search', europe: false },
  { query: 'London', country: 'GB', tz: 'Europe/London', why: 'Europe, pollen', europe: true },
  { query: 'Berlin', country: 'DE', tz: 'Europe/Berlin', why: 'Team member, pollen', europe: true },
  { query: 'Reykjavik', country: 'IS', tz: 'Atlantic/Reykjavik', why: 'Far north, fast-changing daylight', europe: true },
  { query: 'Nairobi', country: 'KE', tz: 'Africa/Nairobi', why: 'Equator, 1,700 m altitude', europe: false },
  { query: 'Sohar', country: 'OM', tz: 'Asia/Muscat', why: 'Team member, desert heat', europe: false },
  { query: 'Dubai', country: 'AE', tz: 'Asia/Dubai', why: 'UAE, crisis line country', europe: false },
  { query: 'Delhi', country: 'IN', tz: 'Asia/Kolkata', why: 'Poor air, India crisis line', europe: false },
  { query: 'Mumbai', country: 'IN', tz: 'Asia/Kolkata', why: 'Monsoon rain', europe: false },
  { query: 'Tokyo', country: 'JP', tz: 'Asia/Tokyo', why: 'UTC+9, ahead of the team', europe: false },
  { query: 'Sydney', country: 'AU', tz: 'Australia/Sydney', why: 'Southern hemisphere spring', europe: false },
  { query: 'Auckland', country: 'NZ', tz: 'Pacific/Auckland', why: 'Across the date line', europe: false },
];

const DAYS = 28;

// Local calendar date in a time zone, as the person's own device would see it.
const localToday = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

// Small seeded random numbers, so the made-up check-ins are the same on every run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const hash = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

type Row = Record<string, unknown> & { date: string };

function problems(rows: Row[], today: string, europe: boolean): string[] {
  const out: string[] = [];
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const between = (label: string, v: number | null, lo: number, hi: number, d: string) => {
    if (v !== null && !(v >= lo && v <= hi)) out.push(`${d}: ${label} ${v} outside ${lo} to ${hi}`);
  };
  for (const r of rows) {
    const d = r.date;
    const lo = num(r.temp_min_c), hi = num(r.temp_max_c);
    if (lo === null || hi === null) out.push(`${d}: temperature missing`);
    else if (lo > hi) out.push(`${d}: low ${lo} above high ${hi}`);
    between('temperature', hi, -60, 60, d);
    if (num(r.precipitation_mm) === null) out.push(`${d}: precipitation missing`);
    between('humidity', num(r.humidity_mean_pct), 0, 100, d);
    between('pressure', num(r.pressure_mean_hpa), 600, 1100, d);
    between('daylight', num(r.daylight_hours), 0, 24, d);
    const sun = num(r.sunshine_hours), day = num(r.daylight_hours);
    if (sun !== null && day !== null && sun > day + 0.1) out.push(`${d}: sunshine ${sun} h exceeds daylight ${day} h`);
    between('UV', num(r.uv_index_max), 0, 20, d);
    between('AQI', num(r.us_aqi_max), 0, 500, d);
    between('moon', num(r.moon_illumination), 0, 1, d);
    if (!europe && num(r.pollen_max) !== null) out.push(`${d}: pollen outside Europe`);
    if (r.is_final !== d < today) out.push(`${d}: is_final should be ${d < today}`);
  }
  const dates = rows.map((r) => r.date);
  if (dates.length !== DAYS) out.push(`expected ${DAYS} days, got ${dates.length}`);
  if (dates[dates.length - 1] !== today) out.push(`last day ${dates[dates.length - 1]} is not local today ${today}`);
  return out;
}

const stamp = localToday('America/New_York');
const dir = new URL(`../sample-data/cities/${stamp}/`, import.meta.url);
mkdirSync(dir, { recursive: true });

const conditions: Record<string, unknown> = {};
const checkins: Record<string, unknown> = {};
const lines: string[] = [];
let failures = 0;

for (const c of CITIES) {
  const issues: string[] = [];
  let summary = '';
  try {
    // 1. City search, as at sign-up and in Settings.
    const matches = await searchCities(c.query);
    const pick = matches.find((m) => m.countryCode === c.country);
    if (!pick) throw new Error(`city search found no ${c.country} match (got ${matches.map((m) => m.label).join(' | ') || 'nothing'})`);

    // 2. Four weeks of weather, ending on the city's own today.
    const today = localToday(c.tz);
    const place = { name: pick.city, latitude: pick.latitude, longitude: pick.longitude };
    const rows = (await fetchConditionRange(place, addDays(today, -(DAYS - 1)), today, today)) as unknown as Row[];
    issues.push(...problems(rows, today, c.europe));

    // 3. The Dashboard's weather line for today.
    const todayRow = rows.find((r) => r.date === today);
    const parts = weatherParts(todayRow ?? null);
    const line = parts.join(', ');
    if (!parts.length) issues.push('Dashboard weather line is empty');
    if (/NaN|undefined|null/.test(line)) issues.push(`Dashboard weather line looks broken: ${line}`);

    // 4. Insights on made-up check-ins paired with this city's real weather. One pattern is planted
    //    on purpose (rain over 2 mm lowers mood a little); any other "likely" pattern is a false alarm.
    const rand = rng(hash(c.query));
    const days: InsightDay[] = rows.map((r) => {
      const rainy = Number(r.rain_mm ?? 0) > 2;
      return {
        date: r.date,
        measures: {
          mood: Math.max(1, Math.min(5, Math.round(3.4 + (rand() - 0.5) * 2.4 - (rainy ? 0.6 : 0)))),
          energy: Math.max(1, Math.min(5, Math.round(3 + (rand() - 0.5) * 2.4))),
          stress: Math.max(1, Math.min(5, Math.round(2.8 + (rand() - 0.5) * 2.4))),
          sleep_hours: Math.round((6.2 + rand() * 2.2) * 10) / 10,
          exercise_minutes: Math.round(rand() * 60),
          water_liters: Math.round((1.2 + rand() * 1.8) * 10) / 10,
        },
        conditions: r as unknown as Record<string, number | null>,
      };
    });
    const insights = runInsights(days);
    const sentences = [...insights.likely, ...insights.explore].map((x) => x.sentence);
    if (!insights.ready) issues.push('Insights not ready with 28 days');
    if (sentences.some((s) => /NaN|undefined|Infinity/.test(s))) issues.push('an Insights sentence looks broken');

    conditions[c.query] = { place: pick, local_today: today, rows };
    checkins[c.query] = days.map((d) => ({ date: d.date, ...d.measures }));
    const pollenDays = rows.filter((r) => r.pollen_max !== null && r.pollen_max !== undefined).length;
    const aqi = rows.map((r) => Number(r.us_aqi_max)).filter(Number.isFinite);
    summary = [
      `found as "${pick.label}" (${pick.latitude}, ${pick.longitude})`,
      `local today ${today}`,
      `today: ${line || 'nothing'}`,
      `${rows.length} days, air quality ${aqi.length ? `${Math.min(...aqi)} to ${Math.max(...aqi)}` : 'not available'}, pollen on ${pollenDays} days`,
      `Insights: ${insights.tested} comparisons, ${insights.likely.length} likely, ${insights.explore.length} early hints` +
        (insights.likely.length ? ` (likely: ${insights.likely.map((x) => `${x.factor.key} and ${x.measure.key}`).join('; ')})` : ''),
    ].join('\n    ');
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  if (issues.length) failures++;
  const status = issues.length ? 'PROBLEM' : 'OK';
  console.log(`${status.padEnd(7)} ${c.query} (${c.why})${summary ? `\n    ${summary}` : ''}`);
  for (const i of issues.slice(0, 8)) console.log(`    ! ${i}`);
  lines.push(`## ${c.query}: ${status}\n\n${c.why}.\n\n${summary ? summary.split('\n    ').map((s) => `- ${s}`).join('\n') : ''}${issues.length ? `\n\nProblems:\n${issues.map((i) => `- ${i}`).join('\n')}` : ''}\n`);
}

writeFileSync(new URL('conditions.json', dir), JSON.stringify(conditions, null, 2) + '\n');
writeFileSync(new URL('check-ins.json', dir), JSON.stringify(checkins, null, 2) + '\n');
writeFileSync(
  new URL('report.md', dir),
  `# City check, ${stamp}\n\n${CITIES.length - failures} of ${CITIES.length} cities OK. Check-ins are made up; the weather is real (Open-Meteo).\n\n${lines.join('\n')}`,
);
console.log(`\n${CITIES.length - failures} of ${CITIES.length} cities OK. Saved to sample-data/cities/${stamp}/`);
process.exit(failures ? 1 : 0);
