// Outside conditions cached in daily_conditions: one row per user per date.
// Fetching and conversion rules live in conditionsCore.ts.
import { supabase } from './supabase';
import { fetchConditionRange, needsFetch, type Spot } from './conditionsCore';

export type EnsureResult = 'fetched' | 'cached' | 'failed';

export async function ensureConditions(place: Spot, isoDate: string, todayIso: string): Promise<EnsureResult> {
  if (isoDate > todayIso) return 'cached'; // no conditions for future dates
  const { data: existing } = await supabase
    .from('daily_conditions')
    .select('latitude, longitude, is_final')
    .eq('date', isoDate)
    .maybeSingle();
  if (!needsFetch(existing, place, isoDate, todayIso)) return 'cached';

  try {
    const [values] = await fetchConditionRange(place, isoDate, isoDate, todayIso);
    if (!values) return 'failed';
    const { error } = await supabase
      .from('daily_conditions')
      .upsert({ ...values, fetched_at: new Date().toISOString() }, { onConflict: 'user_id,date' });
    return error ? 'failed' : 'fetched';
  } catch {
    return 'failed';
  }
}
