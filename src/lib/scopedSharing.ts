import type { CareShareRow, ShareLevel } from './careShares';
export const SCOPE_PILLARS = ['eat', 'sleep', 'move', 'balance'] as const;
export type ScopePillar = typeof SCOPE_PILLARS[number];
export type PillarLevels = Record<ScopePillar, 'off' | ShareLevel>;
export type Cadence = 'live' | 'monthly';
export const SCOPE_NAMES = { eat: 'Drink', sleep: 'Sleep', move: 'Move', balance: 'Balance' };
export const SCOPE_LABELS = { off: 'Not shared', presence: 'Days logged, no values', summary: 'Number of days logged, no values', detail: 'Logged values' };
export function levelsOf(row: CareShareRow): PillarLevels {
  return row.pillar_levels ?? { eat: row.share_eat ? row.level ?? 'detail' : 'off', sleep: row.share_sleep ? row.level ?? 'detail' : 'off', move: row.share_move ? row.level ?? 'detail' : 'off', balance: row.share_balance ? row.level ?? 'detail' : 'off' };
}
export type ScopedReport = { cadence: Cadence; from: string; to: string; pillars: {
  pillar: ScopePillar; level: Exclude<PillarLevels[ScopePillar], 'off'>; days_logged: number;
  mood_logged?: boolean; feelings_logged?: boolean;
  entries?: { date: string; values?: Record<string, number>; mood_logged?: boolean; feelings_logged?: boolean }[];
  measures?: Record<string, { average: number; days: number }>;
}[] };
