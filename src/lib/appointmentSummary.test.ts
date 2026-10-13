import { describe, expect, it } from 'vitest';
import {
  SUMMARY_COLUMNS, SUMMARY_FOOTER, buildSummary, daysLoggedText, fewDaysNote, formatDate, formatMeasure,
  formatNumber, formatRange, goalText, periodBounds, summaryTitle, todayLocal, trendWords, type SummaryRow,
} from './appointmentSummary';
import { addDays } from './dashboard';

const end = '2026-10-12';
const day = (offset: number, values: Record<string, number | null>): SummaryRow => ({ log_date: addDays(end, offset), ...values });
type S = ReturnType<typeof buildSummary>;
const pillar = (s: S, name: string) => s.pillars.find((p) => p.name === name)!;
const measure = (s: S, pName: string, key: string) => pillar(s, pName).measures.find((m) => m.key === key);

describe('periodBounds', () => {
  it('30 days ending today, and the 30 days before, with no overlap or gap', () => {
    expect(periodBounds('2026-10-12', 30)).toEqual({ from: '2026-09-13', to: '2026-10-12', prevFrom: '2026-08-14', prevTo: '2026-09-12' });
  });
  it('crosses a year end by local calendar days', () => {
    const b = periodBounds('2026-01-10', 90);
    expect(b.from).toBe('2025-10-13');
    expect(b.prevTo).toBe('2025-10-12');
  });
});

describe('no data, one day, one pillar', () => {
  it('no rows: every pillar is present, empty, and nothing is zero', () => {
    const s = buildSummary([], [], end, 30);
    expect(s.loggedDays).toBe(0);
    expect(s.checkIns).toBe(0);
    expect(s.pillars.map((p) => p.name)).toEqual(['Drink', 'Sleep', 'Move', 'Balance']);
    for (const p of s.pillars) {
      expect(p.daysLogged).toBe(0);
      expect(p.measures).toEqual([]);
    }
  });

  it('one day: average, low and high are that day, and there is no trend', () => {
    const s = buildSummary([day(-2, { sleep_hours: 6.5 })], [], end, 30);
    const m = measure(s, 'Sleep', 'sleep_hours')!;
    expect(s.loggedDays).toBe(1);
    expect(m.days).toBe(1);
    expect(m.average).toBe(6.5);
    expect(m.low).toEqual({ value: 6.5, date: addDays(end, -2) });
    expect(m.high).toEqual({ value: 6.5, date: addDays(end, -2) });
    expect(m.trend).toBeNull();
    expect(measure(s, 'Drink', 'water_liters')).toBeUndefined();
  });

  it('all days in one pillar: the others stay at 0 days and loggedDays is the union', () => {
    const rows = Array.from({ length: 10 }, (_, i) => day(-i, { exercise_minutes: 20 + i, steps: 4000 }));
    const s = buildSummary(rows, [], end, 30);
    expect(pillar(s, 'Move').daysLogged).toBe(10);
    expect(pillar(s, 'Sleep').daysLogged).toBe(0);
    expect(pillar(s, 'Balance').daysLogged).toBe(0);
    expect(s.loggedDays).toBe(10);
    expect(s.checkIns).toBe(0);
  });
});

describe('null is never 0', () => {
  it('a null day is not counted, not averaged, and cannot be the lowest', () => {
    const rows = [day(0, { exercise_minutes: 30 }), day(-1, { exercise_minutes: null }), day(-2, { exercise_minutes: 50 })];
    const m = measure(buildSummary(rows, [], end, 30), 'Move', 'exercise_minutes')!;
    expect(m.days).toBe(2);
    expect(m.average).toBe(40);
    expect(m.low!.value).toBe(30);
  });
  it('a real 0 is kept: zero minutes logged is a value', () => {
    const rows = [day(0, { exercise_minutes: 0 }), day(-1, { exercise_minutes: 40 })];
    const m = measure(buildSummary(rows, [], end, 30), 'Move', 'exercise_minutes')!;
    expect(m.days).toBe(2);
    expect(m.average).toBe(20);
    expect(m.low).toEqual({ value: 0, date: end });
  });
  it('a row of only nulls is not a logged day (control: same row with a value is)', () => {
    expect(buildSummary([day(0, { mood: null, steps: null })], [], end, 30).loggedDays).toBe(0);
    expect(buildSummary([day(0, { mood: 3 })], [], end, 30).loggedDays).toBe(1);
  });
  it('numeric strings from the database are read as numbers; empty strings are gaps', () => {
    const rows = [day(0, { water_liters: '1.5' as unknown as number }), day(-1, { water_liters: '' as unknown as number })];
    const m = measure(buildSummary(rows, [], end, 30), 'Drink', 'water_liters')!;
    expect(m.days).toBe(1);
    expect(m.average).toBe(1.5);
  });
});

