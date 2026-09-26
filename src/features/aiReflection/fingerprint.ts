// TEMPORARY, for the hackathon (removed with the rest of src/features/aiReflection).
// What the automatic reflection is written from: the same fields the Edge Function sends. When
// this changes, the entry has changed and a new reflection is due; editing notes does not count.
const FIELDS = [
  'exercise_minutes', 'steps', 'stand_hours', 'active_calories', 'sleep_hours', 'time_in_bed_hours',
  'awake_minutes', 'water_liters', 'calories_consumed', 'mood', 'energy', 'stress', 'feelings',
] as const;

export function entryFingerprint(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  return JSON.stringify(FIELDS.map((f) => (row[f] === undefined || row[f] === '' ? null : row[f])));
}
