// Fetches real historical Open-Meteo weather and air quality for the sample dates and saves them
// as a fixture, so tests and the seed never need the network afterwards.
//   node scripts/fetch-sample-conditions.mjs      -> sample-data/conditions.json
// Places match the sample generator: Philadelphia (home), with Seattle on 2026-08-20 to 2026-08-29.
// Uses the same conversion rules as the app (src/lib/conditionsCore.ts; Node 22.6+ strips the types).
import { writeFileSync } from 'node:fs';
import { fetchConditionRange } from '../src/lib/conditionsCore.ts';

const HOME = { name: 'Philadelphia, Pennsylvania', latitude: 40.0, longitude: -75.2, source: 'home' };
const TRIP = { name: 'Seattle, Washington', latitude: 47.6, longitude: -122.3, source: 'device' };
const SPANS = [
  { place: HOME, start: '2026-07-26', end: '2026-08-19' },
  { place: TRIP, start: '2026-08-20', end: '2026-08-29' },
  { place: HOME, start: '2026-08-30', end: '2026-09-23' },
];
const TODAY = '2026-09-25'; // every sample date is in the past, so every row is final

const out = {};
for (const { place, start, end } of SPANS) {
  const rows = await fetchConditionRange(place, start, end, TODAY);
  for (const row of rows) out[row.date] = { location_source: place.source, ...row };
  console.log(`${place.name}: ${rows.length} days (${start} to ${end})`);
}

const dates = Object.keys(out).sort();
const missing = dates.filter((d) => out[d].rain_mm === null || out[d].temp_max_c === null);
if (dates.length !== 60 || missing.length) {
  console.error(`Expected 60 complete days, got ${dates.length}; incomplete: ${missing.join(', ') || 'none'}`);
  process.exit(1);
}
writeFileSync(new URL('../sample-data/conditions.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');

const rainy = dates.filter((d) => out[d].rain_mm > 2);
console.log(`Wrote 60 days. Rain over 2 mm on ${rainy.length} days: ${rainy.join(', ')}`);
