import { describe, expect, it } from 'vitest';
import { hardDayResources, needsSupportLines } from './hardDayResources';

describe('crisis lines under the hard-day message', () => {
  it('a known country gets its national line and its emergency number', () => {
    const us = hardDayResources('US');
    expect(us.map((r) => r.key)).toEqual(['us-988', 'us-911']);
    expect(hardDayResources('de')[0].tel).toBe('08001110111');
  });
  it('control: no country, or one we do not list, falls back to local emergency plus findahelpline.com', () => {
    for (const cc of [null, undefined, 'ZZ']) {
      const r = hardDayResources(cc);
      expect(r.map((x) => x.key)).toEqual(['local-emergency', 'findahelpline']);
      expect(r[1].href).toMatch(/^https:\/\/findahelpline\.com\//);
    }
  });
  it('only the hard-day and hard-week reasons ask for them', () => {
    expect(needsSupportLines('hard-day')).toBe(true);
    expect(needsSupportLines('hard-week')).toBe(true);
    for (const r of ['filtered', 'no-consent', 'implausible-input', '', null, undefined]) expect(needsSupportLines(r)).toBe(false);
  });
});
