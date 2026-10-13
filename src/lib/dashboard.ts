// Dashboard calculations. Pure: the page fetches rows and passes them in, so every rule here
// is unit tested (dashboard.test.ts).
import { GOAL_TYPES, type GoalConfig, type GoalType } from './goals';
import { PILLARS } from './pillars';

// ---------- Progress ----------

export type Progress = { value: number; goal: number; percent: number; fill: number };

// Real percentage (can pass 100) plus a fill capped at 1 for the ring or bar.
export function progress(value: number | null, goal: number | null): Progress | null {
  if (value === null || goal === null || !(goal > 0)) return null;
  const percent = Math.round((value / goal) * 100);
  return { value, goal, percent, fill: Math.min(1, Math.max(0, value / goal)) };
}

// Apple Health values render as a ring; manual (or unknown) values as a horizontal bar.
export function indicatorFor(source: string | null | undefined): 'ring' | 'bar' {
  return source === 'apple_health' ? 'ring' : 'bar';
}

// ---------- Numbers from rows ----------

type Row = Record<string, unknown>;

export function num(row: Row | null | undefined, field: string): number | null {
  const v = row?.[field];
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Net calories = eaten minus active calories burned; null unless both were logged.
export function netCalories(row: Row | null | undefined): number | null {
  const eaten = num(row, 'calories_consumed');
  const burned = num(row, 'active_calories');
  return eaten === null || burned === null ? null : eaten - burned;
}

export function goalTargets(goals: { goal_type: string; target_value: unknown }[]): Partial<Record<GoalType, number>> {
  const out: Partial<Record<GoalType, number>> = {};
  for (const g of goals) {
    const n = Number(g.target_value);
    if (GOAL_TYPES.some((t) => t.value === g.goal_type) && Number.isFinite(n)) out[g.goal_type as GoalType] = n;
  }
  return out;
}

export function goalsIn(category: GoalConfig['category']): GoalConfig[] {
  return GOAL_TYPES.filter((g) => g.category === category);
}

// ---------- Categories ----------

export type Category = 'exercise' | 'sleep' | 'nutrition' | 'wellbeing';

export const CATEGORY_FIELDS: Record<Category, string[]> = {
  exercise: ['exercise_minutes', 'steps', 'stand_hours', 'active_calories'],
  sleep: ['sleep_hours', 'time_in_bed_hours', 'awake_minutes'],
  nutrition: ['water_liters', 'calories_consumed'],
  wellbeing: ['mood', 'energy', 'stress'],
};

// Names people see come from the pillars (src/lib/pillars.ts).
export const CATEGORY_LABELS: Record<Category, string> = {
  exercise: PILLARS.exercise.name,
  sleep: PILLARS.sleep.name,
  nutrition: PILLARS.nutrition.name,
  wellbeing: PILLARS.wellbeing.name,
};

const CATEGORIES = Object.keys(CATEGORY_FIELDS) as Category[];

export function missingCategories(row: Row | null | undefined): Category[] {
  return CATEGORIES.filter((c) => !CATEGORY_FIELDS[c].some((f) => num(row, f) !== null));
}

// Local calendar arithmetic on YYYY-MM-DD strings (noon avoids daylight-saving edges).
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d, 12);
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

// ---------- Seven-day series (missing days are gaps, never zero) ----------

export function lastSevenDates(todayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayIso, i - 6));
}

export function series(rows: (Row & { log_date: string })[], field: string, todayIso: string): { date: string; value: number | null }[] {
  const byDate = new Map(rows.map((r) => [r.log_date, r]));
  return lastSevenDates(todayIso).map((date) => ({ date, value: num(byDate.get(date), field) }));
}

// ---------- Weekly rhythm (replaces the daily streak on the Dashboard) ----------
// Miah, 2026-09-26, from what people say about health apps: daily streaks punish rest, illness
// and travel, and a broken streak makes people give up. So a day counts when anything is logged,
// a full week is FULL_WEEK_DAYS logged days in the last seven, rest days are part of the rhythm,
// and nothing ever says a streak was lost.

export const FULL_WEEK_DAYS = 4;
const MAX_WEEKS = 52;

export type Rhythm = { daysThisWeek: number; fullWeek: boolean; weeksInRow: number; loggedToday: boolean };

export function weeklyRhythm(rows: (Row & { log_date: string })[], todayIso: string): Rhythm {
  const logged = new Set(rows.filter((r) => missingCategories(r).length < CATEGORIES.length).map((r) => r.log_date));
  // Week k is the seven days ending k weeks before today (week 0 ends today).
  const daysIn = (k: number) => Array.from({ length: 7 }, (_, i) => addDays(todayIso, -7 * k - i)).filter((d) => logged.has(d)).length;

  const daysThisWeek = daysIn(0);
  const fullWeek = daysThisWeek >= FULL_WEEK_DAYS;
  // A week still in progress never breaks the run: if it is not full yet, count from last week.
  let k = fullWeek ? 0 : 1;
  let weeksInRow = 0;
  while (k < MAX_WEEKS && daysIn(k) >= FULL_WEEK_DAYS) {
    weeksInRow++;
    k++;
  }
  return { daysThisWeek, fullWeek, weeksInRow, loggedToday: logged.has(todayIso) };
}

// The words on the Dashboard. Celebrates arrivals; never counts or names missed days.
export function rhythmText(r: Rhythm): { title: string; body: string } {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (r.fullWeek) {
    return { title: 'A full week', body: `You logged ${days(r.daysThisWeek)} in the last seven.` };
  }
  // Weeks before this one that were full, said as something to be glad of.
  const before =
    r.weeksInRow === 0 ? '' : r.weeksInRow === 1 ? ' The week before was a full one.' : ` The ${r.weeksInRow} weeks before were full ones.`;
  if (r.daysThisWeek === 0) return { title: 'A fresh week', body: `Log whenever you are ready.${before}` };
  const toGo = FULL_WEEK_DAYS - r.daysThisWeek;
  return {
    title: `${days(r.daysThisWeek)} this week`,
    body: `${toGo === 1 ? 'One more day makes' : `${toGo} more days make`} a full week, whenever it suits you.${before}`,
  };
}
