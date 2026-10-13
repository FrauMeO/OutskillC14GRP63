// Single source of truth for goal types. `value` is what is stored in goals.goal_type and in
// the goals_goal_type_check constraint (migration 0006), and matches the habit_logs column the
// dashboard compares it with (`field`).
export type GoalType = 'exercise' | 'steps' | 'stand_hours' | 'active_calories' | 'sleep' | 'water' | 'calories_consumed';

export type GoalCategory = 'exercise' | 'sleep' | 'nutrition';

export type GoalConfig = {
  value: GoalType;
  label: string;
  category: GoalCategory;
  field: 'exercise_minutes' | 'steps' | 'stand_hours' | 'active_calories' | 'sleep_hours' | 'water_liters' | 'calories_consumed';
  unit: string; // stored in goals.unit
  short: string; // unit shown next to values on the dashboard
  min: number;
  max: number;
  step: number;
  suggested: number;
  accent: string; // Tailwind class for bars and rings
};

export const GOAL_TYPES: GoalConfig[] = [
  { value: 'exercise', label: 'Exercise', category: 'exercise', field: 'exercise_minutes', unit: 'minutes/day', short: 'min', min: 1, max: 600, step: 5, suggested: 30, accent: 'bg-ember' },
  { value: 'steps', label: 'Steps', category: 'exercise', field: 'steps', unit: 'steps/day', short: 'steps', min: 100, max: 100000, step: 500, suggested: 8000, accent: 'bg-ember' },
  { value: 'stand_hours', label: 'Stand hours', category: 'exercise', field: 'stand_hours', unit: 'hours/day', short: 'h', min: 1, max: 24, step: 1, suggested: 12, accent: 'bg-ember' },
  { value: 'active_calories', label: 'Active calories', category: 'exercise', field: 'active_calories', unit: 'kcal/day', short: 'kcal', min: 10, max: 5000, step: 10, suggested: 500, accent: 'bg-ember' },
  { value: 'sleep', label: 'Sleep', category: 'sleep', field: 'sleep_hours', unit: 'hours/night', short: 'h', min: 1, max: 24, step: 0.5, suggested: 8, accent: 'bg-dusk' },
  { value: 'water', label: 'Water', category: 'nutrition', field: 'water_liters', unit: 'liters/day', short: 'L', min: 0.1, max: 10, step: 0.1, suggested: 2.5, accent: 'bg-current' },
  { value: 'calories_consumed', label: 'Calories eaten', category: 'nutrition', field: 'calories_consumed', unit: 'kcal/day', short: 'kcal', min: 500, max: 10000, step: 50, suggested: 2000, accent: 'bg-sprout' },
];

export function goalConfig(type: string): GoalConfig | undefined {
  return GOAL_TYPES.find((g) => g.value === type);
}

export function formatTarget(value: number, unit: string): string {
  return `${Number(value)} ${unit}`;
}

// Returns an error message, or null if the value is valid for this type.
export function validateTarget(cfg: GoalConfig, raw: string): string | null {
  if (raw.trim() === '') return `Enter a target for ${cfg.label.toLowerCase()}.`;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a number.';
  if (n < cfg.min || n > cfg.max) return `${cfg.label} target must be between ${cfg.min} and ${cfg.max} ${cfg.unit}.`;
  return null;
}
