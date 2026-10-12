// Care sharing (migration 0010): pure logic for inviting someone to follow your pillars, read-only.
// The database is the authority (every write goes through an RPC that checks who is calling);
// this file mirrors its email rule, names the pillars in plain words, and turns the days the
// viewer is allowed to see into a gentle summary. A day with nothing shared logged is simply not
// in the rows: it is a gap, never a zero, a miss or a red mark. Notes, feelings and places are
// never part of any row type here.
import { addDays, CATEGORY_FIELDS, FULL_WEEK_DAYS, num, series, weeklyRhythm } from './dashboard';
import { goalConfig, type GoalType } from './goals';
import { PILLARS } from './pillars';

// ---------- Row types (hand-written to match the RPC and table shapes in 0010) ----------

export type ShareStatus = 'pending' | 'active' | 'revoked';

export type PillarFlags = { eat: boolean; sleep: boolean; move: boolean; balance: boolean };

/** A row of care_shares as the owner sees it. */
export type CareShareRow = {
  id: string;
  owner_id: string;
  viewer_email: string;
  viewer_id: string | null;
  status: ShareStatus;
  share_eat: boolean;
  share_sleep: boolean;
  share_move: boolean;
  share_balance: boolean;
  created_at: string;
  accepted_at: string | null;
  ended_at: string | null;
};

/** A row of followed_people(): the viewer's active follows and pending invitations. */
export type FollowedPerson = {
  share_id: string;
  owner_id: string;
  owner_name: string;
  status: 'pending' | 'active';
  share_eat: boolean;
  share_sleep: boolean;
  share_move: boolean;
  share_balance: boolean;
  created_at: string;
  accepted_at: string | null;
};

/** A row of shared_days(): unshared pillars are null. */
export type SharedDay = {
  log_date: string;
  water_liters: number | null;
  calories_consumed: number | null;
  sleep_hours: number | null;
  time_in_bed_hours: number | null;
  awake_minutes: number | null;
  exercise_minutes: number | null;
  steps: number | null;
  stand_hours: number | null;
  active_calories: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
};

/** A row of shared_goals(). */
export type SharedGoal = { goal_type: string; target_value: number; unit: string };

// ---------- Pillar flags ----------

type FlagSource = { share_eat: boolean; share_sleep: boolean; share_move: boolean; share_balance: boolean };

export function flagsOf(s: FlagSource): PillarFlags {
  return { eat: s.share_eat, sleep: s.share_sleep, move: s.share_move, balance: s.share_balance };
}

const FLAG_ORDER: { flag: keyof PillarFlags; name: string }[] = [
  { flag: 'eat', name: PILLARS.nutrition.name },
  { flag: 'sleep', name: PILLARS.sleep.name },
  { flag: 'move', name: PILLARS.exercise.name },
  { flag: 'balance', name: PILLARS.wellbeing.name },
];

/** Shared pillar names in display order: Eat, Sleep, Move, Balance. */
export function sharedPillarNames(f: PillarFlags): string[] {
  return FLAG_ORDER.filter((p) => f[p.flag]).map((p) => p.name);
}

export function hasAnyPillar(f: PillarFlags): boolean {
  return FLAG_ORDER.some((p) => f[p.flag]);
}

