// Browser wiring for the offline queue and the read-only cache: the real IndexedDB stores, the real
// Supabase client, and the events (app start, 'online', sign-in, sign-out). The logic being
// wired is in offlineQueue.ts and offlineCache.ts, which are unit tested.
import { supabase } from './supabase';
import { idbStore } from './idb';
import {
  backoffDelay,
  enqueue,
  flushQueue,
  listPending,
  type FlushResult,
  type PendingEntry,
  type UpsertClient,
} from './offlineQueue';
import { loadCache, replaceCache, type CacheStore, type DashboardSnapshot, type SnapshotInput } from './offlineCache';

export const QUEUE_EVENT = 'byp-queue-change';

const pendingStore = idbStore<PendingEntry>('pending');
const cacheStore: CacheStore = idbStore<DashboardSnapshot>('cache');

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Keeps a day on this device. Returns false if the device could not store it (then the caller shows its normal error). */
export async function queueHabitLog(userId: string, payload: PendingEntry['payload']): Promise<boolean> {
  try {
    await enqueue(pendingStore, userId, payload);
    notify();
    return true;
  } catch {
    return false;
  }
}

export async function pendingCount(userId: string): Promise<number> {
  try {
    return (await listPending(pendingStore, userId)).length;
  } catch {
    return 0;
  }
}

export async function pendingEntries(userId: string): Promise<PendingEntry[]> {
  try {
    return await listPending(pendingStore, userId);
  } catch {
    return [];
  }
}

let inFlight: Promise<FlushResult | null> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryRound = 0;

/** Uploads pending days now (one at a time; a second call while one is running shares its result). */
export function syncNow(): Promise<FlushResult | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return null;
      const result = await flushQueue(supabase as unknown as UpsertClient, userId, { store: pendingStore });
      notify();
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (result.status === 'done' || result.status === 'empty') retryRound = 0;
      else if (result.retryable && navigator.onLine) {
        // Bounded: the wait grows to 15 minutes, and stops entirely for days the server rejected.
        retryTimer = setTimeout(() => void syncNow(), backoffDelay(retryRound++, { baseMs: 60_000, capMs: 15 * 60_000 }));
      }
      return result;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Sign-out and account deletion: nothing health-related stays on the device. */
export async function clearOfflineData(): Promise<void> {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  try {
    await Promise.all([pendingStore.clear(), cacheStore.clear()]);
  } catch {
    // Nothing stored, or storage unavailable.
  }
  notify();
}

export async function saveDashboardCache(userId: string, input: SnapshotInput, todayIso: string): Promise<void> {
  try {
    await replaceCache(cacheStore, userId, input, todayIso);
  } catch {
    // The cache is a convenience; never block the Dashboard on it.
  }
}

export async function loadDashboardCache(userId: string): Promise<DashboardSnapshot | undefined> {
  try {
    return await loadCache(cacheStore, userId);
  } catch {
    return undefined;
  }
}

let started = false;

/** Call once at app start (main.tsx). Safe to call again. */
export function startOfflineSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  // Do not await Supabase calls inside this callback (it can deadlock); defer them.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') setTimeout(() => void clearOfflineData(), 0);
    else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') setTimeout(() => void syncNow(), 0);
  });
}
