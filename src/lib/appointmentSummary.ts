// "Summary for my appointment": a printable page built only from the signed-in person's own
// habit_logs and goals. Pure functions, so every rule is unit tested (appointmentSummary.test.ts).
//
// Principles (CLAUDE.md): reflect, don't judge (no pass/fail, no "good" or "bad"); a gap is a gap
// (a day with no value is left out, never counted as 0); personal, not comparative (the only
// comparison is with the person's own previous period); no diagnosis. Notes, feelings, locations
// and gentle check-in answers are never selected, so they cannot reach this page.
import { addDays } from './dashboard';
import type { Category } from './dashboard';
import { PILLAR_ORDER, PILLARS } from './pillars';
import { toISODate } from './dates';

export type SummaryDays = 30 | 90;
export const SUMMARY_CHOICES: SummaryDays[] = [30, 90];

// The only habit_logs columns this feature may read. Keep notes, feelings, latitude, longitude,
// location_name and location_source OUT of this list (a test checks it).
export const SUMMARY_COLUMNS = [
  'log_date',
  'water_liters', 'calories_consumed',
  'sleep_hours', 'time_in_bed_hours', 'awake_minutes',
  'exercise_minutes', 'steps', 'stand_hours', 'active_calories',
  'mood', 'energy', 'stress',
] as const;
export type SummaryColumn = (typeof SUMMARY_COLUMNS)[number];
export type SummaryRow = { log_date: string } & Partial<Record<SummaryColumn, number | string | null>>;

export type SummaryGoal = { goal_type: string; target_value: number; unit: string };

type MeasureSpec = {
  key: Exclude<SummaryColumn, 'log_date'>;
  pillar: Category;
  label: string;
  unit: string; // shown after the value, with its own leading space
  decimals: number;
  same: number; // a change smaller than this reads as "about the same" (same style as insights/overview)
  goalType?: string; // the goals.goal_type that sits beside this measure
};

// The "same" thresholds for water, sleep, exercise, mood, energy and stress are the ones the
// Insights page uses (WEEK_MEASURES in insights/overview.ts); the others follow the same idea.
export const SUMMARY_MEASURES: MeasureSpec[] = [
  { key: 'water_liters', pillar: 'nutrition', label: 'Water', unit: ' liters', decimals: 1, same: 0.25, goalType: 'water' },
  { key: 'calories_consumed', pillar: 'nutrition', label: 'Calories eaten', unit: ' kcal', decimals: 0, same: 100, goalType: 'calories_consumed' },
  { key: 'sleep_hours', pillar: 'sleep', label: 'Sleep', unit: ' hours', decimals: 1, same: 0.5, goalType: 'sleep' },
  { key: 'time_in_bed_hours', pillar: 'sleep', label: 'Time in bed', unit: ' hours', decimals: 1, same: 0.5 },
  { key: 'awake_minutes', pillar: 'sleep', label: 'Awake during the night', unit: ' minutes', decimals: 0, same: 10 },
  { key: 'exercise_minutes', pillar: 'exercise', label: 'Exercise', unit: ' minutes', decimals: 0, same: 10, goalType: 'exercise' },
  { key: 'steps', pillar: 'exercise', label: 'Steps', unit: ' steps', decimals: 0, same: 1000, goalType: 'steps' },
  { key: 'stand_hours', pillar: 'exercise', label: 'Stand hours', unit: ' hours', decimals: 0, same: 1, goalType: 'stand_hours' },
  { key: 'active_calories', pillar: 'exercise', label: 'Active calories', unit: ' kcal', decimals: 0, same: 50, goalType: 'active_calories' },
  { key: 'mood', pillar: 'wellbeing', label: 'Mood (1 to 5)', unit: '', decimals: 1, same: 0.5 },
  { key: 'energy', pillar: 'wellbeing', label: 'Energy (1 to 5)', unit: '', decimals: 1, same: 0.5 },
  { key: 'stress', pillar: 'wellbeing', label: 'Stress (1 to 5)', unit: '', decimals: 1, same: 0.5 },
];

// Fewest logged values in each period before a trend is stated.
export const MIN_TREND_VALUES = 3;
// Fewest logged days before the page is more than a gentle note.
export const FEW_DAYS = 5;

export type Extreme = { value: number; date: string };
export type Trend = { direction: 'same' | 'higher' | 'lower'; text: string };

export type MeasureSummary = {
  key: SummaryColumn;
  label: string;
  unit: string;
  decimals: number;
  days: number; // days with a value
  average: number | null;
  low: Extreme | null;
  high: Extreme | null;
  previousAverage: number | null;
  trend: Trend | null; // null when either period has too few values
  goal: { target: number; unit: string } | null; // shown beside, never coloured
};

export type PillarSummary = {
  key: Category;
  name: string;
  daysLogged: number; // days with at least one value in this pillar
  measures: MeasureSummary[]; // only measures with at least one value
};

export type AppointmentSummary = {
  from: string;
  to: string;
  periodDays: number;
  loggedDays: number; // days with at least one value in any pillar
  pillars: PillarSummary[]; // always Drink, Sleep, Move, Balance
  checkIns: number; // days with at least one of mood, energy, stress
};