/** 'Eat, Sleep and Move', 'Eat and Balance', 'Sleep', or 'Nothing yet' when none. */
export function pillarSummary(f: PillarFlags): string {
  const names = sharedPillarNames(f);
  if (names.length === 0) return 'Nothing yet';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function sameFlags(a: PillarFlags, b: PillarFlags): boolean {
  return FLAG_ORDER.every((p) => a[p.flag] === b[p.flag]);
}

// ---------- Email (mirrors the SQL rule in create_care_share) ----------

export const MAX_EMAIL_LENGTH = 254;
export const EMAIL_ERROR = 'That does not look like an email address.';

/** Trim and lowercase, exactly as the database does before it checks. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// SQL: ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$  (one @, a dot after it, no spaces)
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Returns a plain-English message, or null when the address would be accepted. */
export function validateEmail(raw: string): string | null {
  const e = normaliseEmail(raw);
  if (e.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(e)) return EMAIL_ERROR;
  return null;
}

// ---------- Messages ----------

export const NO_PILLAR_ERROR = 'Choose at least one pillar to share.';

export function statusLabel(status: ShareStatus): string {
  if (status === 'pending') return 'Waiting for them to accept';
  if (status === 'active') return 'Following';
  return 'Ended';
}

/** Shares the owner still sees: ended ones are hidden. */
export function openShares<T extends { status: ShareStatus }>(rows: T[]): T[] {
  return rows.filter((r) => r.status !== 'revoked');
}

// ---------- The viewer's summary ----------

export const WEEKS_SHOWN = 4;
const DAYS_SHOWN = WEEKS_SHOWN * 7;

/** The date range to ask shared_days for: the last 4 weeks, ending today (28 days, inside the 93 limit). */
export function summaryRange(todayIso: string): { from: string; to: string } {
  return { from: addDays(todayIso, -(DAYS_SHOWN - 1)), to: todayIso };
}

export type SharedMetric = {
  field: keyof Omit<SharedDay, 'log_date'>;
  label: string;
  unit: string;
  pillar: keyof PillarFlags;
  goal?: GoalType; // which goal (if any) belongs with this measure
};

const goalLabel = (g: GoalType) => goalConfig(g)!.label;

export const SHARED_METRICS: SharedMetric[] = [
  { field: 'water_liters', label: goalLabel('water'), unit: 'L', pillar: 'eat', goal: 'water' },
  { field: 'calories_consumed', label: goalLabel('calories_consumed'), unit: 'kcal', pillar: 'eat', goal: 'calories_consumed' },
  { field: 'sleep_hours', label: goalLabel('sleep'), unit: 'h', pillar: 'sleep', goal: 'sleep' },
  { field: 'time_in_bed_hours', label: 'Time in bed', unit: 'h', pillar: 'sleep' },
  { field: 'awake_minutes', label: 'Awake in the night', unit: 'min', pillar: 'sleep' },
  { field: 'exercise_minutes', label: goalLabel('exercise'), unit: 'min', pillar: 'move', goal: 'exercise' },
  { field: 'steps', label: goalLabel('steps'), unit: 'steps', pillar: 'move', goal: 'steps' },
  { field: 'stand_hours', label: goalLabel('stand_hours'), unit: 'h', pillar: 'move', goal: 'stand_hours' },
  { field: 'active_calories', label: goalLabel('active_calories'), unit: 'kcal', pillar: 'move', goal: 'active_calories' },
  { field: 'mood', label: 'Mood', unit: 'of 5', pillar: 'balance' },
  { field: 'energy', label: 'Energy', unit: 'of 5', pillar: 'balance' },
  { field: 'stress', label: 'Stress', unit: 'of 5', pillar: 'balance' },
];

export type WeekSummary = { start: string; end: string; daysLogged: number; fullWeek: boolean };

export type MetricSeries = {
  metric: SharedMetric;
  days: { date: string; value: number | null }[]; // 7 days ending today; null is a gap
  goal: number | null;
};

export type SharedSummary = {
  weeks: WeekSummary[]; // oldest first; the last one ends today
  weeksInRow: number; // full weeks in a row, counting back from the latest one that is full
  metrics: MetricSeries[]; // only the shared pillars
};

/** Pillar of a field, from the shared field lists in dashboard.ts (the owner's own categories). */
function visibleFields(flags: PillarFlags): Set<string> {
  const out = new Set<string>();
  const add = (on: boolean, cat: keyof typeof CATEGORY_FIELDS) => on && CATEGORY_FIELDS[cat].forEach((f) => out.add(f));
  add(flags.eat, 'nutrition');
  add(flags.sleep, 'sleep');
  add(flags.move, 'exercise');
  add(flags.balance, 'wellbeing');
  return out;
}

/**
 * Turn the shared days into what the viewer sees. Only fields of shared pillars are ever used,
 * even if the rows contained more. A day without a row (or with only unshared values) is a gap:
 * it is never counted as a miss, never a zero, and there is no "missed days" figure at all.
 */
export function summariseShared(rows: SharedDay[], flags: PillarFlags, goals: SharedGoal[], todayIso: string): SharedSummary {
  const allowed = visibleFields(flags);
  // Keep only permitted fields, so a stray value for an unshared pillar can never show.
  const clean = rows.map((r) => {
    const o: Record<string, unknown> = { log_date: r.log_date };
    for (const f of allowed) o[f] = (r as unknown as Record<string, unknown>)[f] ?? null;
    return o as { log_date: string } & Record<string, unknown>;
  });
  const logged = new Set(clean.filter((r) => [...allowed].some((f) => num(r, f) !== null)).map((r) => r.log_date));

  const weeks: WeekSummary[] = [];
  for (let k = WEEKS_SHOWN - 1; k >= 0; k--) {
    const end = addDays(todayIso, -7 * k);
    const start = addDays(end, -6);
    let daysLogged = 0;
    for (let i = 0; i < 7; i++) if (logged.has(addDays(start, i))) daysLogged++;
    weeks.push({ start, end, daysLogged, fullWeek: daysLogged >= FULL_WEEK_DAYS });
  }

  // The existing rhythm rule decides "weeks in a row" (a week in progress never breaks the run).
  const weeksInRow = weeklyRhythm(clean, todayIso).weeksInRow;

  const targets = new Map(goals.map((g) => [g.goal_type, Number(g.target_value)]));
  const metrics: MetricSeries[] = SHARED_METRICS.filter((m) => flags[m.pillar]).map((metric) => {
    const g = metric.goal ? targets.get(metric.goal) : undefined;
    return {
      metric,
      days: series(clean, metric.field, todayIso),
      goal: g !== undefined && Number.isFinite(g) && g > 0 ? g : null,
    };
  });
  return { weeks, weeksInRow, metrics };
}

/** '3 days logged', '1 day logged'. A week with none says so gently, never "missed". */
export function weekText(w: WeekSummary): string {
  if (w.daysLogged === 0) return 'Nothing logged';
  const d = `${w.daysLogged} ${w.daysLogged === 1 ? 'day' : 'days'} logged`;
  return w.fullWeek ? `${d}, a full week` : d;
}

/** How full a plain bar is: value against the owner's goal, capped; null when there is no value or goal. */
export function barFill(value: number | null, goal: number | null): number | null {
  if (value === null || goal === null || !(goal > 0)) return null;
  return Math.min(1, Math.max(0, value / goal));
}

/** Plain value text for a number: whole numbers stay whole, others get at most one decimal. */
export function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('en-US') : String(Math.round(value * 10) / 10);
}
