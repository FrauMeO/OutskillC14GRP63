import { describe, expect, it } from 'vitest';
import {
  CONFIRM_AFTER_DAYS,
  NOT_AVAILABLE_YET,
  accessText,
  cleanWeekRows,
  daysBetween,
  friendlyError,
  isMissingFeature,
  levelOf,
  mainMeasure,
  needsReconfirm,
  pillarWeekLine,
  presenceSummary,
  presenceText,
  previewSharedDays,
  previewWeekSummary,
  sharingLine,
  trendFor,
  trendWords,
  viewDaysThisMonth,
  viewerLevelText,
} from './careShareLevels';
import { addDays } from './dashboard';
import type { PillarFlags } from './careShares';

const today = '2026-10-12';
const flags = (eat: boolean, sleep: boolean, move: boolean, balance: boolean): PillarFlags => ({ eat, sleep, move, balance });
const ALL = flags(true, true, true, true);
const row = (offset: number, extra: Record<string, unknown> = {}) => ({ log_date: addDays(today, -offset), ...extra });

describe('levels', () => {
  it('rows without a level behave as detail (before migration 0015); explicit levels win', () => {
    expect(levelOf({})).toBe('detail');
    expect(levelOf({ level: null })).toBe('detail');
    expect(levelOf({ level: 'presence' })).toBe('presence');
    expect(levelOf({ level: 'summary' })).toBe('summary');
    // control: junk is never trusted as a level
    expect(levelOf({ level: 'everything' })).toBe('detail');
    expect(levelOf({ level: 'presence' })).not.toBe('detail');
  });
  it('tells a supporter only what their level shows', () => {
    expect(viewerLevelText('presence', flags(false, true, false, false))).toContain('which days they logged');
    expect(viewerLevelText('summary', flags(false, true, false, false))).toContain('no numbers');
    expect(viewerLevelText('detail', flags(false, true, false, false))).toContain('day-by-day');
    expect(viewerLevelText('presence', flags(false, true, false, false))).not.toContain('day-by-day');
  });
});

