// Today's weather in plain words for the Dashboard (Miah, 2026-09-26): so people can see the
// conditions that Insights compares with their days. Pure, so it is unit tested.
import { num } from './dashboard';

type Row = Record<string, unknown>;

// US AQI bands (EPA).
export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'unhealthy for sensitive groups';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'very unhealthy';
  return 'hazardous';
}

// Rough bands for the highest pollen count (grains per cubic metre); Europe only.
export function pollenLabel(grains: number): string {
  if (grains < 10) return 'low';
  if (grains < 50) return 'moderate';
  return 'high';
}

const round = (n: number) => Math.round(n);

// Each part is a short phrase; missing values are left out, never guessed.
export function weatherParts(row: Row | null | undefined): string[] {
  if (!row) return [];
  const parts: string[] = [];
  const lo = num(row, 'temp_min_c');
  const hi = num(row, 'temp_max_c');
  if (lo !== null && hi !== null) parts.push(`${round(lo)}–${round(hi)}°C`);

  const snow = num(row, 'snowfall_cm');
  const rain = num(row, 'rain_mm');
  const precip = num(row, 'precipitation_mm');
  if (snow !== null && snow > 0) parts.push(`snow (${snow.toFixed(1)} cm)`);
  else if (rain !== null && rain > 2) parts.push(`rainy (${round(rain)} mm)`);
  else if (precip !== null && precip > 0) parts.push('a little rain');
  else if (precip !== null) parts.push('dry');

  const daylight = num(row, 'daylight_hours');
  if (daylight !== null) parts.push(`${round(daylight)} hours of daylight`);

  const aqi = num(row, 'us_aqi_max');
  if (aqi !== null) parts.push(`air quality ${round(aqi)} (${aqiLabel(aqi)})`);

  const pollen = num(row, 'pollen_max');
  if (pollen !== null) parts.push(`pollen ${pollenLabel(pollen)}`);

  const moon = row.moon_phase;
  if (typeof moon === 'string' && moon) parts.push(moon.charAt(0).toLowerCase() + moon.slice(1));
  return parts;
}
