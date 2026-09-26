import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FDR, MIN_LOGGED_DAYS, runInsights, type InsightDay, type MeasureKey } from './engine';

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
