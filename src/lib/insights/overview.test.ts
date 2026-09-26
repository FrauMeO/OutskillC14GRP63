import { describe, expect, it } from 'vitest';
import { addDays } from '../dashboard';
import { FACTORS, MEASURES, type Comparison } from './engine';
import { harderSituation, invitations, lastFourWeeks, median, weekVsUsual } from './overview';

const today = '2026-09-26';
const day = (offset: number, values: Record<string, number | null>) => ({ log_date: addDays(today, offset), ...values });

// Eight usual weeks of 7-hour sleep and mood 3, then a week of 8.5 hours and mood 3.
const rows = [
  ...Array.from({ length: 20 }, (_, i) => day(-8 - i, { sleep_hours: 7, mood: 3, stress: 2 })),
  ...Array.from({ length: 5 }, (_, i) => day(-i, { sleep_hours: 8.5, mood: 3, stress: 4 })),
];

const comparison = (factorKey: string, measureKey: string, over: Partial<Comparison>): Comparison => ({
  factor: FACTORS.find((f) => f.key === factorKey)!,
  measure: MEASURES.find((m) => m.key === measureKey)!,
  n: 21, p: 0.01, pAdjusted: 0.2, effect: 0.4, tier: 'explore', sentence: '', highAvg: 0, lowAvg: 0,
  ...over,
});

describe('the last four weeks', () => {
  it('counts logged days and days per pillar, and ignores older days (control)', () => {
    const o = lastFourWeeks([...rows, day(-40, { sleep_hours: 7 })], today);
    expect(o.loggedDays).toBe(25); // days -27..0; the day 40 days back is left out
    expect(o.byPillar.map((p) => p.name)).toEqual(['Eat', 'Sleep', 'Move', 'Balance']);
    expect(o.byPillar.find((p) => p.name === 'Sleep')!.days).toBe(o.loggedDays);
    expect(o.byPillar.find((p) => p.name === 'Eat')!.days).toBe(0);
  });
});

describe('this week against your usual', () => {
  it('uses medians and says more, less or about the same', () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const lines = weekVsUsual(rows, today);
    const sleep = lines.find((l) => l.key === 'sleep_hours')!;
    expect(sleep).toMatchObject({ direction: 'more', week: 8.5, usual: 7 });
    expect(sleep.sentence).toBe('More than your usual: 8.5 hours this week, usually 7 hours.');
    expect(lines.find((l) => l.key === 'mood')!.sentence).toBe('About your usual: 3 this week.');
  });

  it('stays quiet without enough days this week or before (control)', () => {
    expect(weekVsUsual(rows.slice(0, 20), today)).toEqual([]); // nothing this week
    expect(weekVsUsual(rows.slice(20), today)).toEqual([]); // no usual yet
    expect(weekVsUsual(rows, today).find((l) => l.key === 'water_liters')).toBeUndefined();
  });

  it('never judges or compares with anyone else', () => {
    for (const l of weekVsUsual(rows, today)) expect(l.sentence).not.toMatch(/should|better|worse|average|normal|goal/i);
  });
});

describe('gentle invitations', () => {
  it('finds the harder side of a pattern in the person’s own data', () => {
    // Rainy days went with lower mood (yes-group average lower).
    expect(harderSituation(comparison('rainy_day', 'mood', { highAvg: 2.5, lowAvg: 3.5 }))).toBe('rainy days');
    // For stress, higher is the harder side: dry days here.
    expect(harderSituation(comparison('rainy_day', 'stress', { highAvg: 2, lowAvg: 3 }))).toBe('dry days');
    // Continuous: more daylight went with more sleep, so the least daylight is harder.
    expect(harderSituation(comparison('daylight_hours', 'sleep_hours', { effect: 0.5 }))).toBe('days with the least daylight');
  });

  it('offers at most two, one per measure, phrased as an invitation', () => {
    const patterns = [
      comparison('rainy_day', 'mood', { highAvg: 2.5, lowAvg: 3.5 }),
      comparison('humidity_mean_pct', 'mood', { effect: -0.4 }),
    ];
    const out = invitations(patterns, weekVsUsual(rows, today));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: 'mood', basedOn: 'pattern' });
    expect(out[0].text).toBe(
      'On rainy days, you have tended to have a lower mood. On the next few, if you like, try a short walk, a favourite song, or a message to a friend, and notice how it feels.',
    );
    // The second comes from this week: stress higher than usual. More sleep is not a harder side (control).
    expect(out[1]).toMatchObject({ key: 'stress', basedOn: 'week' });
    for (const i of out) {
      expect(i.text).toMatch(/if you like/i);
      expect(i.text).not.toMatch(/should|must|because|causes?/i);
    }
  });

  it('explains why, with the evidence from the person’s own days', () => {
    const c = comparison('rainy_day', 'mood', { highAvg: 2.5, lowAvg: 3.5, sentence: 'On rainy days (over 2 mm) your mood averaged 2.5, compared with 3.5 on dry days (40 days).' });
    const [first, second] = invitations([c], weekVsUsual(rows, today));
    expect(first.why).toBe(
      'From your own days: On rainy days (over 2 mm) your mood averaged 2.5, compared with 3.5 on dry days (40 days). This is an early hint: it stood out on its own but may change as you log more days. It shows what went together, not what caused what.',
    );
    expect(invitations([{ ...c, tier: 'likely' }], [])[0].why).toMatch(/held up after every comparison/);
    expect(second.why).toBe(
      'From your own days: Stress. Higher than your usual: 4 this week, usually 2. This compares this week\'s middle value with your own eight weeks before it, never with anyone else.',
    );
  });

  it('offers nothing when there is nothing in the data (control)', () => {
    expect(invitations([], [])).toEqual([]);
  });
});