describe('missing database features are calm', () => {
  it('recognises a missing function or table', () => {
    expect(isMissingFeature({ code: 'PGRST202', message: 'x' })).toBe(true);
    expect(isMissingFeature({ code: 'PGRST205', message: 'x' })).toBe(true);
    expect(isMissingFeature({ message: 'Could not find the function public.set_care_share_options in the schema cache' })).toBe(true);
    expect(isMissingFeature({ code: '42883', message: 'function foo() does not exist' })).toBe(true);
    // controls: real rules and no error are not "missing"
    expect(isMissingFeature({ message: 'You can share with at most 5 people.' })).toBe(false);
    expect(isMissingFeature(null)).toBe(false);
  });
  it('says "not available yet" for those, and the plain message for the rest', () => {
    expect(friendlyError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(NOT_AVAILABLE_YET);
    expect(friendlyError({ message: 'You can share with at most 5 people.' })).toBe('You can share with at most 5 people.');
    expect(friendlyError({ message: '' })).toMatch(/try again/);
    expect(friendlyError({ message: 'You can share with at most 5 people.' })).not.toBe(NOT_AVAILABLE_YET);
  });
});

describe('trend words (thresholds mirror shared_week_summary)', () => {
  const week = (v: number, n = 4) => Array(n).fill(v);
  it('needs 4 days this week and 10 in the baseline', () => {
    expect(trendFor(week(8, 4), week(8, 10))).toBe('about_usual');
    expect(trendFor(week(8, 3), week(8, 10))).toBe('not_enough_days');
    expect(trendFor(week(8, 4), week(8, 9))).toBe('not_enough_days');
    // control: a big change with too few days is still "not enough", never a trend
    expect(trendFor(week(2, 3), week(8, 20))).toBe('not_enough_days');
    expect(trendFor(week(2, 3), week(8, 20))).not.toBe('a_little_lower');
  });
  it('uses plus or minus 10% of the baseline mean, and exactly 10% is still usual', () => {
    expect(trendFor(week(8.9), week(8, 12))).toBe('a_little_higher'); // +11.25%
    expect(trendFor(week(7.1), week(8, 12))).toBe('a_little_lower'); // -11.25%
    expect(trendFor(week(8.5), week(8, 12))).toBe('about_usual'); // +6.25%
    expect(trendFor(week(8.8), week(8, 12))).toBe('about_usual'); // exactly +10%
    expect(trendFor(week(7.2), week(8, 12))).toBe('about_usual'); // exactly -10%
    expect(trendFor(week(7.7), week(7, 12))).toBe('about_usual'); // float trap: 0.1 * 7
    expect(trendFor(week(8.5), week(8, 12))).not.toBe('a_little_higher');
  });
  it('never uses numbers, blame or alarm in the words', () => {
    for (const t of ['about_usual', 'a_little_lower', 'a_little_higher', 'not_enough_days'] as const) {
      const w = trendWords(t, 'Anna');
      expect(w).not.toMatch(/\d|%|bad|worse|poor|missed|below|alert|concern/i);
    }
    expect(trendWords('about_usual', 'Anna')).toBe('about the usual for Anna');
    expect(pillarWeekLine({ pillar: 'sleep', days_logged: 5, trend: 'about_usual' }, 'Anna')).toBe('Sleep: about the usual for Anna');
    expect(pillarWeekLine({ pillar: 'sleep', days_logged: 5, trend: 'a_little_lower' }, 'Anna')).not.toContain('about the usual');
  });
});

describe('preview of the weekly summary', () => {
  // 12 baseline days of 8h sleep (days 8..19 back) plus this week's days.
  const baseline = Array.from({ length: 12 }, (_, i) => row(8 + i, { sleep_hours: 8 }));
  const thisWeek = (v: number, n = 4) => Array.from({ length: n }, (_, i) => row(i, { sleep_hours: v }));
  const sleepOnly = flags(false, true, false, false);

  it('says about the usual when this week matches the baseline', () => {
    const out = previewWeekSummary([...baseline, ...thisWeek(8)], sleepOnly, today);
    expect(out).toEqual([{ pillar: 'sleep', days_logged: 4, trend: 'about_usual' }]);
  });
  it('says lower or higher past the band, and control cases differ', () => {
    expect(previewWeekSummary([...baseline, ...thisWeek(6)], sleepOnly, today)[0].trend).toBe('a_little_lower');
    expect(previewWeekSummary([...baseline, ...thisWeek(10)], sleepOnly, today)[0].trend).toBe('a_little_higher');
    expect(previewWeekSummary([...baseline, ...thisWeek(10)], sleepOnly, today)[0].trend).not.toBe('a_little_lower');
  });
  it('is not enough days without 4 this week or 10 in the baseline', () => {
    expect(previewWeekSummary([...baseline, ...thisWeek(6, 3)], sleepOnly, today)[0].trend).toBe('not_enough_days');
    expect(previewWeekSummary([...baseline.slice(0, 9), ...thisWeek(6)], sleepOnly, today)[0].trend).toBe('not_enough_days');
  });
  it('ignores baseline older than 8 weeks and anything after today', () => {
    const old = Array.from({ length: 12 }, (_, i) => row(70 + i, { sleep_hours: 8 })); // 10+ weeks back
    expect(previewWeekSummary([...old, ...thisWeek(8)], sleepOnly, today)[0].trend).toBe('not_enough_days');
    expect(previewWeekSummary([...baseline, ...thisWeek(8), row(-1, { sleep_hours: 1 })], sleepOnly, today)[0].days_logged).toBe(4);
  });
  it('returns only the ticked pillars, in order, and counts a pillar day when anything in it was logged', () => {
    const rows = [row(0, { mood: 3 }), row(1, { energy: 4 }), row(2, { sleep_hours: 7 })];
    const out = previewWeekSummary(rows, flags(false, true, false, true), today);
    expect(out.map((o) => o.pillar)).toEqual(['sleep', 'balance']);
    expect(out[1].days_logged).toBe(2);
    expect(previewWeekSummary(rows, flags(false, false, false, false), today)).toEqual([]);
  });
  it('move uses steps when there are any, else exercise minutes', () => {
    expect(mainMeasure('move', [row(0, { steps: 4000 })], today)).toBe('steps');
    expect(mainMeasure('move', [row(0, { exercise_minutes: 30 })], today)).toBe('exercise_minutes');
    expect(mainMeasure('eat', [], today)).toBe('water_liters');
    expect(mainMeasure('balance', [], today)).toBe('mood');
    const base = Array.from({ length: 12 }, (_, i) => row(8 + i, { exercise_minutes: 30 }));
    const wk = Array.from({ length: 4 }, (_, i) => row(i, { exercise_minutes: 10 }));
    expect(previewWeekSummary([...base, ...wk], flags(false, false, true, false), today)[0].trend).toBe('a_little_lower');
  });
  it('cleans server rows into pillar order and drops anything unexpected', () => {
    const out = cleanWeekRows([
      { pillar: 'move', days_logged: 3, trend: 'about_usual' },
      { pillar: 'notes', days_logged: 9, trend: 'about_usual' },
      { pillar: 'eat', days_logged: 2, trend: 'surprising' },
    ]);
    expect(out.map((o) => o.pillar)).toEqual(['eat', 'move']);
    expect(out[0].trend).toBe('not_enough_days');
  });
});

describe('preview of what shared_days returns', () => {
  const rows = [
    row(0, { sleep_hours: 7, steps: 5000, mood: 4, water_liters: 2 }),
    row(1, { mood: 3 }),
    row(2, { steps: 100 }),
    row(40, { sleep_hours: 7 }), // outside 28 days
  ];
  it('presence: one row per day with something shared logged, every value null', () => {
    const out = previewSharedDays(rows, flags(false, true, false, true), 'presence', today);
    expect(out.map((d) => d.log_date)).toEqual([addDays(today, -1), today]);
    for (const d of out) expect([d.sleep_hours, d.steps, d.mood, d.water_liters].every((v) => v === null)).toBe(true);
  });
  it('summary rows are the same as presence rows', () => {
    const f = flags(false, true, false, true);
    expect(previewSharedDays(rows, f, 'summary', today)).toEqual(previewSharedDays(rows, f, 'presence', today));
  });
  it('detail: values for ticked pillars only', () => {
    const out = previewSharedDays(rows, flags(false, true, false, false), 'detail', today);
    expect(out).toHaveLength(1);
    expect(out[0].sleep_hours).toBe(7);
    // controls: unticked pillars never leak
    expect(out[0].steps).toBeNull();
    expect(out[0].mood).toBeNull();
    expect(out[0].water_liters).toBeNull();
  });
  it('paused shares show nothing; days without a ticked pillar logged are not rows', () => {
    expect(previewSharedDays(rows, ALL, 'detail', today, true)).toEqual([]);
    expect(previewSharedDays(rows, flags(true, false, false, false), 'detail', today).map((d) => d.log_date)).toEqual([today]);
  });
});

describe('presence view', () => {
  it('counts days with a row, whatever the values', () => {
    const rows = [row(0), row(1), row(3), row(6), row(7)];
    const p = presenceSummary(rows, today);
    expect(p.last7).toBe(4);
    expect(presenceText(p.last7)).toBe('Logged on 4 of the last 7 days.');
    // control: the row 7 days back belongs to the week before
    expect(p.weeks[2].daysLogged).toBe(1);
  });
  it('zero is calm and never lists or names missed days', () => {
    const text = presenceText(0);
    expect(text).toMatch(/fine/);
    expect(text).not.toMatch(/miss|skipp|no entry|lost|streak/i);
    expect(presenceText(1)).toBe('Logged on 1 of the last 7 days.');
  });
  it('a week in progress never breaks the run of full weeks', () => {
    const full = (end: number) => [0, 1, 2, 3].map((i) => row(end + i));
    const rows = [...full(7), ...full(14)]; // two full weeks before a quiet current week
    expect(presenceSummary(rows, today).weeksInRow).toBe(2);
    expect(presenceSummary([...full(0), ...full(7)], today).weeksInRow).toBe(2);
    expect(presenceSummary([], today).weeksInRow).toBe(0);
  });
});

describe('the 90-day check', () => {
  const now = new Date(2026, 9, 12, 15, 0); // 12 Oct 2026, local
  const confirmed = (daysAgo: number, hour = 9) => new Date(2026, 9, 12 - daysAgo, hour, 0).toISOString();
  it('asks only after MORE than 90 days', () => {
    expect(CONFIRM_AFTER_DAYS).toBe(90);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(91) }, now)).toBe(true);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(90) }, now)).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(89) }, now)).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(300) }, now)).toBe(true);
  });
  it('counts local calendar days, so the hour of day does not matter', () => {
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(90, 0) }, new Date(2026, 9, 12, 23, 59))).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: confirmed(91, 23) }, new Date(2026, 9, 12, 0, 1))).toBe(true);
  });
  it('does not ask for pending or ended shares, or when the date is missing or bad', () => {
    expect(needsReconfirm({ status: 'pending', last_confirmed_at: confirmed(200) }, now)).toBe(false);
    expect(needsReconfirm({ status: 'revoked', last_confirmed_at: confirmed(200) }, now)).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: null }, now)).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: undefined }, now)).toBe(false);
    expect(needsReconfirm({ status: 'active', last_confirmed_at: 'not a date' }, now)).toBe(false);
  });
  it('daysBetween is plain calendar arithmetic across month and year ends', () => {
    expect(daysBetween('2026-10-12', '2026-10-12')).toBe(0);
    expect(daysBetween('2026-07-14', '2026-10-12')).toBe(90);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-10-12', '2026-10-11')).toBe(-1);
  });
});

