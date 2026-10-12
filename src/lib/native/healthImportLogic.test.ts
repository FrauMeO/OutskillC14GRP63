import { describe, expect, it } from 'vitest';
import {
  combineDays,
  importWindow,
  mapExerciseTime,
  mapSleep,
  mapSteps,
  mapWater,
  mapWorkouts,
  planUpserts,
  sourceFor,
  wakeDate,
  windowDates,
  type ImportDay,
} from './healthImportLogic';

// Local-time helper so the tests pass in any time zone.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('window', () => {
  it('is 14 full days ending yesterday, never including today', () => {
    const now = new Date(2026, 9, 12, 15, 30); // 12 Oct 2026
    const dates = windowDates(14, now);
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-09-28');
    expect(dates[13]).toBe('2026-10-11');
    expect(dates).not.toContain('2026-10-12');
    const { start, end } = importWindow(14, now);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(12);
  });
});

describe('steps', () => {
  it('rounds to whole numbers and keys by local date', () => {
    const m = mapSteps([{ startDate: at(2026, 10, 10), value: 8123.6 }]);
    expect(m.get('2026-10-10')).toBe(8124);
  });
  it('treats no steps as not logged, not 0', () => {
    expect(mapSteps([{ startDate: at(2026, 10, 10), value: 0 }]).size).toBe(0);
  });
  it('drops values the database would reject', () => {
    expect(mapSteps([{ startDate: at(2026, 10, 10), value: 250000 }]).size).toBe(0);
  });
  it('ignores bad dates and NaN', () => {
    expect(mapSteps([{ startDate: 'nope', value: 5 }, { startDate: at(2026, 10, 10), value: NaN }]).size).toBe(0);
  });
});

describe('water', () => {
  it('keeps litres to 3 decimals', () => {
    expect(mapWater([{ startDate: at(2026, 10, 10), value: 1.23456 }]).get('2026-10-10')).toBe(1.235);
  });
  it('sums buckets that fall on the same date', () => {
    const m = mapWater([
      { startDate: at(2026, 10, 10, 0), value: 0.5 },
      { startDate: at(2026, 10, 10, 12), value: 0.75 },
    ]);
    expect(m.get('2026-10-10')).toBe(1.25);
  });
});

describe('exercise minutes', () => {
  it('iOS: sums Exercise Time samples per day into whole minutes', () => {
    const m = mapExerciseTime([
      { startDate: at(2026, 10, 10, 9), value: 1 },
      { startDate: at(2026, 10, 10, 9, 1), value: 1 },
      { startDate: at(2026, 10, 10, 18), value: 28.4 },
    ]);
    expect(m.get('2026-10-10')).toBe(30);
  });
  it('Android: turns session seconds into whole minutes', () => {
    const m = mapWorkouts([
      { startDate: at(2026, 10, 10, 7), duration: 1800 },
      { startDate: at(2026, 10, 10, 17), duration: 905 },
    ]);
    expect(m.get('2026-10-10')).toBe(45); // 30 + 15.08 = 45.08
  });
});

