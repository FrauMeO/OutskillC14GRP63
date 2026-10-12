// Reads the last 14 days from Apple Health (iPhone) or Health Connect (Android) and saves them to
// the person's own habit_logs, ONLY when they tap "Import from Health" on a real phone.
//
// Plugin: @capgo/capacitor-health 8.11.10 (MPL-2.0). Its API was checked against its shipped
// TypeScript definitions (dist/esm/definitions.d.ts) and its native sources, NOT on a device:
// this Mac has no Xcode and no Android SDK. See docs/mobile-build.md, "Health import: test on a phone".
//
// Privacy rules (docs/gdpr-compliance.md, Apple 5.1.3):
//  - behind the VITE_HEALTH_IMPORT flag, default off;
//  - read only: nothing is ever written to Apple Health or Health Connect;
//  - four things only: steps, sleep, exercise minutes, water; the last 14 days;
//  - nothing leaves the phone until the person has seen the preview and confirms;
//  - saved only to their own account, never used for advertising.
import { supabase } from '../supabase';
import { isNative, platform } from './platform';
import {
  COLUMNS,
  combineDays,
  importWindow,
  mapExerciseTime,
  mapSleep,
  mapSteps,
  mapWater,
  mapWorkouts,
  planUpserts,
  sourceFor,
  windowDates,
  type Bucket,
  type ExistingDay,
  type ImportDay,
  type ImportPlan,
} from './healthImportLogic';

export const IMPORT_DAYS = 14;
const SAMPLE_LIMIT = 5000;

/** Feature flag. Off unless built with VITE_HEALTH_IMPORT=on, and never on the website. */
export function isHealthImportEnabled(): boolean {
  const flag = (import.meta.env as Record<string, string | undefined>).VITE_HEALTH_IMPORT;
  return flag === 'on' && isNative();
}

export type ReadResult =
  | { status: 'ok'; days: ImportDay[] }
  | { status: 'unavailable' | 'error'; message: string };

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

/** Plain-words explanation when Health Connect is missing (older Android versions). */
const UNAVAILABLE_TEXT =
  'Health data is not available on this phone. On some Android phones you need to install “Health Connect” from the Play Store first.';

/**
 * Asks the phone for read permission (the phone shows its own sheet), then reads and maps the
 * last 14 full days. Returns the days for a preview. Writes nothing anywhere.
 */
export async function readLastDays(): Promise<ReadResult> {
  const p = platform();
  if (!isHealthImportEnabled() || (p !== 'ios' && p !== 'android')) {
    return { status: 'unavailable', message: 'Importing from Health is only available in the phone app.' };
  }
  try {
    const Health = await plugin();
    const availability = await Health.isAvailable();
    if (!availability.available) return { status: 'unavailable', message: UNAVAILABLE_TEXT };

    // Read permissions only. iOS reads exercise time directly; Health Connect has no such type,
    // so on Android we read exercise sessions ('workouts') and add up their length.
    const read =
      p === 'ios'
        ? (['steps', 'sleep', 'exerciseTime', 'dietaryWater'] as const)
        : (['steps', 'sleep', 'workouts', 'dietaryWater'] as const);
    await Health.requestAuthorization({ read: [...read], write: [] });
    // Note: Apple does not tell an app which READ permissions were refused (a privacy rule), so we
    // simply read and show what comes back. A refused type shows up as an empty column.

    const { start, end } = importWindow(IMPORT_DAYS);
    const range = { startDate: start.toISOString(), endDate: end.toISOString() };

    const daily = async (dataType: 'steps' | 'dietaryWater'): Promise<Bucket[]> => {
      const { samples } = await Health.queryAggregated({ dataType, ...range, bucket: 'day', aggregation: 'sum' });
      return samples.map((s) => ({ startDate: s.startDate, value: s.value }));
    };

    const [steps, water, sleepRes] = await Promise.all([
      daily('steps'),
      daily('dietaryWater'),
      Health.readSamples({ dataType: 'sleep', ...range, limit: SAMPLE_LIMIT }),
    ]);

    let exercise: Map<string, number>;
    if (p === 'ios') {
      const { samples } = await Health.readSamples({ dataType: 'exerciseTime', ...range, limit: SAMPLE_LIMIT });
      exercise = mapExerciseTime(samples.map((s) => ({ startDate: s.startDate, value: s.value })));
    } else {
      const { workouts } = await Health.queryWorkouts({ ...range, limit: SAMPLE_LIMIT });
      exercise = mapWorkouts(workouts.map((w) => ({ startDate: w.startDate, duration: w.duration })));
    }

    const days = combineDays(
      {
        steps: mapSteps(steps),
        water_liters: mapWater(water),
        exercise_minutes: exercise,
        sleep_hours: mapSleep(
          sleepRes.samples.map((s) => ({
            startDate: s.startDate,
            endDate: s.endDate,
            sourceName: s.sourceName,
            sleepState: s.sleepState,
            stages: s.stages?.map((st) => ({ startDate: st.startDate, endDate: st.endDate, stage: st.stage })),
          })),
          { unstagedCountsAsAsleep: p === 'android' },
        ),
      },
      windowDates(IMPORT_DAYS),
    );
    return { status: 'ok', days };
  } catch (e) {
    const detail = e instanceof Error ? e.message : '';
    return { status: 'error', message: `Sorry, Health data could not be read.${detail ? ` (${detail})` : ''}` };
  }
}

export type PlanResult = { ok: true; plan: ImportPlan } | { ok: false; error: string };

/**
 * Works out exactly what would be added, without saving anything. Used for the preview.
 * Fills blanks only: a value the person already entered is never replaced.
 */
export async function buildPlan(days: ImportDay[]): Promise<PlanResult> {
  const p = platform();
  if (p !== 'ios' && p !== 'android') return { ok: false, error: 'Importing is only available in the phone app.' };
  if (days.length === 0) return { ok: true, plan: { rows: [], dayCount: 0, addedValues: 0, keptYours: 0 } };

  const first = days[0].log_date;
  const last = days[days.length - 1].log_date;
  const { data: existingRows, error: readError } = await supabase
    .from('habit_logs')
    .select('log_date, steps, sleep_hours, exercise_minutes, water_liters, source')
    .gte('log_date', first)
    .lte('log_date', last);
  if (readError) return { ok: false, error: `Could not check your existing days: ${readError.message}` };

  const existing: ExistingDay[] = (existingRows ?? []).map((r) => {
    const out: ExistingDay = { log_date: r.log_date, source: r.source };
    for (const c of COLUMNS) out[c] = r[c] as number | null;
    return out;
  });

  // 'apple_health' on iPhone. Android uses 'manual' until a database migration allows a new
  // Health Connect value (the check constraint in 0006 permits only 'apple_health' and 'manual').
  return { ok: true, plan: planUpserts(days, existing, sourceFor(p)) };
}

/**
 * Saves a plan from buildPlan(). One request per day, because a bulk upsert whose rows have
 * different columns would blank the missing columns on days that already exist.
 */
export async function savePlan(plan: ImportPlan): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const row of plan.rows) {
    const { error } = await supabase.from('habit_logs').upsert(row, { onConflict: 'user_id,log_date' });
    if (error) return { ok: false, error: `Could not save ${row.log_date}: ${error.message}` };
  }
  return { ok: true };
}