describe('period edges', () => {
  it('includes the first and last day, leaves out the day after, keeps the day before for the trend only', () => {
    const b = periodBounds(end, 30);
    const rows: SummaryRow[] = [
      { log_date: b.from, steps: 1000 },
      { log_date: b.to, steps: 3000 },
      { log_date: b.prevTo, steps: 99999 }, // previous period
      { log_date: addDays(end, 1), steps: 88888 }, // future: left out
    ];
    const m = measure(buildSummary(rows, [], end, 30), 'Move', 'steps')!;
    expect(m.days).toBe(2);
    expect(m.average).toBe(2000);
    expect(m.high!.value).toBe(3000);
    expect(m.previousAverage).toBe(99999);
  });
  it('30 days leaves out a day 45 days back that 90 days includes (control)', () => {
    const rows = [day(-45, { steps: 5000 })];
    expect(buildSummary(rows, [], end, 30).loggedDays).toBe(0);
    expect(buildSummary(rows, [], end, 90).loggedDays).toBe(1);
  });
  it('a repeated date counts once', () => {
    const rows = [day(-1, { steps: 1000 }), day(-1, { steps: 3000 })];
    expect(measure(buildSummary(rows, [], end, 30), 'Move', 'steps')!.days).toBe(1);
  });
});

describe('lowest and highest', () => {
  const rows = [
    day(-3, { sleep_hours: 5 }), day(-4, { sleep_hours: 9 }), day(-5, { sleep_hours: 7 }),
    day(-6, { sleep_hours: 5 }), day(-7, { sleep_hours: 9 }),
  ];
  const m = measure(buildSummary(rows, [], end, 30), 'Sleep', 'sleep_hours')!;
  it('finds them', () => {
    expect(m.low!.value).toBe(5);
    expect(m.high!.value).toBe(9);
  });
  it('ties go to the earliest date', () => {
    expect(m.low!.date).toBe(addDays(end, -6));
    expect(m.high!.date).toBe(addDays(end, -7));
  });
  it('average is the mean of logged values', () => {
    expect(m.average).toBeCloseTo(7, 10);
  });
});

describe('Balance check-ins', () => {
  it('counts days with at least one of mood, energy, stress once each', () => {
    const rows = [day(0, { mood: 4, energy: 3 }), day(-1, { stress: 2 }), day(-2, { mood: null, energy: null, stress: null }), day(-3, { steps: 100 })];
    const s = buildSummary(rows, [], end, 30);
    expect(s.checkIns).toBe(2);
    expect(pillar(s, 'Balance').daysLogged).toBe(2);
    expect(measure(s, 'Balance', 'mood')!.average).toBe(4);
    expect(measure(s, 'Balance', 'stress')!.days).toBe(1);
  });
});

describe('trend against the previous period of the same length', () => {
  const series = (offsetStart: number, n: number, v: number) =>
    Array.from({ length: n }, (_, i) => day(offsetStart - i, { sleep_hours: v }));
  const trendOf = (rows: SummaryRow[]) => measure(buildSummary(rows, [], end, 30), 'Sleep', 'sleep_hours')!.trend;

  it('about the same when the averages are within the threshold', () => {
    const t = trendOf([...series(0, 5, 7), ...series(-30, 5, 7.3)])!;
    expect(t.direction).toBe('same');
    expect(t.text).toBe('About the same as the 30 days before.');
  });
  it('a little lower for a small change', () => {
    expect(trendOf([...series(0, 5, 6.2), ...series(-30, 5, 7)])!.text).toBe('A little lower than the 30 days before.');
  });
  it('a little higher for a small change up', () => {
    expect(trendOf([...series(0, 5, 7.8), ...series(-30, 5, 7)])!.text).toBe('A little higher than the 30 days before.');
  });
  it('clearly lower for a large change', () => {
    expect(trendOf([...series(0, 5, 5), ...series(-30, 5, 8)])!.text).toBe('Clearly lower than the 30 days before.');
  });
  it('no trend when the previous period has fewer than 3 values (control: 3 gives one)', () => {
    expect(trendOf([...series(0, 5, 7), ...series(-30, 2, 7)])).toBeNull();
    expect(trendOf([...series(0, 5, 7), ...series(-30, 3, 7)])).not.toBeNull();
  });
  it('no trend when the current period has fewer than 3 values', () => {
    expect(trendOf([...series(0, 2, 7), ...series(-30, 5, 7)])).toBeNull();
  });
  it('never uses judging words', () => {
    const words = [trendWords({ same: 0.5 }, 5, 8, 30).text, trendWords({ same: 0.5 }, 8, 5, 30).text, trendWords({ same: 0.5 }, 5, 5, 90).text].join(' ');
    expect(words).not.toMatch(/better|worse|good|bad|improv|declin|worry|concern|should/i);
  });
  it('exactly at the threshold is no longer "about the same"', () => {
    expect(trendWords({ same: 0.5 }, 7.5, 7, 30).direction).toBe('higher');
    expect(trendWords({ same: 0.5 }, 7.49, 7, 30).direction).toBe('same');
  });
  it('uses 90 in the words for a 90-day period', () => {
    expect(trendWords({ same: 1 }, 1, 1, 90).text).toContain('90 days');
  });
});