describe('sleep', () => {
  const asleep = (sd: string, ed: string, state: string, src = 'Apple Watch') => ({
    startDate: sd,
    endDate: ed,
    sourceName: src,
    sleepState: state,
  });

  it('credits a night to the day you wake up', () => {
    // 22:30 on the 9th to 06:30 on the 10th = 8 h, belongs to the 10th
    const m = mapSleep([asleep(at(2026, 10, 9, 22, 30), at(2026, 10, 10, 6, 30), 'asleep')], {
      unstagedCountsAsAsleep: false,
    });
    expect(m.get('2026-10-10')).toBe(8);
    expect(m.has('2026-10-09')).toBe(false);
  });

  it('wakeDate uses an 18:00 boundary', () => {
    expect(wakeDate(at(2026, 10, 10, 17, 59))).toBe('2026-10-10');
    expect(wakeDate(at(2026, 10, 10, 18, 0))).toBe('2026-10-11');
  });

  it('counts only asleep stages, not in-bed or awake', () => {
    const m = mapSleep(
      [
        asleep(at(2026, 10, 9, 22, 0), at(2026, 10, 10, 6, 0), 'inBed'),
        asleep(at(2026, 10, 9, 23, 0), at(2026, 10, 10, 2, 0), 'deep'),
        asleep(at(2026, 10, 10, 2, 0), at(2026, 10, 10, 2, 30), 'awake'),
        asleep(at(2026, 10, 10, 2, 30), at(2026, 10, 10, 5, 30), 'rem'),
      ],
      { unstagedCountsAsAsleep: false },
    );
    expect(m.get('2026-10-10')).toBe(6); // 3 h deep + 3 h REM
  });

  it('does not double count overlapping stretches from the same source', () => {
    const m = mapSleep(
      [
        asleep(at(2026, 10, 9, 23, 0), at(2026, 10, 10, 3, 0), 'asleep'),
        asleep(at(2026, 10, 10, 2, 0), at(2026, 10, 10, 6, 0), 'asleep'),
      ],
      { unstagedCountsAsAsleep: false },
    );
    expect(m.get('2026-10-10')).toBe(7);
  });

  it('uses one source per night: the Watch, never phone plus Watch added together', () => {
    const m = mapSleep(
      [
        asleep(at(2026, 10, 9, 23, 0), at(2026, 10, 10, 6, 0), 'asleep', 'Apple Watch'),
        asleep(at(2026, 10, 9, 22, 0), at(2026, 10, 10, 8, 0), 'asleep', 'iPhone'),
      ],
      { unstagedCountsAsAsleep: false },
    );
    expect(m.get('2026-10-10')).toBe(7); // the Watch, not the longer phone record
  });

  it('with no Watch, takes the longest source', () => {
    const m = mapSleep(
      [
        asleep(at(2026, 10, 9, 23, 0), at(2026, 10, 10, 5, 0), 'asleep', 'App A'),
        asleep(at(2026, 10, 9, 22, 0), at(2026, 10, 10, 6, 0), 'asleep', 'App B'),
      ],
      { unstagedCountsAsAsleep: false },
    );
    expect(m.get('2026-10-10')).toBe(8);
  });

  it('Android: a session without stages counts as sleep; iOS ignores an unlabelled stretch', () => {
    const session = { startDate: at(2026, 10, 9, 23, 0), endDate: at(2026, 10, 10, 6, 30), sourceName: 'com.sleep.app' };
    expect(mapSleep([session], { unstagedCountsAsAsleep: true }).get('2026-10-10')).toBe(7.5);
    expect(mapSleep([session], { unstagedCountsAsAsleep: false }).size).toBe(0);
  });

  it('Android: uses the stages inside a session when present, skipping awake', () => {
    const m = mapSleep(
      [
        {
          startDate: at(2026, 10, 9, 23, 0),
          endDate: at(2026, 10, 10, 6, 0),
          sourceName: 'com.sleep.app',
          stages: [
            { startDate: at(2026, 10, 9, 23, 0), endDate: at(2026, 10, 10, 3, 0), stage: 'light' },
            { startDate: at(2026, 10, 10, 3, 0), endDate: at(2026, 10, 10, 4, 0), stage: 'awake' },
            { startDate: at(2026, 10, 10, 4, 0), endDate: at(2026, 10, 10, 6, 0), stage: 'deep' },
          ],
        },
      ],
      { unstagedCountsAsAsleep: true },
    );
    expect(m.get('2026-10-10')).toBe(6);
  });

  it('rounds to 2 decimals like the file importer', () => {
    const m = mapSleep([asleep(at(2026, 10, 9, 23, 0), at(2026, 10, 10, 6, 20), 'asleep')], {
      unstagedCountsAsAsleep: false,
    });
    expect(m.get('2026-10-10')).toBe(7.33); // 440 min / 60 = 7.3333
  });
});

