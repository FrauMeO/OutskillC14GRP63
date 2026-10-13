// Pure mapping from what Apple Health / Health Connect return to habit_logs rows.
// No native calls and no database calls here, so every rule is unit tested.
//
// The rules deliberately match the importer for exported Apple Health files
// (scripts/import-apple-health.mjs) so a person gets the same numbers either way:
//   - one row per local calendar day; a blank is null, never 0;
//   - sleep counts toward the day you wake up (an 18:00 boundary), only "asleep" stages,
//     one source per night (the Watch if there is one, otherwise the longest), overlaps merged;
//   - sleep to 2 decimals in hours, water to 3 decimals in litres, steps and minutes whole numbers.
import { toISODate } from '../dates';

export type HabitColumn = 'steps' | 'sleep_hours' | 'exercise_minutes' | 'water_liters';
export type DayValues = Partial<Record<HabitColumn, number | null>>;
export type ImportDay = { log_date: string } & Record<HabitColumn, number | null>;

/** Limits copied from the database constraints (migrations 0001 and 0006). Outside them, skip. */
export const LIMITS: Record<HabitColumn, { min: number; max: number }> = {
  steps: { min: 0, max: 200000 },
  sleep_hours: { min: 0, max: 24 },
  exercise_minutes: { min: 0, max: 24 * 60 },
  water_liters: { min: 0, max: 50 },
};

export const COLUMNS: HabitColumn[] = ['steps', 'sleep_hours', 'exercise_minutes', 'water_liters'];

// ---------- the 14-day window ----------

/** Local midnight at the start of the window and the end (exclusive), as dates. */
export function importWindow(days: number, now: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00, not included
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return { start, end };
}

/** Every local date in the window, oldest first. */
export function windowDates(days: number, now: Date = new Date()): string[] {
  const { start } = importWindow(days, now);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toISODate(d);
  });
}

// ---------- samples from the plugin (only the fields we use) ----------

export type Bucket = { startDate: string; value: number };
export type SleepSample = {
  startDate: string;
  endDate: string;
  sourceName?: string;
  sleepState?: string;
  stages?: { startDate: string; endDate: string; stage: string }[];
};
export type MinutesSample = { startDate: string; value: number };
export type WorkoutLike = { startDate: string; duration: number }; // duration in seconds

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function inRange(col: HabitColumn, v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const { min, max } = LIMITS[col];
  return v < min || v > max ? null : v;
}

const localDate = (iso: string): string | null => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : toISODate(t);
};

/** Daily buckets (platform already merged phone and Watch) to whole steps per date. */
export function mapSteps(buckets: Bucket[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of buckets) {
    const date = localDate(b.startDate);
    if (!date || !Number.isFinite(b.value)) continue;
    out.set(date, (out.get(date) ?? 0) + b.value);
  }
  for (const [d, v] of out) {
    const r = inRange('steps', Math.round(v));
    if (r === null || r === 0) out.delete(d); // no steps recorded is "not logged", not 0
    else out.set(d, r);
  }
  return out;
}

/** Daily water buckets in litres to litres (3 decimals, like the importer's whole-millilitre rule). */
export function mapWater(buckets: Bucket[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of buckets) {
    const date = localDate(b.startDate);
    if (!date || !Number.isFinite(b.value)) continue;
    out.set(date, (out.get(date) ?? 0) + b.value);
  }
  for (const [d, litres] of out) {
    const r = inRange('water_liters', Math.round(litres * 1000) / 1000);
    if (r === null || r === 0) out.delete(d);
    else out.set(d, r);
  }
  return out;
}

/** iOS: Apple Exercise Time samples (minutes) summed per local day. */
export function mapExerciseTime(samples: MinutesSample[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of samples) {
    const date = localDate(s.startDate);
    if (!date || !Number.isFinite(s.value)) continue;
    out.set(date, (out.get(date) ?? 0) + s.value);
  }
  return finishMinutes(out);
}

/** Android: Health Connect exercise sessions (seconds) summed per local day, in whole minutes. */
export function mapWorkouts(workouts: WorkoutLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of workouts) {
    const date = localDate(w.startDate);
    if (!date || !Number.isFinite(w.duration)) continue;
    out.set(date, (out.get(date) ?? 0) + w.duration / 60);
  }
  return finishMinutes(out);
}

function finishMinutes(m: Map<string, number>): Map<string, number> {
  for (const [d, v] of m) {
    const r = inRange('exercise_minutes', Math.round(v));
    if (r === null || r === 0) m.delete(d);
    else m.set(d, r);
  }
  return m;
}

// ---------- sleep ----------

const ASLEEP_STATES = new Set(['asleep', 'rem', 'deep', 'light']);

/** The day a stretch of sleep belongs to: the local date of (end + 6 hours), the 18:00 boundary. */
export function wakeDate(endIso: string): string | null {
  const t = new Date(endIso).getTime();
  if (Number.isNaN(t)) return null;
  return toISODate(new Date(t + 6 * 3600_000));
}

type Interval = [number, number]; // epoch ms