// A value that is not logged is null, never 0.
function value(row: SummaryRow, key: SummaryColumn): number | null {
  const v = row[key];
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function periodBounds(endIso: string, days: number): { from: string; to: string; prevFrom: string; prevTo: string } {
  const from = addDays(endIso, -(days - 1));
  return { from, to: endIso, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
}

type Dated = { date: string; v: number };

function collect(rows: SummaryRow[], key: SummaryColumn, from: string, to: string): Dated[] {
  const out = new Map<string, number>(); // one value per date, so a repeated date counts once
  for (const r of rows) {
    if (r.log_date < from || r.log_date > to) continue;
    const v = value(r, key);
    if (v !== null) out.set(r.log_date, v);
  }
  return [...out].map(([date, v]) => ({ date, v }));
}

const mean = (xs: Dated[]) => xs.reduce((s, x) => s + x.v, 0) / xs.length;

// Plain words for the change from the previous period. Never better or worse.
export function trendWords(spec: Pick<MeasureSpec, 'same'>, current: number, previous: number, periodDays: number): Trend {
  const diff = current - previous;
  const size = Math.abs(diff);
  const period = `the ${periodDays} days before`;
  if (size < spec.same) return { direction: 'same', text: `About the same as ${period}.` };
  const direction = diff > 0 ? 'higher' : 'lower';
  const amount = size < spec.same * 3 ? 'A little' : 'Clearly';
  return { direction, text: `${amount} ${direction} than ${period}.` };
}

export function buildSummary(
  rows: SummaryRow[],
  goals: SummaryGoal[],
  endIso: string,
  periodDays: number,
): AppointmentSummary {
  const { from, to, prevFrom, prevTo } = periodBounds(endIso, periodDays);
  const goalFor = (type?: string) => {
    const g = type ? goals.find((x) => x.goal_type === type) : undefined;
    return g ? { target: Number(g.target_value), unit: g.unit } : null;
  };

  const anyDay = new Set<string>();
  const pillarDays = new Map<Category, Set<string>>();
  const checkInDays = new Set<string>();

  const measures = new Map<Category, MeasureSummary[]>();
  for (const spec of SUMMARY_MEASURES) {
    const now = collect(rows, spec.key, from, to);
    if (now.length === 0) continue;
    const before = collect(rows, spec.key, prevFrom, prevTo);

    const days = pillarDays.get(spec.pillar) ?? new Set<string>();
    for (const d of now) {
      days.add(d.date);
      anyDay.add(d.date);
      if (spec.pillar === 'wellbeing') checkInDays.add(d.date);
    }
    pillarDays.set(spec.pillar, days);

    // Ties go to the earliest date so the same data always prints the same page.
    const lowest = [...now].sort((a, b) => a.v - b.v || a.date.localeCompare(b.date))[0];
    const highest = [...now].sort((a, b) => b.v - a.v || a.date.localeCompare(b.date))[0];
    const average = mean(now);
    const previousAverage = before.length > 0 ? mean(before) : null;
    const trend =
      now.length >= MIN_TREND_VALUES && before.length >= MIN_TREND_VALUES
        ? trendWords(spec, average, previousAverage!, periodDays)
        : null;

    const entry: MeasureSummary = {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      decimals: spec.decimals,
      days: now.length,
      average,
      low: { value: lowest.v, date: lowest.date },
      high: { value: highest.v, date: highest.date },
      previousAverage,
      trend,
      goal: goalFor(spec.goalType),
    };
    measures.set(spec.pillar, [...(measures.get(spec.pillar) ?? []), entry]);
  }

  return {
    from,
    to,
    periodDays,
    loggedDays: anyDay.size,
    checkIns: checkInDays.size,
    pillars: PILLAR_ORDER.map((key) => ({
      key,
      name: PILLARS[key].name,
      daysLogged: pillarDays.get(key)?.size ?? 0,
      measures: measures.get(key) ?? [],
    })),
  };
}

// ---------- Words ----------

export function formatNumber(n: number, decimals: number): string {
  const s = n.toFixed(decimals);
  const trimmed = decimals > 0 && s.endsWith('.0') ? s.slice(0, -2) : s;
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMeasure(n: number, m: Pick<MeasureSummary, 'decimals' | 'unit'>): string {
  return `${formatNumber(n, m.decimals)}${m.unit}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Mar 3, 2026" from a YYYY-MM-DD local date; the same text in every locale and time zone.
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatRange(from: string, to: string): string {
  return `${formatDate(from)} to ${formatDate(to)}`;
}

export function summaryTitle(name: string): string {
  const n = name.trim();
  return n ? `Summary for my appointment: ${n}` : 'Summary for my appointment';
}

export function daysLoggedText(loggedDays: number, periodDays: number): string {
  if (loggedDays === 0) return `You did not log any days in the last ${periodDays} days.`;
  return `You logged ${loggedDays} ${loggedDays === 1 ? 'day' : 'days'} in the last ${periodDays} days.`;
}

// Calm note shown when there are only a few logged days. Null when there are enough.
export function fewDaysNote(loggedDays: number): string | null {
  if (loggedDays >= FEW_DAYS) return null;
  if (loggedDays === 0) {
    return 'These were all days off. Once you log some days, they will show up here. You can still print this page and use the box below to write what you want to say.';
  }
  const days = loggedDays === 1 ? '1 day' : `${loggedDays} days`;
  return `You logged ${days} in this time. The summary will be more useful with more days, but you can still print it.`;
}

export function goalText(g: { target: number; unit: string }): string {
  return `${formatNumber(g.target, g.target % 1 === 0 ? 0 : 1)} ${g.unit}`;
}

export const SUMMARY_FOOTER =
  'Notes written by me, from what I logged in Build Your Pillars. This is not a medical record or a diagnosis.';

// Today's local date, never UTC.
export function todayLocal(now = new Date()): string {
  return toISODate(now);
}
