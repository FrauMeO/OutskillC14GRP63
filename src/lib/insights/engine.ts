// Compares each outside factor with each personal measure and sorts the results into
// "Likely patterns" and "Worth exploring". Pure: the page fetches rows and passes them in.
//
// Rules (docs/prompts/prompt-03-checkin-weather-insights.md, stage 3B):
//  - Continuous factors: Spearman rank correlation. Yes/no factors: Mann-Whitney U.
//  - Only days where both values exist are paired. Factors that never vary are skipped.
//  - Benjamini-Hochberg across every comparison that was run.
//  - Likely: adjusted p <= 0.10, at least 21 paired days, |effect| >= 0.3
//    (|rho|, or |rank-biserial| for yes/no factors, with at least 5 days in each group).
//  - Worth exploring: p < 0.05 before correction, |effect| >= 0.3, not Likely.
//  - Words describe association, never cause, and always give the number of days.
import { benjaminiHochberg, mannWhitney, spearman } from './stats';

export const MIN_LOGGED_DAYS = 14;
export const MIN_PAIRED_LIKELY = 21;
export const FDR = 0.1;
export const MIN_EFFECT = 0.3;
const MIN_GROUP = 5;
const MIN_PAIRED_TESTED = 10;

export type MeasureKey = 'exercise_minutes' | 'sleep_hours' | 'water_liters' | 'mood' | 'energy' | 'stress';

export type InsightDay = {
  date: string;
  measures: Partial<Record<MeasureKey, number | null>>;
  conditions: Record<string, number | null> | null;
};

// label: noun in sentences; unit: printed after averages; up/down: words for higher and lower.
type Measure = { key: MeasureKey; label: string; decimals: number; unit: string; up: string; down: string };

export const MEASURES: Measure[] = [
  { key: 'mood', label: 'mood', decimals: 1, unit: '', up: 'higher mood', down: 'lower mood' },
  { key: 'energy', label: 'energy', decimals: 1, unit: '', up: 'higher energy', down: 'lower energy' },
  { key: 'stress', label: 'stress', decimals: 1, unit: '', up: 'higher stress', down: 'lower stress' },
  { key: 'sleep_hours', label: 'sleep', decimals: 1, unit: ' hours', up: 'more sleep', down: 'less sleep' },
  { key: 'exercise_minutes', label: 'exercise', decimals: 0, unit: ' minutes', up: 'more exercise', down: 'less exercise' },
  { key: 'water_liters', label: 'water', decimals: 1, unit: ' liters', up: 'more water', down: 'less water' },
];

export type FactorGroup = 'Rain and humidity' | 'Temperature' | 'Sun and daylight' | 'Air' | 'Pressure' | 'Moon';

// more: 'Days with ___'; most/least: 'the third of days with ___'.
type ContinuousFactor = { kind: 'continuous'; key: string; group: FactorGroup; more: string; most: string; least: string };
type BinaryFactor = {
  kind: 'binary';
  key: string;
  group: FactorGroup;
  source: string;
  test: (v: number) => boolean;
  yes: string;
  no: string;
};
export type Factor = ContinuousFactor | BinaryFactor;

export const FACTORS: Factor[] = [
  { kind: 'binary', key: 'rainy_day', group: 'Rain and humidity', source: 'rain_mm', test: (v) => v > 2, yes: 'rainy days (over 2 mm)', no: 'dry days' },
  { kind: 'continuous', key: 'rain_mm', group: 'Rain and humidity', more: 'more rain', most: 'the most rain', least: 'the least rain' },
  { kind: 'continuous', key: 'precipitation_mm', group: 'Rain and humidity', more: 'more precipitation', most: 'the most precipitation', least: 'the least precipitation' },
  { kind: 'binary', key: 'snow_day', group: 'Rain and humidity', source: 'snowfall_cm', test: (v) => v > 0, yes: 'snowy days', no: 'days without snow' },
  { kind: 'continuous', key: 'snowfall_cm', group: 'Rain and humidity', more: 'more snowfall', most: 'the most snowfall', least: 'the least snowfall' },
  { kind: 'continuous', key: 'humidity_mean_pct', group: 'Rain and humidity', more: 'higher humidity', most: 'the highest humidity', least: 'the lowest humidity' },
  { kind: 'continuous', key: 'temp_min_c', group: 'Temperature', more: 'warmer lows', most: 'the warmest lows', least: 'the coolest lows' },
  { kind: 'continuous', key: 'temp_max_c', group: 'Temperature', more: 'warmer highs', most: 'the warmest highs', least: 'the coolest highs' },
  { kind: 'continuous', key: 'apparent_temp_max_c', group: 'Temperature', more: 'a higher heat index', most: 'the highest heat index', least: 'the lowest heat index' },
  { kind: 'continuous', key: 'uv_index_max', group: 'Sun and daylight', more: 'a higher UV index', most: 'the highest UV index', least: 'the lowest UV index' },
  { kind: 'binary', key: 'high_uv', group: 'Sun and daylight', source: 'uv_index_max', test: (v) => v >= 6, yes: 'high-UV days (6 or more)', no: 'lower-UV days' },
  { kind: 'continuous', key: 'daylight_hours', group: 'Sun and daylight', more: 'more daylight', most: 'the most daylight', least: 'the least daylight' },
  { kind: 'continuous', key: 'sunshine_hours', group: 'Sun and daylight', more: 'more sunshine', most: 'the most sunshine', least: 'the least sunshine' },
  { kind: 'continuous', key: 'us_aqi_max', group: 'Air', more: 'a higher air quality index (worse air)', most: 'the worst air', least: 'the cleanest air' },
  { kind: 'binary', key: 'poor_air', group: 'Air', source: 'us_aqi_max', test: (v) => v > 100, yes: 'poor-air days (AQI over 100)', no: 'cleaner-air days' },
  { kind: 'continuous', key: 'pm2_5_mean', group: 'Air', more: 'more fine particles (PM2.5, smoke)', most: 'the most fine particles', least: 'the fewest fine particles' },
  { kind: 'continuous', key: 'pollen_max', group: 'Air', more: 'more pollen', most: 'the most pollen', least: 'the least pollen' },
  { kind: 'continuous', key: 'pressure_mean_hpa', group: 'Pressure', more: 'higher air pressure', most: 'the highest air pressure', least: 'the lowest air pressure' },
  { kind: 'continuous', key: 'moon_illumination', group: 'Moon', more: 'a fuller moon', most: 'the fullest moon', least: 'the least moonlight' },
];

