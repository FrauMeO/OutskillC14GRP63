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
//  - Fifteen more factors (DERIVED, Miah 2026-09-26) are worked out from stored weather, some from
//    the day before or a week before (skipped when that day was not logged), and are compared with
//    mood and energy only.
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

export type FactorGroup = 'Day to day' | 'Rain and humidity' | 'Temperature' | 'Sun and daylight' | 'Air' | 'Pressure' | 'Moon';

type Conditions = Record<string, number | null>;
// A factor worked out from stored weather: today's conditions, and conditions `days` earlier
// (null when that day was not logged, so the factor is skipped for that day).
type Derive = (today: Conditions, earlier: (days: number) => Conditions | null) => number | null;

// more: 'Days with ___'; most/least: 'the third of days with ___'.
// measures: when set, the factor is compared with these measures only (fewer comparisons, so
// the correction for testing many things at once stays gentler).
type ContinuousFactor = {
  kind: 'continuous';
  key: string;
  group: FactorGroup;
  more: string;
  most: string;
  least: string;
  derive?: Derive;
  measures?: MeasureKey[];
};
type BinaryFactor = {
  kind: 'binary';
  key: string;
  group: FactorGroup;
  yes: string;
  no: string;
  measures?: MeasureKey[];
} & ({ source: string; test: (v: number) => boolean } | { derive: Derive });
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
  ...DERIVED(),
];

// Miah, 2026-09-26: fifteen more ways weather can go along with how people feel, all worked out
// from the conditions already stored, and compared with mood and energy only.
function DERIVED(): Factor[] {
  const only: MeasureKey[] = ['mood', 'energy'];
  const v = (c: Conditions | null, k: string): number | null => {
    const x = c?.[k];
    return x === null || x === undefined || !Number.isFinite(Number(x)) ? null : Number(x);
  };
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  const flag = (x: boolean | null) => (x === null ? null : x ? 1 : 0);
  const rainy = (c: Conditions | null) => {
    const r = v(c, 'rain_mm');
    return r === null ? null : r > 2;
  };
  return [
    // Day to day
    { kind: 'continuous', key: 'temp_change', group: 'Day to day', measures: only,
      more: 'a bigger warm-up from the day before', most: 'the biggest warm-ups from the day before', least: 'the biggest cool-downs from the day before',
      derive: (c, e) => diff(v(c, 'temp_max_c'), v(e(1), 'temp_max_c')) },
    { kind: 'binary', key: 'cool_snap', group: 'Day to day', measures: only,
      yes: 'sudden cool-downs (5°C or more below the day before)', no: 'other days',
      derive: (c, e) => { const d = diff(v(c, 'temp_max_c'), v(e(1), 'temp_max_c')); return d === null ? null : flag(d <= -5); } },
    { kind: 'binary', key: 'heat_jump', group: 'Day to day', measures: only,
      yes: 'sudden warm-ups (5°C or more above the day before)', no: 'other days',
      derive: (c, e) => { const d = diff(v(c, 'temp_max_c'), v(e(1), 'temp_max_c')); return d === null ? null : flag(d >= 5); } },
    { kind: 'continuous', key: 'pressure_change', group: 'Day to day', measures: only,
      more: 'rising air pressure', most: 'the biggest rises in air pressure', least: 'the biggest drops in air pressure',
      derive: (c, e) => diff(v(c, 'pressure_mean_hpa'), v(e(1), 'pressure_mean_hpa')) },
    { kind: 'binary', key: 'pressure_drop', group: 'Day to day', measures: only,
      yes: 'days when air pressure dropped 5 hPa or more', no: 'other days',
      derive: (c, e) => { const d = diff(v(c, 'pressure_mean_hpa'), v(e(1), 'pressure_mean_hpa')); return d === null ? null : flag(d <= -5); } },
    { kind: 'binary', key: 'after_rain', group: 'Day to day', measures: only,
      yes: 'days after a rainy day', no: 'days after a dry day',
      derive: (_c, e) => flag(rainy(e(1))) },
    { kind: 'binary', key: 'rain_run', group: 'Day to day', measures: only,
      yes: 'the third rainy day in a row, or later', no: 'other days',
      derive: (c, e) => {
        const run = [rainy(c), rainy(e(1)), rainy(e(2))];
        return run.some((x) => x === null) ? null : flag(run.every(Boolean));
      } },
    { kind: 'continuous', key: 'daylight_trend', group: 'Day to day', measures: only,
      more: 'days getting longer over the week', most: 'the fastest-lengthening days', least: 'the fastest-shortening days',
      derive: (c, e) => diff(v(c, 'daylight_hours'), v(e(7), 'daylight_hours')) },
    // Temperature
    { kind: 'continuous', key: 'temp_swing', group: 'Temperature', measures: only,
      more: 'a bigger day-to-night temperature swing', most: 'the biggest temperature swings', least: 'the smallest temperature swings',
      derive: (c) => diff(v(c, 'temp_max_c'), v(c, 'temp_min_c')) },
    { kind: 'binary', key: 'hot_day', group: 'Temperature', measures: only,
      yes: 'hot days (30°C or more)', no: 'cooler days',
      derive: (c) => { const t = v(c, 'temp_max_c'); return t === null ? null : flag(t >= 30); } },
    { kind: 'binary', key: 'cold_day', group: 'Temperature', measures: only,
      yes: 'cold days (5°C or less)', no: 'milder days',
      derive: (c) => { const t = v(c, 'temp_max_c'); return t === null ? null : flag(t <= 5); } },
    { kind: 'binary', key: 'feels_hotter', group: 'Temperature', measures: only,
      yes: 'days that felt hotter than the thermometer (3°C or more)', no: 'other days',
      derive: (c) => { const d = diff(v(c, 'apparent_temp_max_c'), v(c, 'temp_max_c')); return d === null ? null : flag(d >= 3); } },
    // Sun and daylight
    { kind: 'binary', key: 'grey_day', group: 'Sun and daylight', measures: only,
      yes: 'grey days (under 2 hours of sunshine)', no: 'sunnier days',
      derive: (c) => { const h = v(c, 'sunshine_hours'); return h === null ? null : flag(h < 2); } },
    { kind: 'continuous', key: 'sun_share', group: 'Sun and daylight', measures: only,
      more: 'more of the daylight in sunshine', most: 'the sunniest share of daylight', least: 'the greyest share of daylight',
      derive: (c) => { const s = v(c, 'sunshine_hours'), d = v(c, 'daylight_hours'); return s === null || !d ? null : Math.min(1, s / d); } },
    // Rain and humidity
    { kind: 'binary', key: 'muggy', group: 'Rain and humidity', measures: only,
      yes: 'muggy days (70% humidity or more and 25°C or warmer)', no: 'other days',
      derive: (c) => {
        const h = v(c, 'humidity_mean_pct'), t = v(c, 'temp_max_c');
        return h === null || t === null ? null : flag(h >= 70 && t >= 25);
      } },
  ];
}

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

