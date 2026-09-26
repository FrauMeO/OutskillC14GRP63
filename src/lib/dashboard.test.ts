import { describe, expect, it } from 'vitest';
import { FULL_WEEK_DAYS, addDays, goalTargets, indicatorFor, missingCategories, netCalories, progress, rhythmText, series, weeklyRhythm } from './dashboard';

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

describe('weekly rhythm', () => {
  const today = '2026-09-26';
  const on = (...offsets: number[]) => offsets.map((o) => ({ log_date: addDays(today, -o), mood: 3 }));

  it('counts any logged day, and a full week is four of the last seven (control: a notes-only row is not a logged day)', () => {
    expect(FULL_WEEK_DAYS).toBe(4);
    expect(weeklyRhythm(on(0, 2, 4, 6), today)).toMatchObject({ daysThisWeek: 4, fullWeek: true, loggedToday: true });
    expect(weeklyRhythm([...on(1, 2, 3), { log_date: today, notes: 'hi' }], today)).toMatchObject({ daysThisWeek: 3, fullWeek: false, loggedToday: false });
  });

  it('rest days never break the run, and a week still in progress does not either', () => {
    // Four days in each of the last three weeks, with rest days between.
    const three = on(0, 2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 20);
    expect(weeklyRhythm(three, today).weeksInRow).toBe(3);
    // This week only has one day so far: last week's run still stands.
    expect(weeklyRhythm(on(1, 7, 8, 9, 10), today)).toMatchObject({ daysThisWeek: 1, weeksInRow: 1 });
    // Control: a quiet week earlier ends the run.
    expect(weeklyRhythm(on(0, 1, 2, 3, 14, 15, 16, 17), today).weeksInRow).toBe(1);
  });

  it('celebrates arrivals and never names missed days or a lost streak', () => {
    const texts = [
      rhythmText({ daysThisWeek: 5, fullWeek: true, weeksInRow: 3, loggedToday: true }),
      rhythmText({ daysThisWeek: 3, fullWeek: false, weeksInRow: 1, loggedToday: false }),
      rhythmText({ daysThisWeek: 1, fullWeek: false, weeksInRow: 2, loggedToday: true }),
      rhythmText({ daysThisWeek: 0, fullWeek: false, weeksInRow: 0, loggedToday: false }),
    ];
    expect(texts[0]).toEqual({ title: 'A full week', body: 'You logged 5 days in the last seven. That is 3 full weeks in a row.' });
    expect(texts[1]).toEqual({ title: '3 days this week', body: 'One more day makes a full week, whenever it suits you. The week before was a full one.' });
    expect(texts[2].body).toBe('3 more days make a full week, whenever it suits you. The 2 weeks before were full ones.');
    expect(texts[3]).toEqual({ title: 'A fresh week', body: 'Log whenever you are ready.' });
    for (const t of texts) expect(`${t.title} ${t.body}`).not.toMatch(/missed|lost|broke|only|behind|streak/i);
  });
});
