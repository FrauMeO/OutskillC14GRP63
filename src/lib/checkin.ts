// Log Habits form rules: rating scales, feelings, and turning form text into a habit_logs row.
// Blank means "not logged" and becomes null, never 0.

export type RatingKey = 'mood' | 'energy' | 'stress';

export type RatingScale = {
  key: RatingKey;
  label: string;
  // Index 0 is the label for 1, index 4 for 5.
  levels: [string, string, string, string, string];
  faces?: [string, string, string, string, string];
};

export const RATING_SCALES: RatingScale[] = [
  {
    key: 'mood',
    label: 'Mood',
    levels: ['Very sad', 'Sad', 'Okay', 'Happy', 'Very happy'],
    faces: ['😢', '🙁', '😐', '🙂', '😄'],
  },
  { key: 'energy', label: 'Energy', levels: ['Very low', 'Low', 'Moderate', 'High', 'Very high'] },
  { key: 'stress', label: 'Stress', levels: ['Very low', 'Low', 'Moderate', 'High', 'Very high'] },
];

// Thirteen feelings (Miah and Bob, 2026-09-26): 6 pleasant, 2 neutral, 5 unpleasant. `value` is
// what is stored (allowed list fixed by migration 0008). `apple` is the Apple Health State of Mind
// label it maps to (HKStateOfMind.Label). Ten match by name; Steady -> Content, Meh -> Indifferent
// and Tired -> Drained are translated, and people only ever see the app's own word.
// No word repeats a Mood, Energy or Stress level label.
export const FEELINGS = [
  { value: 'calm', label: 'Calm', face: '🙂', tone: 'pleasant', apple: 'calm' },
  { value: 'peaceful', label: 'Peaceful', face: '😌', tone: 'pleasant', apple: 'peaceful' },
  { value: 'confident', label: 'Confident', face: '😎', tone: 'pleasant', apple: 'confident' },
  { value: 'grateful', label: 'Grateful', face: '🥰', tone: 'pleasant', apple: 'grateful' },
  { value: 'hopeful', label: 'Hopeful', face: '🤗', tone: 'pleasant', apple: 'hopeful' },
  { value: 'proud', label: 'Proud', face: '😊', tone: 'pleasant', apple: 'proud' },
  { value: 'steady', label: 'Steady', face: '😐', tone: 'neutral', apple: 'content' },
  { value: 'meh', label: 'Meh', face: '😑', tone: 'neutral', apple: 'indifferent' },
  { value: 'frustrated', label: 'Frustrated', face: '😤', tone: 'unpleasant', apple: 'frustrated' },
  { value: 'overwhelmed', label: 'Overwhelmed', face: '😩', tone: 'unpleasant', apple: 'overwhelmed' },
  { value: 'anxious', label: 'Anxious', face: '😰', tone: 'unpleasant', apple: 'anxious' },
  { value: 'lonely', label: 'Lonely', face: '😔', tone: 'unpleasant', apple: 'lonely' },
  { value: 'tired', label: 'Tired', face: '🥱', tone: 'unpleasant', apple: 'drained' },
] as const;

export type Feeling = (typeof FEELINGS)[number]['value'];

export type LogFormValues = {
  exercise: string;
  steps: string;
  sleep: string;
  water: string;
  notes: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  feelings: Feeling[];
};

export type LogFields = {
  exercise_minutes: number | null;
  steps: number | null;
  sleep_hours: number | null;
  water_liters: number | null;
  notes: string | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  feelings: Feeling[] | null;
};

export const EMPTY_FORM: LogFormValues = {
  exercise: '',
  steps: '',
  sleep: '',
  water: '',
  notes: '',
  mood: null,
  energy: null,
  stress: null,
  feelings: [],
};

export const NOTES_MAX = 500;

const NUMBER_FIELDS = {
  exercise: { label: 'Exercise', unit: 'minutes', min: 0, max: 1440, whole: true },
  steps: { label: 'Steps', unit: 'steps', min: 0, max: 200000, whole: true },
  sleep: { label: 'Sleep', unit: 'hours', min: 0, max: 24, whole: false },
  water: { label: 'Water', unit: 'liters', min: 0, max: 20, whole: false },
} as const;

type NumberField = keyof typeof NUMBER_FIELDS;

// '' -> null, '0' -> 0, anything invalid -> an error message.
export function parseOptionalNumber(field: NumberField, raw: string): { value: number | null; error: string | null } {
  const cfg = NUMBER_FIELDS[field];
  const text = raw.trim();
  if (text === '') return { value: null, error: null };
  const n = Number(text);
  if (!Number.isFinite(n)) return { value: null, error: `${cfg.label} must be a number.` };
  if (cfg.whole && !Number.isInteger(n)) return { value: null, error: `${cfg.label} must be whole ${cfg.unit}.` };
  if (n < cfg.min || n > cfg.max) {
    return { value: null, error: `${cfg.label} must be between ${cfg.min} and ${cfg.max} ${cfg.unit}.` };
  }
  return { value: n, error: null };
}

function validRating(n: number | null): number | null {
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// Returns the columns to save, or a list of problems for the user.
export function buildLogFields(values: LogFormValues): { fields: LogFields | null; errors: string[] } {
  const errors: string[] = [];
  const parsed = {} as Record<NumberField, number | null>;
  for (const field of Object.keys(NUMBER_FIELDS) as NumberField[]) {
    const { value, error } = parseOptionalNumber(field, values[field]);
    if (error) errors.push(error);
    parsed[field] = value;
  }
  const notes = values.notes.trim();
  if (notes.length > NOTES_MAX) errors.push(`Notes must be ${NOTES_MAX} characters or fewer.`);
  if (errors.length) return { fields: null, errors };

  const allowed = new Set<string>(FEELINGS.map((f) => f.value));
  const feelings = [...new Set(values.feelings)].filter((f) => allowed.has(f));

  return {
    fields: {
      exercise_minutes: parsed.exercise,
      steps: parsed.steps,
      sleep_hours: parsed.sleep,
      water_liters: parsed.water,
      notes: notes === '' ? null : notes,
      mood: validRating(values.mood),
      energy: validRating(values.energy),
      stress: validRating(values.stress),
      feelings: feelings.length ? feelings : null,
    },
    errors: [],
  };
}

// A saved row back into form text, so an existing day opens for editing.
export function formFromRow(
  row: (Partial<Omit<LogFields, 'feelings'>> & { feelings?: string[] | null }) | null,
): LogFormValues {
  if (!row) return { ...EMPTY_FORM };
  const allowed = new Set<string>(FEELINGS.map((f) => f.value));
  const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
  return {
    exercise: text(row.exercise_minutes),
    steps: text(row.steps),
    sleep: text(row.sleep_hours),
    water: text(row.water_liters),
    notes: row.notes ?? '',
    mood: row.mood ?? null,
    energy: row.energy ?? null,
    stress: row.stress ?? null,
    feelings: (row.feelings ?? []).filter((f): f is Feeling => allowed.has(f)),
  };
}

export function hasAnyValue(fields: LogFields): boolean {
  return Object.values(fields).some((v) => v !== null);
}