function mergedMinutes(intervals: Interval[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cs: number | null = null;
  let ce: number | null = null;
  for (const [s, e] of sorted) {
    if (ce === null || s > ce) {
      if (ce !== null && cs !== null) total += ce - cs;
      cs = s;
      ce = e;
    } else ce = Math.max(ce, e);
  }
  if (ce !== null && cs !== null) total += ce - cs;
  return total / 60_000;
}

/**
 * Time asleep per wake-up date, in hours to 2 decimals.
 * `unstagedCountsAsAsleep`: Health Connect (Android) reports a whole sleep session and often no stages.
 * A session with no stages is then counted as sleep. Apple Health always labels each stretch, and an
 * unlabelled iOS stretch is ignored.
 */
export function mapSleep(samples: SleepSample[], opts: { unstagedCountsAsAsleep: boolean }): Map<string, number> {
  const bySource = new Map<string, Map<string, Interval[]>>(); // date -> source -> intervals
  const add = (date: string | null, src: string, s: string, e: string) => {
    const a = new Date(s).getTime();
    const b = new Date(e).getTime();
    if (!date || Number.isNaN(a) || Number.isNaN(b) || b <= a) return;
    const perDate = bySource.get(date) ?? new Map<string, Interval[]>();
    perDate.set(src, [...(perDate.get(src) ?? []), [a, b]]);
    bySource.set(date, perDate);
  };

  for (const s of samples) {
    const src = s.sourceName ?? 'unknown';
    if (s.stages && s.stages.length > 0) {
      for (const st of s.stages) {
        if (ASLEEP_STATES.has(st.stage)) add(wakeDate(st.endDate), src, st.startDate, st.endDate);
      }
    } else if (s.sleepState) {
      if (ASLEEP_STATES.has(s.sleepState)) add(wakeDate(s.endDate), src, s.startDate, s.endDate);
    } else if (opts.unstagedCountsAsAsleep) {
      add(wakeDate(s.endDate), src, s.startDate, s.endDate);
    }
  }

  const out = new Map<string, number>();
  for (const [date, perSource] of bySource) {
    const totals = [...perSource].map(([src, iv]) => ({ src, mins: mergedMinutes(iv) }));
    const watch = totals.find((t) => /watch/i.test(t.src));
    const mins = (watch ?? totals.sort((x, y) => y.mins - x.mins)[0]).mins;
    const hours = inRange('sleep_hours', round(mins / 60, 2));
    if (hours !== null && hours > 0) out.set(date, hours);
  }
  return out;
}

// ---------- combine, de-dupe by date, keep to the window ----------

/**
 * One row per date, only dates inside the window, only days with at least one value.
 * Because the result is keyed by date there can never be two rows for the same day.
 */
export function combineDays(
  parts: Partial<Record<HabitColumn, Map<string, number>>>,
  allowedDates: string[],
): ImportDay[] {
  const allowed = new Set(allowedDates);
  const byDate = new Map<string, ImportDay>();
  for (const col of COLUMNS) {
    for (const [date, value] of parts[col] ?? []) {
      if (!allowed.has(date)) continue;
      const row =
        byDate.get(date) ??
        ({ log_date: date, steps: null, sleep_hours: null, exercise_minutes: null, water_liters: null } as ImportDay);
      row[col] = inRange(col, value);
      byDate.set(date, row);
    }
  }
  return [...byDate.values()]
    .filter((r) => COLUMNS.some((c) => r[c] !== null))
    .sort((a, b) => (a.log_date < b.log_date ? -1 : 1));
}

// ---------- what to write, without overwriting what the person typed ----------

export type ExistingDay = { log_date: string } & Partial<Record<HabitColumn, number | null>> & { source?: string };

/** The row sent to habit_logs. `source` is present only for brand-new days. */
export type UpsertRow = { log_date: string; source?: string } & DayValues;

export type ImportPlan = {
  rows: UpsertRow[];
  /** Days that will get at least one value. */
  dayCount: number;
  /** Values we add. */
  addedValues: number;
  /** Values we left alone because the person already logged that measure for that day. */
  keptYours: number;
};

/**
 * Only fills blanks. A value the person already entered (or imported earlier) is never replaced,
 * so a second import is harmless. New days get `source`. Existing days keep their own source, so a
 * hand-logged day does not flip from bars to rings.
 */
export function planUpserts(days: ImportDay[], existing: ExistingDay[], source: string): ImportPlan {
  const have = new Map(existing.map((e) => [e.log_date, e]));
  const rows: UpsertRow[] = [];
  let addedValues = 0;
  let keptYours = 0;
  for (const d of days) {
    const prev = have.get(d.log_date);
    const row: UpsertRow = { log_date: d.log_date };
    let added = 0;
    for (const col of COLUMNS) {
      const v = d[col];
      if (v === null) continue;
      if (prev && prev[col] !== null && prev[col] !== undefined) {
        keptYours++;
        continue;
      }
      row[col] = v;
      added++;
    }
    if (added === 0) continue;
    if (!prev) row.source = source;
    addedValues += added;
    rows.push(row);
  }
  return { rows, dayCount: rows.length, addedValues, keptYours };
}

/**
 * The source value to store.
 * iOS: 'apple_health', allowed by the existing check constraint in migration 0006.
 * Android: Health Connect has no allowed value yet. The constraint only allows ('apple_health','manual'),
 * so 'manual' is used. A new value such as 'health_connect' needs a database migration, which is
 * deliberately NOT part of this change.
 */
export function sourceFor(platform: 'ios' | 'android'): 'apple_health' | 'manual' {
  return platform === 'ios' ? 'apple_health' : 'manual';
}
