import { describe, expect, it } from 'vitest';
import { chartScale, niceStep, segments } from './chartScale';

describe('chartScale', () => {
  it('starts at 0 and ends at a round number above the data and the goal', () => {
    const s = chartScale([1200, 800, null, 1900], 2000, undefined, true);
    expect(s.min).toBe(0);
    expect(s.max).toBe(2000);
    expect(s.ticks).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it('the goal can be the highest point', () => {
    expect(chartScale([1, 2], 8, undefined, true).max).toBeGreaterThanOrEqual(8);
  });

  it('uses whole-number ticks for whole-number metrics (control)', () => {
    const s = chartScale([1, 2, 1], null, undefined, true);
    expect(s.ticks.every(Number.isInteger)).toBe(true);
  });

  it('allows decimal ticks for decimal metrics', () => {
    const s = chartScale([0.5, 1.2], 2, undefined, false);
    expect(s.max).toBe(2);
    expect(s.ticks).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it('a fixed domain (ratings 1 to 5) gives ticks 1..5', () => {
    expect(chartScale([3, null], null, [1, 5], true)).toEqual({ min: 1, max: 5, ticks: [1, 2, 3, 4, 5] });
  });

  it('no data at all still gives a usable axis', () => {
    const s = chartScale([null, null], null, undefined, true);
    expect(s.max).toBeGreaterThan(0);
    expect(s.ticks.length).toBeGreaterThan(1);
  });
});

describe('niceStep', () => {
  it('picks round steps', () => {
    expect(niceStep(2000)).toBe(500);
    expect(niceStep(10)).toBe(2.5);
    expect(niceStep(7.5, 4, true)).toBe(2);
  });
});

describe('segments', () => {
  it('a missing day is a gap, not a zero', () => {
    expect(segments([1, 2, null, 4, null, null, 7]).map((r) => r.map((p) => p.index))).toEqual([[0, 1], [3], [6]]);
  });
  it('control: no gaps gives one run', () => {
    expect(segments([1, 2, 3])).toHaveLength(1);
  });
  it('a zero value is kept (logged zero is not missing)', () => {
    expect(segments([0, null, 0])[0][0].value).toBe(0);
  });
});
