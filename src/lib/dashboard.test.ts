import { describe, expect, it } from 'vitest';
import { addDays, goalTargets, indicatorFor, loggingStreak, missingCategories, netCalories, progress, series } from './dashboard';

const full = (log_date: string) => ({ log_date, steps: 4000, sleep_hours: 7, water_liters: 2, mood: 3 });

describe('progress', () => {
  it('shows the real percentage over 100 but caps the fill', () => {
    expect(progress(12000, 8000)).toEqual({ value: 12000, goal: 8000, percent: 150, fill: 1 });
    expect(progress(4000, 8000)).toMatchObject({ percent: 50, fill: 0.5 });
  });
  it('has no progress without a value or a goal (control: zero is a real value)', () => {
    expect(progress(null, 8000)).toBeNull();
    expect(progress(5000, null)).toBeNull();
    expect(progress(0, 8000)).toMatchObject({ percent: 0, fill: 0 });
  });
});

describe('ring vs bar', () => {
  it('uses a ring for Apple Health and a bar for anything else', () => {
    expect(indicatorFor('apple_health')).toBe('ring');
    expect(indicatorFor('manual')).toBe('bar');
    expect(indicatorFor(null)).toBe('bar');
  });
});

describe('daily values', () => {
  it('reads numeric strings from the database and keeps null as not logged', () => {
    expect(netCalories({ calories_consumed: '2100', active_calories: 450 })).toBe(1650);
    expect(netCalories({ calories_consumed: 2100, active_calories: null })).toBeNull();
  });
  it('ignores unknown goal types', () => {
    expect(goalTargets([{ goal_type: 'steps', target_value: '8000' }, { goal_type: 'flights', target_value: 5 }])).toEqual({ steps: 8000 });
  });
});

describe('local date boundaries', () => {
  it('steps across month, year and daylight-saving changes by calendar day', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02'); // US clocks change on 2026-11-01
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07'); // and on 2026-03-08
  });
  it('builds seven days ending today, with gaps (null) for days without a log', () => {
    const s = series([{ log_date: '2026-09-25', steps: 10 }, { log_date: '2026-09-20', steps: 0 }], 'steps', '2026-09-25');
    expect(s.map((p) => p.date)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
    expect(s.map((p) => p.value)).toEqual([null, 0, null, null, null, null, 10]);
  });
});

describe('logging streak', () => {
  const today = '2026-09-25';

  it('counts a streak longer than seven days', () => {
    const rows = Array.from({ length: 10 }, (_, i) => full(addDays(today, -i)));
    expect(loggingStreak(rows, today)).toMatchObject({ days: 10, endsOn: today, todayComplete: true });
  });

  it('stops at a broken day (control: the gap is what ends it)', () => {
    const rows = [full(today), full(addDays(today, -1)), full(addDays(today, -3))];
    expect(loggingStreak(rows, today).days).toBe(2);
    expect(loggingStreak([...rows, full(addDays(today, -2))], today).days).toBe(4);
  });

  it('counts through yesterday when today is incomplete, and lists what is missing', () => {
    const rows = [{ log_date: today, steps: 3000, mood: 4 }, full(addDays(today, -1)), full(addDays(today, -2))];
    expect(loggingStreak(rows, today)).toEqual({ days: 2, endsOn: addDays(today, -1), todayComplete: false, todayMissing: ['sleep', 'nutrition'] });
  });

  it('needs all four categories; notes do not count and goals need not be met', () => {
    expect(missingCategories({ steps: 1, sleep_hours: 1, water_liters: 1, notes: 'hi' })).toEqual(['wellbeing']);
    expect(missingCategories({ exercise_minutes: 0, awake_minutes: 0, calories_consumed: 0, stress: 1 })).toEqual([]);
  });

  it('is zero for a new user with no logs (empty state)', () => {
    expect(loggingStreak([], today)).toEqual({
      days: 0, endsOn: null, todayComplete: false, todayMissing: ['exercise', 'sleep', 'nutrition', 'wellbeing'],
    });
  });
});