// Calendar arithmetic on YYYY-MM-DD (noon avoids daylight-saving edges).
function dayBefore(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() - days);
  return t.toISOString().slice(0, 10);
}

type Lookup = (date: string) => Conditions | null;

function factorValue(factor: Factor, day: InsightDay, lookup: Lookup): number | null {
  const c = day.conditions;
  if (!c) return null;
  if ('derive' in factor && factor.derive) {
    const x = factor.derive(c, (n) => lookup(dayBefore(day.date, n)));
    return x === null || !Number.isFinite(x) ? null : x;
  }
  const raw = c[factor.kind === 'binary' && 'source' in factor ? factor.source : factor.key];
  if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return null;
  const v = Number(raw);
  return factor.kind === 'binary' && 'test' in factor ? (factor.test(v) ? 1 : 0) : v;
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

  const byDate = new Map(days.map((d) => [d.date, d.conditions]));
  const lookup: Lookup = (date) => byDate.get(date) ?? null;
  const raw: Omit<Comparison, 'sentence' | 'tier' | 'pAdjusted'>[] = [];
  for (const factor of FACTORS) {
    for (const measure of MEASURES.filter((m) => !factor.measures || factor.measures.includes(m.key))) {
      const pairs: [number, number][] = [];
      for (const day of days) {
        const f = factorValue(factor, day, lookup);
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
        const n1 = days.filter((d) => factorValue(r.factor, d, lookup) === 1 && d.measures[r.measure.key] != null).length;
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
