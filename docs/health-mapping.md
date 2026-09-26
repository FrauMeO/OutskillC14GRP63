# Health data mapping: Eat, Sleep, Move, Balance

How each measure in the app corresponds to Apple Health and to Google. The code version, checked by
tests, is `src/lib/healthMapping.ts`. "App only" means the platform has no equivalent, so the value
is logged in Personal Health Manager itself.

Platforms (checked 2026-09-26):
- **Apple Health** (HealthKit, iPhone and Apple Watch). On the phone only; this app reads it from
  the Health app's export file. Includes State of Mind (mood and feelings) and PHQ-9 results.
- **Google Health Connect** (Android). On the phone only. No mood, emotion or stress records.
- **Google Health API** (web API with sign-in, Fitbit and Google Health app data). A web app can
  connect to it directly. Has a Moods data type (details to confirm before building).
- Google Fit is deprecated in 2026 and is not used.

## Eat: food and water

| Measure | Apple Health | Health Connect | Google Health API |
|---|---|---|---|
| Water (L) | DietaryWater | HydrationRecord | Hydration Log |
| Calories eaten (kcal) | DietaryEnergyConsumed | NutritionRecord (energy) | Nutrition Log |

## Sleep: sleep and rest

| Measure | Apple Health | Health Connect | Google Health API |
|---|---|---|---|
| Sleep (h) | SleepAnalysis: Core, Deep, REM, Unspecified | SleepSessionRecord stages: sleeping, light, deep, REM | Sleep |
| Time in bed (h) | SleepAnalysis: InBed | SleepSessionRecord (start to end) | Sleep |
| Awake in bed (min) | SleepAnalysis: Awake | SleepSessionRecord stages: awake | Sleep |

## Move: movement, your way

| Measure | Apple Health | Health Connect | Google Health API |
|---|---|---|---|
| Exercise (min) | AppleExerciseTime | ExerciseSessionRecord | Active Minutes |
| Steps | StepCount (one device, never added together) | StepsRecord | Steps |
| Stand hours | AppleStandHour (Stood) | App only | App only |
| Active calories (kcal) | ActiveEnergyBurned | ActiveCaloriesBurnedRecord | Active Energy Burned |

## Balance: stress, mood and how you feel

| Measure | Apple Health | Health Connect | Google Health API |
|---|---|---|---|
| Mood (1 to 5) | State of Mind, daily mood (valence -1 to 1 in five equal bands) | App only | Moods (to confirm) |
| Feelings | State of Mind labels, one to one: frustrated, overwhelmed, calm, peaceful, confident, grateful | App only | App only |
| Energy (1 to 5) | App only | App only | App only |
| Stress (1 to 5) | App only | App only | App only |
| Reflection (PHQ-9) | Scored assessment (PHQ-9), with consent; not exported today | App only | App only |

## Rules that apply to every platform
- One row per person per local day. Sleep counts toward the day you wake up.
- Blank means "not logged", never zero.
- When two devices report the same thing (for example steps from a watch and a phone), count one
  source, never both.
- Energy and stress are always the person's own words in the app; no device guesses them.

## Status
- Apple Health: importer built and tested for Eat, Sleep and Move (`scripts/import-apple-health.mjs`).
  State of Mind import is mapped but not built.
- Google: mapped only. The Google Health API is the practical route for a web app; Health Connect
  needs an Android app.

Sources: [Apple HealthKit](https://developer.apple.com/documentation/healthkit),
[Apple: wellbeing APIs (WWDC24)](https://developer.apple.com/videos/play/wwdc2024/10109/),
[Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types),
[Google Health API data types](https://developers.google.com/health/data-types),
[Google Fit migration](https://developer.android.com/health-and-fitness/health-connect/migration/fit).
