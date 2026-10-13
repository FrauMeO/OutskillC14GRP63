// Care sharing v2 (docs/care-sharing-v2-contract.md): levels, pause, the owner's preview, the
// 90-day check, the access summary and the "Shared with" line. Pure logic only.
//
// The database decides what a supporter really gets. The preview below applies the SAME rules to
// the owner's own entries so they can see it first. Everything uses the local calendar through
// YYYY-MM-DD strings, never UTC. A day with nothing logged is a gap: no function here returns,
// counts or names a missed day.
import { CATEGORY_FIELDS, addDays, num } from './dashboard';
import { PILLARS } from './pillars';
import {
  flagsOf,
  pillarSummary,
  sharedPillarNames,
  type CareShareRow,
  type PillarFlags,
  type ShareLevel,
  type SharedDay,
} from './careShares';

// ---------- Levels ----------

export const SHARE_LEVELS: { value: ShareLevel; label: string; hint: string }[] = [
  { value: 'presence', label: 'Just that I logged today', hint: 'They see which days you logged, nothing else.' },
  { value: 'summary', label: 'A weekly summary in words, no numbers', hint: 'For example “Sleep: about the usual for you”.' },
  { value: 'detail', label: 'Day-by-day detail for the pillars I tick', hint: 'They see the values you logged for the pillars you tick.' },
];

export function isLevel(x: unknown): x is ShareLevel {
  return x === 'presence' || x === 'summary' || x === 'detail';
}

/** Rows from before migration 0015 have no level and behave as detail, as the database did then. */
export function levelOf(row: { level?: string | null }): ShareLevel {
  return isLevel(row.level) ? row.level : 'detail';
}

export function isPaused(row: { paused_at?: string | null }): boolean {
  return row.paused_at != null;
}

/** What a supporter is told they would see, in words that match the level. */
export function viewerLevelText(level: ShareLevel, flags: PillarFlags): string {
  const pillars = pillarSummary(flags);
  if (level === 'presence') return `which days they logged ${pillars}, and nothing else`;
  if (level === 'summary') return `a weekly summary in words for ${pillars}, with no numbers`;
  return `their day-by-day ${pillars}`;
}

// ---------- Calm handling of features the database does not have yet ----------

export const NOT_AVAILABLE_YET = 'This is not available yet.';
export const GENERIC_PROBLEM = 'Something went wrong. Please try again in a moment.';

type ErrLike = { code?: string | null; message?: string | null } | null | undefined;

/** True when the call failed because the function, table or column does not exist (yet). */
export function isMissingFeature(err: ErrLike): boolean {
  if (!err) return false;
  const code = err.code ?? '';
  if (['PGRST202', 'PGRST205', '42883', '42P01', '42703'].includes(code)) return true;
  return /could not find the (function|table)|schema cache|function [^ ]+ does not exist|relation [^ ]+ does not exist/i.test(err.message ?? '');
}

/** The sentence to show for a failed call: calm for a missing feature, the plain database message otherwise. */
export function friendlyError(err: ErrLike): string {
  if (isMissingFeature(err)) return NOT_AVAILABLE_YET;
  const m = (err?.message ?? '').trim();
  return m || GENERIC_PROBLEM;
}

// ---------- Weekly summary in words (same rules as shared_week_summary) ----------

export type Trend = 'about_usual' | 'a_little_lower' | 'a_little_higher' | 'not_enough_days';
export type PillarKey = keyof PillarFlags;
export type PillarWeek = { pillar: PillarKey; days_logged: number; trend: Trend };

export const MIN_THIS_WEEK_DAYS = 4;
export const MIN_BASELINE_DAYS = 10;
export const BASELINE_DAYS = 56; // the 8 weeks before this week
export const TREND_BAND = 0.1; // more than 10% of the baseline mean counts as lower or higher
/** How many days of the owner's own entries the preview needs: this week plus the baseline. */
export const PREVIEW_DAYS = 7 + BASELINE_DAYS;

const PILLAR_KEYS: PillarKey[] = ['eat', 'sleep', 'move', 'balance'];
const CATEGORY_OF: Record<PillarKey, keyof typeof CATEGORY_FIELDS> = { eat: 'nutrition', sleep: 'sleep', move: 'exercise', balance: 'wellbeing' };

export function pillarName(p: PillarKey): string {
  return PILLARS[CATEGORY_OF[p]].name;
}

type OwnRow = Record<string, unknown> & { log_date: string };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Compare this week's values with the person's own earlier weeks. Needs at least 4 values this
 * week and 10 in the baseline; a difference of more than 10% of the baseline mean is lower/higher.
 */