describe('combineDays: de-dupe by date and window', () => {
  const dates = windowDates(14, new Date(2026, 9, 12));
  it('gives one row per date even when several measures report the same date', () => {
    const rows = combineDays(
      {
        steps: new Map([['2026-10-10', 5000]]),
        water_liters: new Map([['2026-10-10', 1.5]]),
        sleep_hours: new Map([['2026-10-10', 7]]),
        exercise_minutes: new Map([['2026-10-10', 30]]),
      },
      dates,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      log_date: '2026-10-10',
      steps: 5000,
      sleep_hours: 7,
      exercise_minutes: 30,
      water_liters: 1.5,
    });
  });
  it('leaves unreported measures as null, never 0', () => {
    const rows = combineDays({ steps: new Map([['2026-10-10', 5000]]) }, dates);
    expect(rows[0].sleep_hours).toBeNull();
    expect(rows[0].water_liters).toBeNull();
    expect(rows[0].exercise_minutes).toBeNull();
  });
  it('drops dates outside the window (today, older)', () => {
    const rows = combineDays(
      { steps: new Map([['2026-10-12', 100], ['2026-09-01', 200], ['2026-10-11', 300]]) },
      dates,
    );
    expect(rows.map((r) => r.log_date)).toEqual(['2026-10-11']);
  });
  it('sorts oldest first', () => {
    const rows = combineDays({ steps: new Map([['2026-10-11', 1], ['2026-10-02', 2]]) }, dates);
    expect(rows.map((r) => r.log_date)).toEqual(['2026-10-02', '2026-10-11']);
  });
});

describe('planUpserts', () => {
  const day = (log_date: string, p: Partial<ImportDay> = {}): ImportDay => ({
    log_date,
    steps: null,
    sleep_hours: null,
    exercise_minutes: null,
    water_liters: null,
    ...p,
  });

  it('adds new days with the source set', () => {
    const plan = planUpserts([day('2026-10-10', { steps: 6000, sleep_hours: 7 })], [], 'apple_health');
    expect(plan.rows).toEqual([{ log_date: '2026-10-10', steps: 6000, sleep_hours: 7, source: 'apple_health' }]);
    expect(plan.dayCount).toBe(1);
    expect(plan.addedValues).toBe(2);
  });

  it('never replaces a value the person already has, and keeps their source', () => {
    const plan = planUpserts(
      [day('2026-10-10', { steps: 6000, sleep_hours: 7 })],
      [{ log_date: '2026-10-10', sleep_hours: 6.5, steps: null, source: 'manual' }],
      'apple_health',
    );
    expect(plan.rows).toEqual([{ log_date: '2026-10-10', steps: 6000 }]); // sleep kept, no source key
    expect(plan.keptYours).toBe(1);
  });

  it('skips a day completely when everything is already logged', () => {
    const plan = planUpserts(
      [day('2026-10-10', { steps: 6000 })],
      [{ log_date: '2026-10-10', steps: 100, source: 'manual' }],
      'apple_health',
    );
    expect(plan.rows).toEqual([]);
    expect(plan.dayCount).toBe(0);
  });

  it('is harmless to run twice', () => {
    const days = [day('2026-10-10', { steps: 6000 })];
    const first = planUpserts(days, [], 'apple_health');
    const afterFirst = [{ log_date: '2026-10-10', steps: 6000, source: 'apple_health' }];
    const second = planUpserts(days, afterFirst, 'apple_health');
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
  });

  it('never sends a null, so an upsert cannot blank a column', () => {
    const plan = planUpserts([day('2026-10-10', { steps: 6000 })], [], 'apple_health');
    for (const r of plan.rows) for (const v of Object.values(r)) expect(v).not.toBeNull();
  });
});

describe('sourceFor', () => {
  it('uses apple_health on iOS and manual on Android (no allowed Health Connect value yet)', () => {
    expect(sourceFor('ios')).toBe('apple_health');
    expect(sourceFor('android')).toBe('manual');
  });
});
