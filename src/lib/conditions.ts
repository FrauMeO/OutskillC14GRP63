// Outside conditions for one place and one local date, cached in daily_conditions.
//
// Sources (Open-Meteo, free tier, non-commercial use only, no key):
//  - Weather: Historical Forecast API. One source for every date, including today, and it has
//    the UV index, which the ERA5 archive does not. Today's values are a forecast (is_final false)
//    and are replaced once after the day ends.
//  - Air quality: Air Quality API. US AQI (daily max), PM2.5 (daily mean, the smoke signal),
//    pollen (daily max across all types; Europe only, null elsewhere).
//  - Humidity and pressure are hourly only, so the daily value is the mean of that date's hours.
//  - Moon: calculated from the date, no API.
import { supabase } from './supabase';
import type { Database, DailyConditions } from './database.types';

type ConditionsInsert = Database['public']['Tables']['daily_conditions']['Insert'];

export type ConditionValues = Omit<ConditionsInsert, 'id' | 'user_id' | 'fetched_at'>;

// ---------- Moon ----------
const SYNODIC_MONTH = 29.530588853; // days
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 18:14 UTC

const PHASES = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

// Moon at local noon of the given YYYY-MM-DD. Illumination 0 = new, 1 = full.
export function moonFor(isoDate: string): { illumination: number; phase: string; ageDays: number } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12);
  const days = (noonUtc - KNOWN_NEW_MOON_MS) / 86_400_000;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2;
  const phase = PHASES[Math.round((age / SYNODIC_MONTH) * 8) % 8];
  return { illumination: Math.round(illumination * 1000) / 1000, phase, ageDays: age };
}

// ---------- Hourly to daily ----------
function present(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

export function meanOrNull(values: (number | null | undefined)[]): number | null {
  const v = present(values);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function maxOrNull(values: (number | null | undefined)[]): number | null {
  const v = present(values);
  return v.length ? Math.max(...v) : null;
}

function round(n: number | null, places: number): number | null {
  if (n === null) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

// ---------- API responses to one row ----------
type WeatherResponse = {
  daily?: Record<string, (number | null)[]>;
  hourly?: Record<string, (number | null)[]>;
};

type AirResponse = { hourly?: Record<string, (number | null)[]> };

const POLLEN_KEYS = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];

export function toConditionValues(
  place: { name: string | null; latitude: number; longitude: number },
  isoDate: string,
  weather: WeatherResponse,
  air: AirResponse | null,
  isFinal: boolean,
): ConditionValues {
  const day = (key: string) => weather.daily?.[key]?.[0] ?? null;
  const hours = (src: { hourly?: Record<string, (number | null)[]> } | null, key: string) => src?.hourly?.[key] ?? [];
  const seconds = (key: string) => {
    const s = day(key);
    return s === null ? null : round(s / 3600, 2);
  };
  const pollen = maxOrNull(POLLEN_KEYS.flatMap((k) => hours(air, k)));
  const moon = moonFor(isoDate);

  return {
    date: isoDate,
    location_name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    precipitation_mm: day('precipitation_sum'),
    rain_mm: day('rain_sum'),
    snowfall_cm: day('snowfall_sum'),
    humidity_mean_pct: round(meanOrNull(hours(weather, 'relative_humidity_2m')), 1),
    pressure_mean_hpa: round(meanOrNull(hours(weather, 'surface_pressure')), 1),
    temp_min_c: day('temperature_2m_min'),
    temp_max_c: day('temperature_2m_max'),
    apparent_temp_max_c: day('apparent_temperature_max'),
    uv_index_max: day('uv_index_max'),
    daylight_hours: seconds('daylight_duration'),
    sunshine_hours: seconds('sunshine_duration'),
    us_aqi_max: maxOrNull(hours(air, 'us_aqi')),
    pm2_5_mean: round(meanOrNull(hours(air, 'pm2_5')), 1),
    pollen_max: pollen === null ? null : round(pollen, 1),
    moon_illumination: moon.illumination,
    moon_phase: moon.phase,
    is_final: isFinal,
  };
}

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'uv_index_max',
  'daylight_duration',
  'sunshine_duration',
].join(',');

export async function fetchConditionValues(
  place: { name: string | null; latitude: number; longitude: number },
  isoDate: string,
  isFinal: boolean,
): Promise<ConditionValues> {
  const where = `latitude=${place.latitude}&longitude=${place.longitude}&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`;
  const weatherUrl = `https://historical-forecast-api.open-meteo.com/v1/forecast?${where}&daily=${DAILY}&hourly=relative_humidity_2m,surface_pressure`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${where}&hourly=us_aqi,pm2_5,${POLLEN_KEYS.join(',')}`;

  const [weatherRes, airRes] = await Promise.all([
    fetch(weatherUrl, { signal: AbortSignal.timeout(10_000) }),
    fetch(airUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => null),
  ]);
  if (!weatherRes.ok) throw new Error(`Weather request failed (${weatherRes.status}).`);
  const weather = (await weatherRes.json()) as WeatherResponse;
  const air = airRes && airRes.ok ? ((await airRes.json()) as AirResponse) : null;
  return toConditionValues(place, isoDate, weather, air, isFinal);
}

// ---------- Cache rules ----------
// Fetch when: there is no row; or the row was for a different place; or the row is a forecast
// (not final) and its date has now passed. Otherwise keep what is stored. Never on page load.
export function needsFetch(
  existing: Pick<DailyConditions, 'latitude' | 'longitude' | 'is_final'> | null,
  place: { latitude: number; longitude: number },
  isoDate: string,
  todayIso: string,
): boolean {
  if (!existing) return true;
  if (Number(existing.latitude) !== place.latitude || Number(existing.longitude) !== place.longitude) return true;
  return !existing.is_final && isoDate < todayIso;
}

export type EnsureResult = 'fetched' | 'cached' | 'failed';

export async function ensureConditions(
  place: { name: string | null; latitude: number; longitude: number },
  isoDate: string,
  todayIso: string,
): Promise<EnsureResult> {
  if (isoDate > todayIso) return 'cached'; // no conditions for future dates
  const { data: existing } = await supabase
    .from('daily_conditions')
    .select('latitude, longitude, is_final')
    .eq('date', isoDate)
    .maybeSingle();
  if (!needsFetch(existing, place, isoDate, todayIso)) return 'cached';

  try {
    const values = await fetchConditionValues(place, isoDate, isoDate < todayIso);
    const { error } = await supabase
      .from('daily_conditions')
      .upsert({ ...values, fetched_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
    return error ? 'failed' : 'fetched';
  } catch {
    return 'failed';
  }
}
