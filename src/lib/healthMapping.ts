// How every measure in the app maps to Apple Health and to Google, pillar by pillar.
// Source of truth for importers (Apple today, Google later) and for design (Lovable). Checked by
// healthMapping.test.ts: every habit_logs measure appears exactly once, under the right pillar, and
// the Apple types match what scripts/import-apple-health.mjs actually reads.
//
// Platforms (checked 2026-09-26, sources in docs/health-mapping.md):
//  - Apple Health (HealthKit, iPhone and Watch; on-device, reached through the Health app export).
//  - Google Health Connect (Android, on-device). No mood, emotion or stress records.
//  - Google Health API (REST, OAuth; Fitbit and Google Health app data). Has a Moods data type.
//    Google Fit is deprecated in 2026 and is not used.
// null means the platform has no equivalent: the value is logged in the app only.
import type { Category } from './dashboard';

export type Mapping = {
  pillar: Category;
  column: string; // habit_logs column
  label: string;
  unit: string;
  apple: { type: string; values?: string[]; daily: string } | null;
  healthConnect: { record: string; field: string; daily: string } | null;
  googleHealthApi: { dataType: string; daily: string } | null;
};

export const MAPPINGS: Mapping[] = [
  // ---------- Eat: food and water ----------
  {
    pillar: 'nutrition', column: 'water_liters', label: 'Water', unit: 'L',
    apple: { type: 'HKQuantityTypeIdentifierDietaryWater', daily: 'sum of the day, mL or L converted to liters' },
    healthConnect: { record: 'HydrationRecord', field: 'volume', daily: 'sum of the day, in liters' },
    googleHealthApi: { dataType: 'Hydration Log', daily: 'sum of the day, in liters' },
  },
  {
    pillar: 'nutrition', column: 'calories_consumed', label: 'Calories eaten', unit: 'kcal',
    apple: { type: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', daily: 'sum of the day, kcal (kJ converted)' },
    healthConnect: { record: 'NutritionRecord', field: 'energy', daily: 'sum of the day, kcal' },
    googleHealthApi: { dataType: 'Nutrition Log', daily: 'sum of the day, kcal' },
  },

  // ---------- Sleep: sleep and rest ----------
  {
    pillar: 'sleep', column: 'sleep_hours', label: 'Sleep', unit: 'h',
    apple: {
      type: 'HKCategoryTypeIdentifierSleepAnalysis',
      values: ['AsleepCore', 'AsleepDeep', 'AsleepREM', 'AsleepUnspecified'],
      daily: 'time asleep, credited to the wake-up date (6 pm cutoff), one source per night',
    },
    healthConnect: {
      record: 'SleepSessionRecord',
      field: 'stages: SLEEPING, LIGHT, DEEP, REM',
      daily: 'time asleep, credited to the date the session ends',
    },
    googleHealthApi: { dataType: 'Sleep', daily: 'minutes asleep, credited to the wake-up date' },
  },
  {
    pillar: 'sleep', column: 'time_in_bed_hours', label: 'Time in bed', unit: 'h',
    apple: { type: 'HKCategoryTypeIdentifierSleepAnalysis', values: ['InBed'], daily: 'in-bed time, same rules as sleep' },
    healthConnect: { record: 'SleepSessionRecord', field: 'session start to end', daily: 'session length' },
    googleHealthApi: { dataType: 'Sleep', daily: 'time in bed' },
  },
  {
    pillar: 'sleep', column: 'awake_minutes', label: 'Awake in bed', unit: 'min',
    apple: { type: 'HKCategoryTypeIdentifierSleepAnalysis', values: ['Awake'], daily: 'awake minutes, same rules as sleep' },
    healthConnect: { record: 'SleepSessionRecord', field: 'stages: AWAKE, AWAKE_IN_BED', daily: 'awake minutes in the session' },
    googleHealthApi: { dataType: 'Sleep', daily: 'minutes awake' },
  },

  // ---------- Move: movement, your way ----------
  {
    pillar: 'exercise', column: 'exercise_minutes', label: 'Exercise', unit: 'min',
    apple: { type: 'HKQuantityTypeIdentifierAppleExerciseTime', daily: 'sum of the day' },
    healthConnect: { record: 'ExerciseSessionRecord', field: 'start to end', daily: 'sum of session minutes' },
    googleHealthApi: { dataType: 'Active Minutes', daily: 'sum of the day' },
  },
  {
    pillar: 'exercise', column: 'steps', label: 'Steps', unit: 'steps',
    apple: { type: 'HKQuantityTypeIdentifierStepCount', daily: 'Watch total if present, otherwise the larger source; never added together' },
    healthConnect: { record: 'StepsRecord', field: 'count', daily: 'aggregate count (Health Connect removes overlaps)' },
    googleHealthApi: { dataType: 'Steps', daily: 'sum of the day' },
  },
  {
    pillar: 'exercise', column: 'stand_hours', label: 'Stand hours', unit: 'h',
    apple: { type: 'HKCategoryTypeIdentifierAppleStandHour', values: ['Stood'], daily: 'count of hours marked Stood' },
    healthConnect: null,
    googleHealthApi: null,
  },
  {
    pillar: 'exercise', column: 'active_calories', label: 'Active calories', unit: 'kcal',
    apple: { type: 'HKQuantityTypeIdentifierActiveEnergyBurned', daily: 'sum of the day, kcal (kJ converted)' },
    healthConnect: { record: 'ActiveCaloriesBurnedRecord', field: 'energy', daily: 'sum of the day, kcal' },
    googleHealthApi: { dataType: 'Active Energy Burned', daily: 'sum of the day, kcal' },
  },

  // ---------- Balance: stress, mood and how you feel ----------
  {
    pillar: 'wellbeing', column: 'mood', label: 'Mood', unit: '1 to 5',
    apple: { type: 'HKStateOfMind', values: ['dailyMood'], daily: 'valence (-1 to 1) converted with valenceToMood' },
    healthConnect: null,
    googleHealthApi: { dataType: 'Moods', daily: 'to be confirmed: scale and access scope before building' },
  },
  {
    pillar: 'wellbeing', column: 'feelings', label: 'Feelings', unit: 'labels',
    apple: { type: 'HKStateOfMind', values: ['frustrated', 'overwhelmed', 'calm', 'peaceful', 'confident', 'grateful'], daily: 'labels match one to one (HKStateOfMind.Label)' },
    healthConnect: null,
    googleHealthApi: null,
  },
  { pillar: 'wellbeing', column: 'energy', label: 'Energy', unit: '1 to 5', apple: null, healthConnect: null, googleHealthApi: null },
  { pillar: 'wellbeing', column: 'stress', label: 'Stress', unit: '1 to 5', apple: null, healthConnect: null, googleHealthApi: null },
];

// Not a daily measure, but part of Balance: PHQ-9 results can be exchanged with Apple Health as
// HKScoredAssessment (PHQ-9), with the person's consent. Nothing is exported today.
export const REFLECTION_MAPPING = {
  column: 'reflections.phq9_score',
  apple: 'HKScoredAssessment (PHQ-9), iOS 18 or later',
  healthConnect: null,
  googleHealthApi: null,
} as const;

// Apple State of Mind valence (-1 very unpleasant to 1 very pleasant) to the app's 1 to 5 mood,
// in five equal bands. Apple's "dailyMood" kind is used; "momentaryEmotion" samples are not.
export function valenceToMood(valence: number): 1 | 2 | 3 | 4 | 5 {
  const v = Math.max(-1, Math.min(1, valence));
  return (Math.min(5, Math.floor(((v + 1) / 2) * 5) + 1)) as 1 | 2 | 3 | 4 | 5;
}
