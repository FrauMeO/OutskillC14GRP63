import { describe, expect, it } from 'vitest';
import {
  barFill,
  flagsOf,
  formatValue,
  hasAnyPillar,
  normaliseEmail,
  openShares,
  pillarSummary,
  sameFlags,
  statusLabel,
  summariseShared,
  summaryRange,
  validateEmail,
  weekText,
  type PillarFlags,
  type SharedDay,
} from './careShares';
import { addDays } from './dashboard';

const flags = (eat: boolean, sleep: boolean, move: boolean, balance: boolean): PillarFlags => ({ eat, sleep, move, balance });
const today = '2026-10-12';
const day = (offset: number, extra: Partial<SharedDay> = {}): SharedDay => ({
  log_date: addDays(today, -offset),
  water_liters: null, calories_consumed: null, sleep_hours: null, time_in_bed_hours: null, awake_minutes: null,
  exercise_minutes: null, steps: null, stand_hours: null, active_calories: null, mood: null, energy: null, stress: null,
  ...extra,
});

describe('pillar summary', () => {
  it('names the shared pillars in order, in plain words', () => {
    expect(pillarSummary(flags(true, true, true, false))).toBe('Eat, Sleep and Move');
    expect(pillarSummary(flags(true, false, false, true))).toBe('Eat and Balance');
    expect(pillarSummary(flags(false, true, false, false))).toBe('Sleep');
    expect(pillarSummary(flags(true, true, true, true))).toBe('Eat, Sleep, Move and Balance');
    // control: none is not an empty string and not a pillar name
    expect(pillarSummary(flags(false, false, false, false))).toBe('Nothing yet');
    expect(pillarSummary(flags(true, true, true, false))).not.toContain('Balance');
  });
  it('reads flags from a share row and compares them', () => {
    const f = flagsOf({ share_eat: true, share_sleep: false, share_move: true, share_balance: false });
    expect(f).toEqual(flags(true, false, true, false));
    expect(sameFlags(f, flags(true, false, true, false))).toBe(true);
    expect(sameFlags(f, flags(true, false, true, true))).toBe(false);
    expect(hasAnyPillar(f)).toBe(true);
    expect(hasAnyPillar(flags(false, false, false, false))).toBe(false);
  });
});

describe('email rule (mirrors the SQL)', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });
  it('accepts normal addresses', () => {
    expect(validateEmail(' Sam@Example.com ')).toBeNull();
    expect(validateEmail('a.b+c@mail.example.co.uk')).toBeNull();
  });
  it('rejects what the database rejects (controls)', () => {
    for (const bad of ['', 'sam', 'sam@', '@example.com', 'sam@example', 'sam@@example.com', 'a@b@c.com', 'sam @example.com', 'sam@exam ple.com', 'sam@.', 'sam@example.']) {
      expect(validateEmail(bad), bad).toBe('That does not look like an email address.');
    }
  });
  it('allows 254 characters and refuses 255', () => {
    const at254 = `${'a'.repeat(254 - '@b.co'.length)}@b.co`;
    expect(at254.length).toBe(254);
    expect(validateEmail(at254)).toBeNull();
    expect(validateEmail('a' + at254)).not.toBeNull();
  });
});

describe('status and list', () => {
  it('uses the plain labels and hides ended shares', () => {
    expect(statusLabel('pending')).toBe('Waiting for them to accept');
    expect(statusLabel('active')).toBe('Following');
    const rows = [{ status: 'pending' as const }, { status: 'revoked' as const }, { status: 'active' as const }];
    expect(openShares(rows)).toHaveLength(2);
    expect(openShares(rows).some((r) => r.status === 'revoked')).toBe(false);
  });
});

describe('summary range', () => {
  it('is the last 28 days ending today, inside the 93-day limit', () => {
    const r = summaryRange(today);
    expect(r.to).toBe('2026-10-12');
    expect(r.from).toBe('2026-09-15');
  });
});

