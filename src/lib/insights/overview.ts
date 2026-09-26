// The top of the Insights page: how the last four weeks went, this week against the person's own
// usual, and one or two gentle invitations. Pure, so every rule is unit tested (overview.test.ts).
// Suggested by Michael (team feedback, 2026-09-26): a first-time user saw a mostly empty page.
//
// Principles (CLAUDE.md): personal, not comparative (the only comparison is with your own past);
// celebrate arrivals, never mark misses (days logged, never days missed); association, not cause;
// invitations, never advice ("if you like", never "should").
import { addDays, missingCategories, num, type Category } from '../dashboard';
import { PILLAR_ORDER, PILLARS } from '../pillars';
import type { Comparison, MeasureKey } from './engine';

type Row = Record<string, unknown> & { log_date: string };

export const OVERVIEW_DAYS = 28;
export const WEEK_DAYS = 7;
export const USUAL_DAYS = 56; // the eight weeks before this week
export const MIN_WEEK_VALUES = 3;
export const MIN_USUAL_VALUES = 5;

// ---------- The last four weeks ----------

export type Overview = { loggedDays: number; byPillar: { pillar: Category; name: string; days: number }[] };

export function lastFourWeeks(rows: Row[], todayIso: string): Overview {
  const from = addDays(todayIso, -(OVERVIEW_DAYS - 1));
  const recent = rows.filter((r) => r.log_date >= from && r.log_date <= todayIso);
  return {
    loggedDays: new Set(recent.map((r) => r.log_date)).size,
    byPillar: PILLAR_ORDER.map((pillar) => ({
      pillar,
      name: PILLARS[pillar].name,
      days: recent.filter((r) => !missingCategories(r).includes(pillar)).length,
    })),
  };
}

// ---------- This week against your usual ----------

type WeekMeasure = { key: MeasureKey; pillar: Category; label: string; unit: string; decimals: number; more: string; less: string; same: number };

// same: a difference smaller than this reads as "about your usual".
export const WEEK_MEASURES: WeekMeasure[] = [
  { key: 'water_liters', pillar: 'nutrition', label: 'Water', unit: ' liters', decimals: 1, more: 'more', less: 'less', same: 0.25 },
  { key: 'sleep_hours', pillar: 'sleep', label: 'Sleep', unit: ' hours', decimals: 1, more: 'more', less: 'less', same: 0.5 },
  { key: 'exercise_minutes', pillar: 'exercise', label: 'Exercise', unit: ' minutes', decimals: 0, more: 'more', less: 'less', same: 10 },
  { key: 'mood', pillar: 'wellbeing', label: 'Mood', unit: '', decimals: 1, more: 'higher', less: 'lower', same: 0.5 },
  { key: 'energy', pillar: 'wellbeing', label: 'Energy', unit: '', decimals: 1, more: 'higher', less: 'lower', same: 0.5 },
  { key: 'stress', pillar: 'wellbeing', label: 'Stress', unit: '', decimals: 1, more: 'higher', less: 'lower', same: 0.5 },
];

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type WeekLine = {
  key: MeasureKey;
  pillar: Category;
  label: string;
  direction: 'more' | 'less' | 'same';
  week: number;
  usual: number;
  sentence: string;
};

const fmt = (n: number, d: number) => {
  const s = n.toFixed(d);
  return d > 0 && s.endsWith('.0') ? s.slice(0, -2) : s;
};