describe('access summary', () => {
  const views = [
    { share_id: 'a', viewed_on: '2026-10-01', views: 3 },
    { share_id: 'a', viewed_on: '2026-10-05' },
    { share_id: 'a', viewed_on: '2026-10-05' }, // same day twice counts once
    { share_id: 'a', viewed_on: '2026-09-30' }, // last month
    { share_id: 'b', viewed_on: '2026-10-02' }, // someone else's share
    { share_id: 'a', viewed_on: '2026-10-20' }, // not yet happened
  ];
  it('counts distinct days this month for this share', () => {
    expect(viewDaysThisMonth(views, 'a', today)).toBe(2);
    expect(viewDaysThisMonth(views, 'b', today)).toBe(1);
    expect(viewDaysThisMonth(views, 'c', today)).toBe(0);
  });
  it('says it in plain words, with dates only', () => {
    expect(accessText('Anna', 3)).toBe('Anna looked on 3 days this month.');
    expect(accessText('Anna', 1)).toBe('Anna looked on 1 day this month.');
    expect(accessText('Anna', 0)).toBe('Anna has not looked this month.');
    expect(accessText('Anna', 3)).not.toMatch(/\d\d:\d\d|views|times/);
    expect(accessText('Anna', 0)).not.toContain('looked on');
  });
});

