import { describe, expect, it } from 'vitest';
import { ENCOURAGEMENTS } from './encouragement';
import {
  CELEBRATE_EVERY,
  MAX_GAP,
  MIN_GAP,
  celebrationText,
  dayNumbers,
  encouragementEntries,
  encouragementLine,
  isCelebrationEntry,
  isEncouragementEntry,
  isMarkedDay,
} from './milestones';

const users = ['a1b2c3', '5f9e0d7c-2d1a-4e6b-9c3f-000000000001', 'demo', 'another-person'];

describe('encouragement pacing', () => {
  it('is never closer than 5 entries apart, and never more than 8, over 1000 entries', () => {
    for (const u of users) {
      const at = encouragementEntries(u, 1000);
      expect(at[0]).toBeGreaterThanOrEqual(MIN_GAP);
      for (let i = 1; i < at.length; i++) {
        expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(MIN_GAP);
        expect(at[i] - at[i - 1]).toBeLessThanOrEqual(MAX_GAP);
      }
    }
  });

  it('is random per person but the same every time for that person', () => {
    expect(encouragementEntries('demo', 200)).toEqual(encouragementEntries('demo', 200));
    // Control: two people get different sequences, so it is not a fixed schedule.
    expect(encouragementEntries('demo', 200)).not.toEqual(encouragementEntries('another-person', 200));
  });

  it('matches the sequence entry by entry, and never on entries 1 to 4', () => {
    const at = new Set(encouragementEntries('demo', 60));
    for (let n = 1; n <= 60; n++) expect(isEncouragementEntry('demo', n)).toBe(at.has(n));
    for (let n = 1; n < MIN_GAP; n++) expect(isEncouragementEntry('demo', n)).toBe(false);
  });

  it('picks a line from the shared list, stable for the same entry', () => {
    const line = encouragementLine('demo', 12);
    expect(ENCOURAGEMENTS).toContain(line);
    expect(encouragementLine('demo', 12)).toBe(line);
  });
});

describe('two-week celebration', () => {
  it('happens on every 14th entry and not the one before (control)', () => {
    expect(isCelebrationEntry(CELEBRATE_EVERY)).toBe(true);
    expect(isCelebrationEntry(28)).toBe(true);
    expect(isCelebrationEntry(13)).toBe(false);
    expect(isCelebrationEntry(0)).toBe(false);
    expect(celebrationText(14)).toBe('14 days of showing up for yourself.');
  });
});

describe('every 5th completed day', () => {
  it('numbers days in date order, with gaps allowed, and marks the 5th and 10th', () => {
    const dates = ['2026-09-01', '2026-09-03', '2026-09-04', '2026-09-10', '2026-09-11', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-24', '2026-09-26'];
    const n = dayNumbers([...dates].reverse()); // order of input does not matter
    expect(n.get('2026-09-11')).toBe(5);
    expect(n.get('2026-09-26')).toBe(10);
    const marked = dates.filter((d) => isMarkedDay(n.get(d)));
    expect(marked).toEqual(['2026-09-11', '2026-09-26']);
    // Control: unlogged days have no number and are never marked.
    expect(isMarkedDay(n.get('2026-09-02'))).toBe(false);
  });
});