export function trendFor(thisWeek: number[], baseline: number[]): Trend {
  if (thisWeek.length < MIN_THIS_WEEK_DAYS || baseline.length < MIN_BASELINE_DAYS) return 'not_enough_days';
  const base = mean(baseline);
  const diff = mean(thisWeek) - base;
  const band = Math.abs(base) * TREND_BAND;
  const eps = 1e-9; // exactly 10% is still "about usual", whatever the float rounding says
  if (diff > band + eps) return 'a_little_higher';
  if (diff < -(band + eps)) return 'a_little_lower';
  return 'about_usual';
}

const MEASURE: Record<Exclude<PillarKey, 'move'>, string> = { eat: 'water_liters', sleep: 'sleep_hours', balance: 'mood' };

/** The one measure a pillar's trend is about. Move uses steps when there are any, else exercise minutes. */
export function mainMeasure(pillar: PillarKey, rows: OwnRow[], todayIso: string): string {
  if (pillar !== 'move') return MEASURE[pillar];
  const from = addDays(todayIso, -(PREVIEW_DAYS - 1));
  const hasSteps = rows.some((r) => r.log_date >= from && r.log_date <= todayIso && num(r, 'steps') !== null);
  return hasSteps ? 'steps' : 'exercise_minutes';
}

function valuesBetween(rows: OwnRow[], field: string, fromIso: string, toIso: string): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (r.log_date < fromIso || r.log_date > toIso) continue;
    const v = num(r, field);
    if (v !== null) out.push(v);
  }
  return out;
}

/** The server's shared_week_summary, computed from the owner's own entries. Raw numbers never leave this. */
export function previewWeekSummary(rows: OwnRow[], flags: PillarFlags, todayIso: string): PillarWeek[] {
  const weekFrom = addDays(todayIso, -6);
  const baseTo = addDays(todayIso, -7);
  const baseFrom = addDays(todayIso, -(7 + BASELINE_DAYS));
  return PILLAR_KEYS.filter((k) => flags[k]).map((pillar) => {
    const fields = CATEGORY_FIELDS[CATEGORY_OF[pillar]];
    const daysLogged = new Set(rows.filter((r) => r.log_date >= weekFrom && r.log_date <= todayIso && fields.some((f) => num(r, f) !== null)).map((r) => r.log_date)).size;
    const field = mainMeasure(pillar, rows, todayIso);
    const trend = trendFor(valuesBetween(rows, field, weekFrom, todayIso), valuesBetween(rows, field, baseFrom, baseTo));
    return { pillar, days_logged: daysLogged, trend };
  });
}

/** Words for a trend. `who` is a name or "them"/"you". Never a number, never a judgement. */
export function trendWords(trend: Trend, who: string): string {
  if (trend === 'about_usual') return `about the usual for ${who}`;
  if (trend === 'a_little_lower') return `a little lower than usual for ${who}`;
  if (trend === 'a_little_higher') return `a little higher than usual for ${who}`;
  return 'not enough days yet to say';
}

/** 'Sleep: about the usual for Anna'. */
export function pillarWeekLine(w: PillarWeek, who: string): string {
  return `${pillarName(w.pillar)}: ${trendWords(w.trend, who)}`;
}

export function isTrend(x: unknown): x is Trend {
  return x === 'about_usual' || x === 'a_little_lower' || x === 'a_little_higher' || x === 'not_enough_days';
}

/** Rows from shared_week_summary, kept in pillar order, with anything unexpected dropped. */
export function cleanWeekRows(rows: { pillar: string; days_logged: number; trend: string }[]): PillarWeek[] {
  const out: PillarWeek[] = [];
  for (const k of PILLAR_KEYS) {
    const r = rows.find((x) => x.pillar === k);
    if (r) out.push({ pillar: k, days_logged: Number(r.days_logged) || 0, trend: isTrend(r.trend) ? r.trend : 'not_enough_days' });
  }
  return out;
}

// ---------- The preview for the owner (same rules as shared_days) ----------

const ALL_VALUE_FIELDS = Object.values(CATEGORY_FIELDS).flat();

/** Fields a pillar selection allows. */
function allowedFields(flags: PillarFlags): string[] {
  return PILLAR_KEYS.filter((k) => flags[k]).flatMap((k) => CATEGORY_FIELDS[CATEGORY_OF[k]]);
}

/**
 * What shared_days would return for the last 28 days: one row per day with something logged in a
 * ticked pillar. Presence and summary rows have every value null; detail rows carry the values of
 * the ticked pillars only. Paused shares return nothing.
 */
export function previewSharedDays(rows: OwnRow[], flags: PillarFlags, level: ShareLevel, todayIso: string, paused = false): SharedDay[] {
  if (paused) return [];
  const from = addDays(todayIso, -27);
  const allowed = allowedFields(flags);
  const out: SharedDay[] = [];
  for (const r of [...rows].sort((a, b) => a.log_date.localeCompare(b.log_date))) {
    if (r.log_date < from || r.log_date > todayIso) continue;
    if (!allowed.some((f) => num(r, f) !== null)) continue;
    const day: Record<string, unknown> = { log_date: r.log_date };
    for (const f of ALL_VALUE_FIELDS) day[f] = level === 'detail' && allowed.includes(f) ? num(r, f) : null;
    out.push(day as unknown as SharedDay);
  }
  return out;
}