describe('the Shared with line', () => {
  const s = (viewer_email: string, status: 'pending' | 'active' | 'revoked', f: PillarFlags, paused_at: string | null = null) => ({
    viewer_email,
    status,
    share_eat: f.eat,
    share_sleep: f.sleep,
    share_move: f.move,
    share_balance: f.balance,
    paused_at,
  });
  it('lists active shares with their pillars and paused ones after', () => {
    const line = sharingLine([
      s('anna@x.ca', 'active', flags(false, true, true, false)),
      s('ben@x.ca', 'active', flags(true, false, false, false), '2026-10-01T00:00:00Z'),
    ]);
    expect(line).toBe('Shared with: anna@x.ca (Sleep, Move), paused: ben@x.ca');
  });
  it('is null with no open shares, and ended shares never appear', () => {
    expect(sharingLine([])).toBeNull();
    expect(sharingLine([s('old@x.ca', 'revoked', ALL)])).toBeNull();
    expect(sharingLine([s('old@x.ca', 'revoked', ALL), s('anna@x.ca', 'active', ALL)])).not.toContain('old@x.ca');
  });
  it('handles only paused, and invitations waiting', () => {
    expect(sharingLine([s('ben@x.ca', 'active', ALL, '2026-10-01T00:00:00Z')])).toBe('Paused: ben@x.ca');
    expect(sharingLine([s('cy@x.ca', 'pending', ALL)])).toBe('Invited: cy@x.ca');
    expect(sharingLine([s('anna@x.ca', 'active', ALL), s('cy@x.ca', 'pending', ALL)])).toBe(
      'Shared with: anna@x.ca (Drink, Sleep, Move, Balance), invited: cy@x.ca',
    );
  });
  it('a paused person is not listed as shared with', () => {
    const line = sharingLine([s('ben@x.ca', 'active', ALL, '2026-10-01T00:00:00Z'), s('anna@x.ca', 'active', ALL)])!;
    expect(line.split('paused:')[0]).not.toContain('ben@x.ca');
  });
});
