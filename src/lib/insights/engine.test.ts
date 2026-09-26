import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FACTORS, FDR, MIN_LOGGED_DAYS, runInsights, type InsightDay, type MeasureKey } from './engine';

// The demo seed rows: 59 sample days with real weather and the planted rain-and-mood pattern.
type SeedRows = {
  logs: (Record<MeasureKey, number | null> & { log_date: string })[];
  conditions: (Record<string, number | null> & { date: string })[];
};
const seed: SeedRows = JSON.parse(readFileSync(new URL('../../../sample-data/seed_rows.json', import.meta.url), 'utf8'));

function sampleDays(): InsightDay[] {
  const byDate = new Map(seed.conditions.map((c) => [c.date, c]));
  return seed.logs.map((l) => ({
    date: l.log_date,
    measures: {
      exercise_minutes: l.exercise_minutes,
      sleep_hours: l.sleep_hours,
      water_liters: l.water_liters,
      mood: l.mood,
      energy: l.energy,
      stress: l.stress,
    },
    conditions: byDate.get(l.log_date) ?? null,
  }));
}

// Seeded shuffle (mulberry32) so the false-positive check gives the same answer every run.
function shuffler(seedValue: number) {
  let s = seedValue;
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return <T,>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
}

describe('readiness', () => {
  it('shows nothing before 14 logged days, and runs from 14 (control)', () => {
    const days = sampleDays();
    expect(runInsights(days.slice(0, MIN_LOGGED_DAYS - 1))).toMatchObject({ ready: false, tested: 0 });
    expect(runInsights(days.slice(0, MIN_LOGGED_DAYS)).ready).toBe(true);
  });
});

describe('sample data', () => {
  const result = runInsights(sampleDays());

  it('finds the planted pattern: rainy days and mood is a Likely pattern', () => {
    const hit = result.likely.find((c) => c.factor.key === 'rainy_day' && c.measure.key === 'mood');
    expect(hit, `likely: ${result.likely.map((c) => `${c.factor.key}/${c.measure.key}`).join(', ')}`).toBeDefined();
    expect(hit!.lowAvg - hit!.highAvg).toBeGreaterThan(0.75);
    expect(hit!.pAdjusted).toBeLessThanOrEqual(FDR);
  });

  it('negative control: the moon is not a Likely pattern for any measure', () => {
    expect(result.likely.filter((c) => c.factor.group === 'Moon')).toEqual([]);
  });

  it('writes association, never cause, and always gives the day count', () => {
    for (const c of result.all) {
      expect(c.sentence).toMatch(/\(\d+ days\)\.$/);
      // Causal verbs only; "higher" and "lower" as comparisons are fine.
      expect(c.sentence).not.toMatch(/\b(causes?|caused|lowers|lowered|raises|raised|makes|made|because|due to|leads? to|results? in)\b/i);
    }
    const hit = result.likely.find((c) => c.factor.key === 'rainy_day' && c.measure.key === 'mood')!;
    expect(hit.sentence).toMatch(/^On rainy days \(over 2 mm\) your mood averaged 2\.\d, compared with 3\.\d on dry days \(\d+ days\)\.$/);
  });
});

describe('false-positive check', () => {
  it('with mood shuffled across days 200 times, a Likely mood pattern appears in at most 10% of runs', () => {
    const days = sampleDays();
    const shuffle = shuffler(20260926);
    let runsWithLikely = 0;
    for (let run = 0; run < 200; run++) {
      const moods = shuffle(days.map((d) => d.measures.mood ?? null));
      const shuffled = days.map((d, i) => ({ ...d, measures: { ...d.measures, mood: moods[i] } }));
      if (runInsights(shuffled).likely.some((c) => c.measure.key === 'mood')) runsWithLikely++;
    }
    console.log(`Shuffled mood: ${runsWithLikely} of 200 runs produced a Likely mood pattern.`);
    expect(runsWithLikely / 200).toBeLessThanOrEqual(0.1);
  });

  it('control: without shuffling, the mood pattern is found (so the check can tell the difference)', () => {
    expect(runInsights(sampleDays()).likely.some((c) => c.measure.key === 'mood')).toBe(true);
  });
});

describe('fifteen more weather factors, for mood and energy', () => {
  const DERIVED_KEYS = [
    'temp_change', 'cool_snap', 'heat_jump', 'pressure_change', 'pressure_drop', 'after_rain', 'rain_run', 'daylight_trend',
    'temp_swing', 'hot_day', 'cold_day', 'feels_hotter', 'grey_day', 'sun_share', 'muggy',
  ];
  const iso = (i: number) => new Date(Date.UTC(2026, 7, 1 + i, 12)).toISOString().slice(0, 10);

  it('adds all fifteen, and compares them with mood and energy only', () => {
    const added = FACTORS.filter((f) => DERIVED_KEYS.includes(f.key));
    expect(added.map((f) => f.key).sort()).toEqual([...DERIVED_KEYS].sort());
    for (const f of added) expect(f.measures).toEqual(['mood', 'energy']);
    const tested = runInsights(sampleDays()).all.filter((c) => DERIVED_KEYS.includes(c.factor.key));
    expect(tested.length).toBeGreaterThan(20);
    expect(new Set(tested.map((c) => c.measure.key))).toEqual(new Set(['mood', 'energy']));
  });

  it('finds a planted pattern: sudden cool-downs go with lower mood (control: energy, left random, does not)', () => {
    const rand = shufflerRandom(11);
    const days: InsightDay[] = Array.from({ length: 36 }, (_, i) => {
      const snap = i % 4 === 3; // every fourth day is 8°C cooler than the day before
      return {
        date: iso(i),
        measures: { mood: snap ? 2 + Math.round(rand()) : 4 + Math.round(rand()), energy: 1 + Math.floor(rand() * 5) },
        conditions: { temp_max_c: snap ? 14 : 22 + rand(), temp_min_c: 10, pressure_mean_hpa: 1013, rain_mm: 0 },
      };
    });
    const r = runInsights(days);
    const mood = r.all.find((c) => c.factor.key === 'cool_snap' && c.measure.key === 'mood')!;
    expect(mood.tier).toBe('likely');
    expect(mood.sentence).toMatch(/^On sudden cool-downs \(5°C or more below the day before\) your mood averaged/);
    expect(r.likely.some((c) => c.factor.key === 'cool_snap' && c.measure.key === 'energy')).toBe(false);
  });

  it('only compares with yesterday when yesterday was logged (control: daily logging does)', () => {
    const make = (step: number): InsightDay[] =>
      Array.from({ length: 30 }, (_, i) => ({
        date: iso(i * step),
        measures: { mood: 1 + (i % 5), energy: 1 + ((i * 3) % 5) },
        conditions: { temp_max_c: 15 + (i % 7) * 2, temp_min_c: 8, pressure_mean_hpa: 1005 + (i % 6) * 3, rain_mm: i % 3 ? 0 : 5 },
      }));
    const everyOtherDay = runInsights(make(2)).all.map((c) => c.factor.key);
    expect(everyOtherDay).not.toContain('temp_change');
    expect(everyOtherDay).not.toContain('after_rain');
    expect(everyOtherDay).toContain('temp_swing'); // needs only the day itself
    expect(runInsights(make(1)).all.map((c) => c.factor.key)).toContain('temp_change');
  });
});

function shufflerRandom(seedValue: number) {
  let s = seedValue;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