// ---------- Presence view: "Logged on N of the last 7 days" ----------

export type PresenceWeek = { start: string; end: string; daysLogged: number; fullWeek: boolean };
export type PresenceSummary = { last7: number; weeks: PresenceWeek[]; weeksInRow: number };

export const FULL_WEEK = 4; // any four days in seven

/** Count days that have a row, whatever its values. A day without a row is simply not counted. */
export function presenceSummary(rows: { log_date: string }[], todayIso: string, weeksShown = 4): PresenceSummary {
  const logged = new Set(rows.map((r) => r.log_date));
  const weeks: PresenceWeek[] = [];
  for (let k = weeksShown - 1; k >= 0; k--) {
    const end = addDays(todayIso, -7 * k);
    const start = addDays(end, -6);
    let n = 0;
    for (let i = 0; i < 7; i++) if (logged.has(addDays(start, i))) n++;
    weeks.push({ start, end, daysLogged: n, fullWeek: n >= FULL_WEEK });
  }
  const latest = weeks[weeks.length - 1];
  // A week still in progress never breaks the run, as on the Dashboard.
  let i = latest.fullWeek ? weeks.length - 1 : weeks.length - 2;
  let weeksInRow = 0;
  while (i >= 0 && weeks[i].fullWeek) {
    weeksInRow++;
    i--;
  }
  return { last7: latest.daysLogged, weeks, weeksInRow };
}

/** 'Logged on 5 of the last 7 days.' Calm for zero too; never lists the days that were not logged. */
export function presenceText(last7: number): string {
  if (last7 === 0) return 'Days off for the last 7 days. That is fine: rest is part of the rhythm.';
  return `Logged on ${last7} of the last 7 days.`;
}

// ---------- The 90-day check ----------

export const CONFIRM_AFTER_DAYS = 90;

/** Whole calendar days from a to b (YYYY-MM-DD). Pure calendar arithmetic. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when an active share was last confirmed MORE than 90 local days ago. Missing or bad dates ask nothing. */
export function needsReconfirm(share: Pick<CareShareRow, 'status' | 'last_confirmed_at'>, now: Date): boolean {
  if (share.status !== 'active' || !share.last_confirmed_at) return false;
  const then = new Date(share.last_confirmed_at);
  if (Number.isNaN(then.getTime())) return false;
  return daysBetween(localIso(then), localIso(now)) > CONFIRM_AFTER_DAYS;
}

export function reconfirmQuestion(who: string): string {
  return `Are you still happy sharing with ${who}?`;
}

// ---------- Access summary ("looked on 3 days this month") ----------

export type ShareViewRow = { share_id: string; viewed_on: string; views?: number };

/** Distinct days this calendar month on which the supporter looked. Only dates, never times. */
export function viewDaysThisMonth(views: ShareViewRow[], shareId: string, todayIso: string): number {
  const month = todayIso.slice(0, 7);
  return new Set(views.filter((v) => v.share_id === shareId && v.viewed_on.slice(0, 7) === month && v.viewed_on <= todayIso).map((v) => v.viewed_on)).size;
}

export function accessText(who: string, days: number): string {
  if (days <= 0) return `${who} has not looked this month.`;
  return `${who} looked on ${days} ${days === 1 ? 'day' : 'days'} this month.`;
}

// ---------- The "Shared with" line on the Dashboard ----------

type LineShare = Pick<CareShareRow, 'viewer_email' | 'status' | 'share_eat' | 'share_sleep' | 'share_move' | 'share_balance'> & { paused_at?: string | null };

/**
 * 'Shared with: Anna (Sleep, Move), paused: Ben, invited: Cy'. Returns null when there are no open
 * shares (ended ones never count). Names are the email addresses the owner typed.
 */
export function sharingLine(shares: LineShare[]): string | null {
  const open = shares.filter((s) => s.status !== 'revoked');
  if (open.length === 0) return null;
  const active = open.filter((s) => s.status === 'active' && !isPaused(s));
  const paused = open.filter((s) => s.status === 'active' && isPaused(s));
  const invited = open.filter((s) => s.status === 'pending');
  const parts: string[] = [];
  if (active.length > 0) {
    parts.push(
      'Shared with: ' + active.map((s) => `${s.viewer_email} (${sharedPillarNames(flagsOf(s)).join(', ') || 'no pillars'})`).join(', '),
    );
  }
  if (paused.length > 0) parts.push((parts.length ? 'paused: ' : 'Paused: ') + paused.map((s) => s.viewer_email).join(', '));
  if (invited.length > 0) parts.push((parts.length ? 'invited: ' : 'Invited: ') + invited.map((s) => s.viewer_email).join(', '));
  return parts.join(', ');
}