export function weekVsUsual(rows: Row[], todayIso: string): WeekLine[] {
  const weekFrom = addDays(todayIso, -(WEEK_DAYS - 1));
  const usualFrom = addDays(weekFrom, -USUAL_DAYS);
  const lines: WeekLine[] = [];
  for (const m of WEEK_MEASURES) {
    const values = (from: string, to: string) =>
      rows.filter((r) => r.log_date >= from && r.log_date <= to).map((r) => num(r, m.key)).filter((v): v is number => v !== null);
    const weekValues = values(weekFrom, todayIso);
    const usualValues = values(usualFrom, addDays(weekFrom, -1));
    if (weekValues.length < MIN_WEEK_VALUES || usualValues.length < MIN_USUAL_VALUES) continue;
    const week = median(weekValues)!;
    const usual = median(usualValues)!;
    const diff = week - usual;
    const direction = Math.abs(diff) < m.same ? 'same' : diff > 0 ? 'more' : 'less';
    const w = `${fmt(week, m.decimals)}${m.unit}`;
    const u = `${fmt(usual, m.decimals)}${m.unit}`;
    const sentence =
      direction === 'same'
        ? `About your usual: ${w} this week.`
        : `${direction === 'more' ? capital(m.more) : capital(m.less)} than your usual: ${w} this week, usually ${u}.`;
    lines.push({ key: m.key, pillar: m.pillar, label: m.label, direction, week, usual, sentence });
  }
  return lines;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Gentle invitations ----------

// A small, optional thing to try for each measure. Never a target, never "should".
const IDEAS: Record<MeasureKey, string> = {
  mood: 'a short walk, a favourite song, or a message to a friend',
  energy: 'a glass of water, a little daylight, or a short stretch',
  stress: 'a few slow breaths or a short walk',
  sleep_hours: 'starting your wind-down a little earlier',
  exercise_minutes: 'a short walk or a stretch indoors',
  water_liters: 'keeping a glass of water within reach',
};

const LABELS: Record<MeasureKey, string> = {
  mood: 'mood',
  energy: 'energy',
  stress: 'stress',
  sleep_hours: 'sleep',
  exercise_minutes: 'movement',
  water_liters: 'water',
};

// What the harder side is called for each measure.
const HARDER: Record<MeasureKey, string> = {
  mood: 'a lower mood',
  energy: 'lower energy',
  stress: 'higher stress',
  sleep_hours: 'less sleep',
  exercise_minutes: 'less movement',
  water_liters: 'less water',
};

// For stress, the harder side is higher; for everything else, lower.
const higherIsHarder = (key: MeasureKey) => key === 'stress';
const plain = (s: string) => s.replace(/\s*\([^)]*\)/g, '');

// The situation in which this person's measure tended to be harder, in their own words-ready form.
export function harderSituation(c: Comparison): string {
  const measureHigherOnFirst = c.factor.kind === 'binary' ? c.highAvg > c.lowAvg : c.effect >= 0;
  const firstIsHarder = higherIsHarder(c.measure.key) ? measureHigherOnFirst : !measureHigherOnFirst;
  if (c.factor.kind === 'binary') return plain(firstIsHarder ? c.factor.yes : c.factor.no);
  return `days with ${plain(firstIsHarder ? c.factor.most : c.factor.least)}`;
}

export type Invitation = { key: MeasureKey; text: string; basedOn: 'pattern' | 'week' };

// Up to two invitations, one per measure: first from patterns in the person's own data (likely
// before early hints), then from this week against their usual. Nothing is invented.
export function invitations(patterns: Comparison[], week: WeekLine[], max = 2): Invitation[] {
  const out: Invitation[] = [];
  const used = new Set<MeasureKey>();
  for (const c of patterns) {
    if (out.length >= max) break;
    const key = c.measure.key;
    if (used.has(key)) continue;
    used.add(key);
    out.push({
      key,
      basedOn: 'pattern',
      text: `On ${harderSituation(c)}, you have tended to have ${HARDER[key]}. On the next few, if you like, try ${IDEAS[key]}, and notice how it feels.`,
    });
  }
  for (const w of week) {
    if (out.length >= max) break;
    if (used.has(w.key) || w.direction === 'same') continue;
    const harder = higherIsHarder(w.key) ? w.direction === 'more' : w.direction === 'less';
    if (!harder) continue;
    used.add(w.key);
    out.push({
      key: w.key,
      basedOn: 'week',
      text: `Your ${LABELS[w.key]} has been a little ${w.direction === 'more' ? 'higher' : 'lower'} than your usual this week. If you like, try ${IDEAS[w.key]}, and see how the next few days feel.`,
    });
  }
  return out;
}