export type Tier = 'likely' | 'explore' | 'none';

export type Comparison = {
  factor: Factor;
  measure: Measure;
  n: number;
  p: number;
  pAdjusted: number;
  effect: number; // rho, or rank-biserial (yes-group higher is positive)
  tier: Tier;
  sentence: string;
  // For yes/no factors: group averages. For continuous: top vs bottom third averages.
  highAvg: number;
  lowAvg: number;
};

export type InsightsResult = {
  loggedDays: number;
  ready: boolean;
  tested: number;
  likely: Comparison[];
  explore: Comparison[];
  all: Comparison[];
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (n: number, d: number) => n.toFixed(d);

function factorValue(factor: Factor, c: Record<string, number | null> | null): number | null {
  if (!c) return null;
  const raw = c[factor.kind === 'binary' ? factor.source : factor.key];
  if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
  const v = Number(raw);
  return factor.kind === 'binary' ? (factor.test(v) ? 1 : 0) : v;
}

export function describe(c: Omit<Comparison, 'sentence' | 'tier' | 'pAdjusted'>): string {
  const { decimals: d, unit, label } = c.measure;
  if (c.factor.kind === 'binary') {
    return `On ${c.factor.yes} your ${label} averaged ${fmt(c.highAvg, d)}${unit}, compared with ${fmt(c.lowAvg, d)}${unit} on ${c.factor.no} (${c.n} days).`;
  }
  const direction = c.effect >= 0 ? c.measure.up : c.measure.down;
  return `Days with ${c.factor.more} went along with ${direction}: your ${label} averaged ${fmt(c.highAvg, d)}${unit} on the third of days with ${c.factor.most}, compared with ${fmt(c.lowAvg, d)}${unit} on the third with ${c.factor.least} (${c.n} days).`;
}

export function runInsights(days: InsightDay[]): InsightsResult {
  const loggedDays = days.length;
  const ready = loggedDays >= MIN_LOGGED_DAYS;
  if (!ready) return { loggedDays, ready, tested: 0, likely: [], explore: [], all: [] };

  const raw: Omit<Comparison, 'sentence' | 'tier' | 'pAdjusted'>[] = [];
  for (const factor of FACTORS) {
    for (const measure of MEASURES) {
      const pairs: [number, number][] = [];
      for (const day of days) {
        const f = factorValue(factor, day.conditions);
        const m = day.measures[measure.key];
        if (f === null || m === null || m === undefined || !Number.isFinite(Number(m))) continue;
        pairs.push([f, Number(m)]);
      }
      if (pairs.length < MIN_PAIRED_TESTED) continue;

      if (factor.kind === 'binary') {
        const yes = pairs.filter((p) => p[0] === 1).map((p) => p[1]);
        const no = pairs.filter((p) => p[0] === 0).map((p) => p[1]);
        if (yes.length < 3 || no.length < 3) continue;
        const r = mannWhitney(yes, no);
        if (!r) continue;
        raw.push({ factor, measure, n: pairs.length, p: r.p, effect: r.rankBiserial, highAvg: avg(yes), lowAvg: avg(no) });
      } else {
        const r = spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
        if (!r) continue;
        const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
        const third = Math.max(1, Math.floor(sorted.length / 3));
        const low = sorted.slice(0, third).map((p) => p[1]);
        const high = sorted.slice(-third).map((p) => p[1]);
        raw.push({ factor, measure, n: pairs.length, p: r.p, effect: r.rho, highAvg: avg(high), lowAvg: avg(low) });
      }
    }
  }

  const adjusted = benjaminiHochberg(raw.map((r) => r.p));
  const all: Comparison[] = raw.map((r, i) => {
    const groupsOk =
      r.factor.kind !== 'binary' ||
      (() => {
        const n1 = days.filter((d) => factorValue(r.factor, d.conditions) === 1 && d.measures[r.measure.key] != null).length;
        return n1 >= MIN_GROUP && r.n - n1 >= MIN_GROUP;
      })();
    const bigEnough = Math.abs(r.effect) >= MIN_EFFECT;
    const likely = adjusted[i] <= FDR && r.n >= MIN_PAIRED_LIKELY && bigEnough && groupsOk;
    const explore = !likely && r.p < 0.05 && bigEnough;
    return { ...r, pAdjusted: adjusted[i], tier: likely ? 'likely' : explore ? 'explore' : 'none', sentence: describe(r) };
  });

  return {
    loggedDays,
    ready,
    tested: all.length,
    likely: all.filter((c) => c.tier === 'likely').sort((a, b) => a.pAdjusted - b.pAdjusted),
    explore: all.filter((c) => c.tier === 'explore').sort((a, b) => a.p - b.p),
    all,
  };
}
