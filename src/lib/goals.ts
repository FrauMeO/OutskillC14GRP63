// Single source of truth for goal types. `value` is what is stored in goals.goal_type,
// and matches the metric keys the dashboard uses.
export type GoalType = 'exercise' | 'sleep' | 'water';

export type GoalConfig = {
  value: GoalType;
  label: string;
  unit: string; // stored in goals.unit
  min: number;
  max: number;
  step: number;
  suggested: number;
  accent: string; // Tailwind class, matches the dashboard bar color
};

export const GOAL_TYPES: GoalConfig[] = [
  { value: 'exercise', label: 'Exercise', unit: 'minutes/day', min: 1, max: 600, step: 5, suggested: 30, accent: 'bg-ember' },
  { value: 'sleep', label: 'Sleep', unit: 'hours/night', min: 1, max: 24, step: 0.5, suggested: 8, accent: 'bg-dusk' },
  { value: 'water', label: 'Water intake', unit: 'liters/day', min: 0.1, max: 10, step: 0.1, suggested: 2.5, accent: 'bg-current' },
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
