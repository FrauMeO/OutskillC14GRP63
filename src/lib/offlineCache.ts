// Read-only copy of the signed-in person's own recent days, so the Dashboard still opens with no
// signal. Replaced on every successful Dashboard load; cleared on sign-out and account deletion.
//
// PRIVACY: only the person's own logs, goals and first name are stored, at most 30 days of logs.
// A response that contains any row with a different user_id is not cached at all. Shared data
// (the Following pages) never goes through here. See docs/low-data-report.md.
import { addDays } from './dashboard';
import type { KV } from './idb';

export const CACHE_DAYS = 30;
const KEY = 'dashboard';

export type CachedRow = Record<string, unknown> & { log_date: string };

export type DashboardSnapshot = {
  ownerId: string;
  savedAt: string; // ISO timestamp
  todayIso: string;
  name: string | null;
  autoReflection: boolean;
  /** The last seven days, in full. */
  rows: CachedRow[];
  /** The last 30 days, category fields only (feeds the weekly rhythm). */
  streakRows: CachedRow[];
  goals: { goal_type: string; target_value: unknown }[];
};

export type SnapshotInput = {
  name: string | null;
  autoReflection: boolean;
  rows: CachedRow[];
  streakRows: CachedRow[];
  goals: { goal_type: string; target_value: unknown }[];
};

export type CacheStore = KV<DashboardSnapshot>;

/** True when no row carries anyone else's user id. Rows without a user_id are the person's own (RLS). */
export function allRowsOwnedBy(rows: Record<string, unknown>[], userId: string): boolean {
  return rows.every((r) => r.user_id === undefined || r.user_id === null || r.user_id === userId);
}

function slim(rows: CachedRow[], oldest: string): CachedRow[] {
  return rows
    .filter((r) => r.log_date >= oldest)
    .map((r) => {
      const { user_id: _u, id: _i, ...rest } = r;
      void _u;
      void _i;
      return rest as CachedRow;
    });
}

/** Null when the data must not be cached (it contains another user's id). */
export function buildSnapshot(ownerId: string, input: SnapshotInput, todayIso: string, now: Date = new Date()): DashboardSnapshot | null {
  if (!allRowsOwnedBy(input.rows, ownerId) || !allRowsOwnedBy(input.streakRows, ownerId)) return null;
  const oldest = addDays(todayIso, -(CACHE_DAYS - 1));
  return {
    ownerId,
    savedAt: now.toISOString(),
    todayIso,
    name: input.name,
    autoReflection: input.autoReflection,
    rows: slim(input.rows, oldest),
    streakRows: slim(input.streakRows, oldest),
    goals: input.goals.map((g) => ({ goal_type: g.goal_type, target_value: g.target_value })),
  };
}

/** Replaces whatever was cached (one slot, never appended). Returns false when nothing was stored. */
export async function replaceCache(store: CacheStore, ownerId: string, input: SnapshotInput, todayIso: string): Promise<boolean> {
  const snap = buildSnapshot(ownerId, input, todayIso);
  if (!snap) return false;
  await store.put(KEY, snap);
  return true;
}

/** The cached view for this person only; another person's leftovers are ignored and removed. */
export async function loadCache(store: CacheStore, ownerId: string): Promise<DashboardSnapshot | undefined> {
  const snap = await store.get(KEY);
  if (!snap) return undefined;
  if (snap.ownerId !== ownerId) {
    await store.clear();
    return undefined;
  }
  return snap;
}
