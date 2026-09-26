import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOOTER,
  MESSAGES,
  OFFER_TEXT,
  PHQ9_ITEMS,
  checkinState,
  currentRun,
  phq2Score,
  phq9Score,
  resourcesFor,
  tierFor,
  type Answer,
  type DayRow,
} from './reflection';

const today = '2026-09-26';
const day = (i: number, harder: boolean): DayRow => ({
  log_date: `2026-09-${String(26 - i).padStart(2, '0')}`,
  mood: harder ? 2 : 4,
  stress: 2,
});
const days = (harderCount: number) => Array.from({ length: 14 }, (_, i) => day(i, i < harderCount));

describe('when the gentle check-in is offered', () => {
  it('needs more than 10 sequential days of check-ins: 11 in a row shows, 10 does not', () => {
    const run = (n: number) => Array.from({ length: n }, (_, i) => day(i, i < 7));
    expect(currentRun(run(11), today)).toBe(11);
    expect(checkinState({ enabled: true, days: run(11), offers: [], todayIso: today })).toMatchObject({ show: true });
    // Control: the same 7 harder days with only 10 sequential entries is not enough.
    expect(checkinState({ enabled: true, days: run(10), offers: [], todayIso: today })).toEqual({ show: false, reason: 'not-enough-entries' });
  });
  it('a gap breaks the run, even with many harder days', () => {
    const gappy = days(12).filter((_, i) => i !== 5); // missing one day, 5 days ago
    expect(currentRun(gappy, today)).toBe(5);
    expect(checkinState({ enabled: true, days: gappy, offers: [], todayIso: today })).toEqual({ show: false, reason: 'not-enough-entries' });
  });
  it('a day with only habits (no mood or stress) also breaks the run', () => {
    const noCheckin = days(12).map((d, i) => (i === 3 ? { ...d, mood: null, stress: null } : d));
    expect(currentRun(noCheckin, today)).toBe(3);
  });
  it('the run may end yesterday if today is not logged yet, but not earlier', () => {
    const fromYesterday = Array.from({ length: 11 }, (_, i) => day(i + 1, i < 7));
    expect(currentRun(fromYesterday, today)).toBe(11);
    const fromTwoDaysAgo = Array.from({ length: 11 }, (_, i) => day(i + 2, i < 7));
    expect(currentRun(fromTwoDaysAgo, today)).toBe(0);
  });

  it('shows at exactly 7 harder days out of the last 14', () => {
    expect(checkinState({ enabled: true, days: days(7), offers: [], todayIso: today })).toMatchObject({ show: true, harderDays: 7 });
  });
  it('control: does not show at 6', () => {
    expect(checkinState({ enabled: true, days: days(6), offers: [], todayIso: today })).toEqual({ show: false, reason: 'not-enough-harder-days' });
  });
  it('counts high stress as a harder day, and only the last 14 logged days', () => {
    const stressed = days(0).map((d, i) => (i < 7 ? { ...d, stress: 4 } : d));
    expect(checkinState({ enabled: true, days: stressed, offers: [], todayIso: today }).show).toBe(true);
    const old = [...days(6), { log_date: '2026-09-01', mood: 1, stress: 5 }]; // a 15th, older day
    expect(checkinState({ enabled: true, days: old, offers: [], todayIso: today }).show).toBe(false);
  });
  it('waits 14 days after any offer, taken or not', () => {
    const offered13 = [{ offered_on: '2026-09-13', taken_on: null }];
    const offered14 = [{ offered_on: '2026-09-12', taken_on: null }];
    expect(checkinState({ enabled: true, days: days(10), offers: offered13, todayIso: today })).toEqual({ show: false, reason: 'offered-recently' });
    expect(checkinState({ enabled: true, days: days(10), offers: offered14, todayIso: today }).show).toBe(true);
  });
  it("keeps showing today's untaken offer so the person can come back to it", () => {
    const offer = { offered_on: today, taken_on: null };
    expect(checkinState({ enabled: true, days: days(7), offers: [offer], todayIso: today })).toMatchObject({ show: true, offerToday: offer });
    expect(checkinState({ enabled: true, days: days(7), offers: [{ offered_on: today, taken_on: today }], todayIso: today }).show).toBe(false);
  });
  it('never shows when turned off', () => {
    expect(checkinState({ enabled: false, days: days(14), offers: [], todayIso: today })).toEqual({ show: false, reason: 'off' });
  });
});