describe('shared summary', () => {
  const eatSleep = flags(true, true, false, false);

  it('counts logged days in each of the last four 7-day weeks, oldest first', () => {
    // Week 0 (last 7 days): 4 days. Week 1: 2 days. Week 2: none. Week 3: 1 day.
    const rows = [day(0, { water_liters: 2 }), day(2, { sleep_hours: 7 }), day(4, { water_liters: 1 }), day(6, { sleep_hours: 8 }),
      day(8, { water_liters: 2 }), day(12, { sleep_hours: 6 }), day(25, { water_liters: 2 })];
    const s = summariseShared(rows, eatSleep, [], today);
    expect(s.weeks.map((w) => w.daysLogged)).toEqual([1, 0, 2, 4]);
    expect(s.weeks.map((w) => w.fullWeek)).toEqual([false, false, false, true]);
    expect(s.weeks[3].end).toBe(today);
    expect(s.weeks[0].start).toBe('2026-09-15');
    // control: the numbers are not all equal, so a broken counter could not pass
    expect(new Set(s.weeks.map((w) => w.daysLogged)).size).toBeGreaterThan(1);
  });

  it('four logged days in seven is a full week, three is not', () => {
    const four = summariseShared([0, 1, 2, 3].map((o) => day(o, { water_liters: 1 })), eatSleep, [], today);
    expect(four.weeks[3]).toMatchObject({ daysLogged: 4, fullWeek: true });
    const three = summariseShared([0, 1, 2].map((o) => day(o, { water_liters: 1 })), eatSleep, [], today);
    expect(three.weeks[3]).toMatchObject({ daysLogged: 3, fullWeek: false });
  });

  it('counts full weeks in a row with the existing rhythm rule', () => {
    const rows: SharedDay[] = [];
    for (const w of [0, 1, 2]) for (const o of [0, 2, 4, 6]) rows.push(day(7 * w + o, { sleep_hours: 7 }));
    expect(summariseShared(rows, eatSleep, [], today).weeksInRow).toBe(3);
    expect(summariseShared([], eatSleep, [], today).weeksInRow).toBe(0);
  });

  it('shows gaps as null, never zero, and a real zero stays a zero', () => {
    const s = summariseShared([day(0, { water_liters: 0 }), day(2, { water_liters: 1.5 })], eatSleep, [], today);
    const water = s.metrics.find((m) => m.metric.field === 'water_liters')!;
    expect(water.days).toHaveLength(7);
    expect(water.days.map((d) => d.value)).toEqual([null, null, null, null, 1.5, null, 0]);
  });

  it('includes only the shared pillars, and ignores stray values for unshared ones', () => {
    // The rows carry mood and steps although only Eat and Sleep are shared (control for a leak).
    const rows = [day(0, { water_liters: 2, mood: 4, steps: 9000 }), day(1, { mood: 2 })];
    const s = summariseShared(rows, eatSleep, [], today);
    const fields = s.metrics.map((m) => m.metric.field);
    expect(fields).toEqual(['water_liters', 'calories_consumed', 'sleep_hours', 'time_in_bed_hours', 'awake_minutes']);
    expect(fields).not.toContain('mood');
    expect(fields).not.toContain('steps');
    // day 1 has only an unshared value, so it is not a logged day
    expect(s.weeks[3].daysLogged).toBe(1);
    // and with Balance shared, mood does show (positive control)
    const withBalance = summariseShared(rows, flags(true, true, false, true), [], today);
    expect(withBalance.metrics.find((m) => m.metric.field === 'mood')!.days.map((d) => d.value)).toContain(4);
  });

  it('attaches the owner goal to its measure only when one is shared', () => {
    const goals = [{ goal_type: 'water', target_value: 2.5, unit: 'liters/day' }, { goal_type: 'sleep', target_value: 8, unit: 'hours/night' }];
    const s = summariseShared([day(0, { water_liters: 2 })], eatSleep, goals, today);
    expect(s.metrics.find((m) => m.metric.field === 'water_liters')!.goal).toBe(2.5);
    expect(s.metrics.find((m) => m.metric.field === 'sleep_hours')!.goal).toBe(8);
    expect(s.metrics.find((m) => m.metric.field === 'calories_consumed')!.goal).toBeNull();
    expect(s.metrics.find((m) => m.metric.field === 'awake_minutes')!.goal).toBeNull();
  });

  it('has no field for missed days, and the words never mark a miss', () => {
    const s = summariseShared([day(0, { water_liters: 1 })], eatSleep, [], today);
    expect(Object.keys(s)).toEqual(['weeks', 'weeksInRow', 'metrics']);
    expect(Object.keys(s.weeks[0]).sort()).toEqual(['daysLogged', 'end', 'fullWeek', 'start']);
    for (const w of s.weeks) expect(weekText(w)).not.toMatch(/miss|only|streak|lost|zero|behind/i);
    expect(weekText({ start: '', end: '', daysLogged: 0, fullWeek: false })).toBe('Nothing logged');
    expect(weekText({ start: '', end: '', daysLogged: 1, fullWeek: false })).toBe('1 day logged');
    expect(weekText({ start: '', end: '', daysLogged: 5, fullWeek: true })).toBe('5 days logged, a full week');
  });

  it('works across a month boundary (local calendar dates)', () => {
    const s = summariseShared([{ ...day(0, { water_liters: 1 }), log_date: '2026-03-01' }], eatSleep, [], '2026-03-01');
    expect(s.weeks[3].daysLogged).toBe(1);
    expect(s.weeks[0].start).toBe('2026-02-02');
  });
});

describe('bars and values', () => {
  it('fills against the goal, capped, and never invents one', () => {
    expect(barFill(1, 2)).toBe(0.5);
    expect(barFill(5, 2)).toBe(1);
    expect(barFill(0, 2)).toBe(0);
    expect(barFill(null, 2)).toBeNull();
    expect(barFill(1, null)).toBeNull();
    expect(barFill(1, 0)).toBeNull();
  });
  it('formats values', () => {
    expect(formatValue(8000)).toBe('8,000');
    expect(formatValue(7.25)).toBe('7.3');
    expect(formatValue(0)).toBe('0');
  });
});