describe('goals sit beside the average', () => {
  const goals = [
    { goal_type: 'sleep', target_value: 8, unit: 'hours/night' },
    { goal_type: 'exercise', target_value: 30, unit: 'minutes/day' },
  ];
  const rows = [day(0, { sleep_hours: 4, exercise_minutes: 90, steps: 2000, water_liters: 1 })];
  const s = buildSummary(rows, goals, end, 30);
  it("attaches the person's own goal where one exists", () => {
    expect(measure(s, 'Sleep', 'sleep_hours')!.goal).toEqual({ target: 8, unit: 'hours/night' });
    expect(measure(s, 'Move', 'exercise_minutes')!.goal).toEqual({ target: 30, unit: 'minutes/day' });
  });
  it('no goal means null', () => {
    expect(measure(s, 'Move', 'steps')!.goal).toBeNull();
    expect(measure(s, 'Drink', 'water_liters')!.goal).toBeNull();
  });
  it('carries no pass or fail field, whatever the numbers (sleep 4 vs goal 8, exercise 90 vs 30)', () => {
    expect(JSON.stringify(s)).not.toMatch(/met|pass|fail|reached|achiev|onTrack|status|color|colour/i);
  });
  it('a goal alone does not make a logged day', () => {
    expect(buildSummary([], goals, end, 30).loggedDays).toBe(0);
  });
});

describe('privacy', () => {
  it('the column list never includes notes, feelings, location or check-in data', () => {
    const cols = SUMMARY_COLUMNS as readonly string[];
    for (const banned of ['notes', 'feelings', 'latitude', 'longitude', 'location_name', 'location_source', 'user_id', 'source']) {
      expect(cols).not.toContain(banned);
    }
    expect(cols.join(' ')).not.toMatch(/phq|checkin|answer|score/i);
  });
  it('even if a row carries notes and feelings, they never reach the output (control: they are in the input)', () => {
    const row = { ...day(0, { mood: 3 }), notes: 'SECRET-NOTE', feelings: ['SECRET-FEELING'], location_name: 'SECRET-PLACE' } as unknown as SummaryRow;
    expect(JSON.stringify(row)).toContain('SECRET-NOTE');
    expect(JSON.stringify(buildSummary([row], [], end, 30))).not.toMatch(/SECRET/);
  });
});

describe('words', () => {
  it('formats numbers with separators and trims .0', () => {
    expect(formatNumber(8000, 0)).toBe('8,000');
    expect(formatNumber(7, 1)).toBe('7');
    expect(formatNumber(7.25, 1)).toBe('7.3');
    expect(formatNumber(1234567, 0)).toBe('1,234,567');
  });
  it('formats a measure with its unit', () => {
    expect(formatMeasure(6.5, { decimals: 1, unit: ' hours' })).toBe('6.5 hours');
    expect(formatMeasure(3, { decimals: 1, unit: '' })).toBe('3');
  });
  it('formats dates the same everywhere, from the local calendar', () => {
    expect(formatDate('2026-03-03')).toBe('Mar 3, 2026');
    expect(formatRange('2026-09-13', '2026-10-12')).toBe('Sep 13, 2026 to Oct 12, 2026');
  });
  it('today is the local date, not UTC', () => {
    expect(todayLocal(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12');
    expect(todayLocal(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
  it('title uses the optional name', () => {
    expect(summaryTitle('')).toBe('Summary for my appointment');
    expect(summaryTitle('  Ana  ')).toBe('Summary for my appointment: Ana');
  });
  it('days logged text', () => {
    expect(daysLoggedText(0, 30)).toBe('You did not log any days in the last 30 days.');
    expect(daysLoggedText(1, 30)).toBe('You logged 1 day in the last 30 days.');
    expect(daysLoggedText(12, 90)).toBe('You logged 12 days in the last 90 days.');
  });
  it('the few-days note matches the agreed wording and disappears with enough days', () => {
    expect(fewDaysNote(3)).toBe('You logged 3 days in this time. The summary will be more useful with more days, but you can still print it.');
    expect(fewDaysNote(1)).toContain('You logged 1 day in this time.');
    expect(fewDaysNote(0)).toContain('all days off');
    expect(fewDaysNote(5)).toBeNull();
    expect(fewDaysNote(30)).toBeNull();
  });
  it('goal text', () => {
    expect(goalText({ target: 8, unit: 'hours/night' })).toBe('8 hours/night');
    expect(goalText({ target: 2.5, unit: 'liters/day' })).toBe('2.5 liters/day');
    expect(goalText({ target: 8000, unit: 'steps/day' })).toBe('8,000 steps/day');
  });
  it('the footer is exactly the agreed sentence', () => {
    expect(SUMMARY_FOOTER).toBe('Notes written by me, from what I logged in Build Your Pillars. This is not a medical record or a diagnosis.');
  });
});