describe('scores', () => {
  it('PHQ-2 at 2 does not lead further, at 3 it does', () => {
    expect(phq2Score([1, 1])).toBe(2);
    expect(phq2Score([2, 1])).toBe(3);
    expect(phq2Score([1, null])).toBeNull();
  });
  it('PHQ-9 needs all nine answers (never a partial set)', () => {
    expect(phq9Score(Array(9).fill(3) as Answer[])).toBe(27);
    expect(phq9Score([...Array(8).fill(1), null] as (Answer | null)[])).toBeNull();
    expect(phq9Score(Array(8).fill(1) as Answer[])).toBeNull();
    expect(PHQ9_ITEMS).toHaveLength(9);
  });
  it('tiers change exactly at 6/7, 10/11 and 15/16', () => {
    expect([6, 7, 10, 11, 15, 16].map(tierFor)).toEqual(['calm', 'gentle', 'gentle', 'support', 'support', 'urgent']);
  });
});

describe('resources by country', () => {
  const names = (cc: string | null, total: number, item9 = 0) => {
    const r = resourcesFor(cc, tierFor(total), item9);
    return { crisis: r.crisis.map((x) => x.key), tier: r.tier.map((x) => x.key) };
  };

  it('7 to 10: Find A Helpline on the person\'s country page', () => {
    expect(names('IN', 7).tier).toEqual(['findahelpline']);
    expect(resourcesFor('IN', 'gentle', 0).tier[0].href).toBe('https://findahelpline.com/countries/in');
  });
  it('11 to 15: the national line, a different resource from the 7 to 10 tier', () => {
    expect(names('US', 11).tier).toEqual(['us-988']);
    expect(names('DE', 15).tier).toEqual(['de-telefonseelsorge']);
    expect(names('AE', 11).tier).toEqual(['ae-800hope']);
    expect(names('IN', 11).tier).not.toEqual(names('IN', 10).tier);
  });
  it('16 or more: national line, Find A Helpline and emergency', () => {
    expect(names('CA', 16).tier).toEqual(['ca-988', 'findahelpline', 'ca-911']);
    expect(names('IN', 27).tier).toEqual(['in-telemanas', 'findahelpline', 'in-112']);
  });
  it('anywhere else falls back to Find A Helpline', () => {
    expect(names('FR', 12).tier).toEqual(['findahelpline']);
    expect(names(null, 16).tier).toEqual(['findahelpline', 'local-emergency']);
    expect(resourcesFor(null, 'gentle', 0).tier[0].href).toBe('https://findahelpline.com/');
  });
  it('item 9 above 0 shows crisis resources first, even with a low total', () => {
    expect(names('US', 3, 1)).toEqual({ crisis: ['us-988', 'us-911'], tier: [] });
    expect(names('DE', 12, 2)).toEqual({ crisis: ['de-telefonseelsorge', 'de-112'], tier: [] });
    // Control: the same low total without item 9 shows no crisis resources.
    expect(names('US', 3, 0).crisis).toEqual([]);
  });
  it('UAE item 9 leads with emergency numbers, because 800 HOPE closes at night', () => {
    expect(names('AE', 8, 1).crisis).toEqual(['ae-999', 'ae-800hope']);
  });
});

describe('words', () => {
  it('every tier from 7 up encourages talking with a friend, and the 11 to 15 line says confidential and without judgment', () => {
    for (const t of ['gentle', 'support', 'urgent'] as const) expect(MESSAGES[t]).toMatch(/friend/);
    expect(MESSAGES.gentle).toMatch(/harder/);
    expect(MESSAGES.gentle).not.toMatch(/heavier/);
    expect(MESSAGES.support).toMatch(/confidentially and without judgment/);
    expect(MESSAGES.urgent).toMatch(/doctor/);
    expect(FOOTER).toBe('This is encouragement to reflect a little more deeply today. It is not medical advice.');
  });
  it('never says "screening" anywhere a person can see it', () => {
    const shown = [...Object.values(MESSAGES), FOOTER, OFFER_TEXT].join(' ');
    expect(shown).not.toMatch(/screen/i);
    const dir = new URL('../pages/', import.meta.url);
    for (const f of readdirSync(dir)) {
      expect(readFileSync(new URL(f, dir), 'utf8'), f).not.toMatch(/screening/i);
    }
    // Control: the check does find the word when it is present.
    expect('A screening tool').toMatch(/screening/i);
  });
});
