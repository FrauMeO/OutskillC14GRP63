// Offline-first logging. When a day cannot be saved (no connection, or the request fails the way a
// weak signal does), the entry is kept on this device and uploaded later.
//
// PRIVACY (health data on the device; see docs/low-data-report.md):
//  - Only what the person themselves logged is stored here: their own habit_logs upserts.
//  - Every entry records the signed-in user's id as its owner, and is uploaded only while that same
//    person is signed in. Nothing here ever holds another person's data (the Following pages and
//    shared data are never queued or cached).
//  - The queue is cleared on sign-out and after account deletion (clearOfflineData in offlineSync.ts).
//
// The pure parts (merge, backoff, retry classification, flush planning) are unit tested with an
// injected in-memory store. The IndexedDB store lives in idb.ts.
import type { KV } from './idb';

/** One pending habit_log upsert. `payload` is the row exactly as it would have been upserted. */
export type PendingEntry = {
  logDate: string;
  ownerId: string;
  payload: Record<string, unknown> & { log_date: string };
  queuedAt: number;
};

export type QueueStore = KV<PendingEntry>;

export const UPLOAD_PENDING_TEXT = 'Saved on this device. It will upload when you are back online.';

// ---- pure helpers -------------------------------------------------------------------------

/** Latest write wins, per day. queuedAt only ever moves forward so a newer write is never mistaken for an older one. */
export function mergeEntry(existing: PendingEntry | undefined, incoming: PendingEntry): PendingEntry {
  if (!existing) return incoming;
  return { ...incoming, queuedAt: Math.max(incoming.queuedAt, existing.queuedAt + 1) };
}

/** Exponential backoff with equal jitter: between half and all of min(cap, base * 2^attempt). attempt starts at 0. */
export function backoffDelay(attempt: number, opts: { baseMs?: number; capMs?: number } = {}, random: () => number = Math.random): number {
  const base = opts.baseMs ?? 1000;
  const cap = opts.capMs ?? 30_000;
  const ceiling = Math.min(cap, base * 2 ** Math.max(0, attempt));
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

export type SendError = { message?: string; code?: string; status?: number } | null | undefined;

/** The request never reached the server (offline, dropped, timed out). */
export function isNetworkError(err: SendError | unknown): boolean {
  if (!err) return false;
  const e = err as { message?: unknown; name?: unknown; status?: unknown };
  if (typeof e.status === 'number' && e.status > 0) return false;
  const text = `${String(e.name ?? '')} ${String(e.message ?? err)}`;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|aborted|offline|err_internet/i.test(text);
}

/** Worth trying again later: a network failure, a server fault, a timeout or rate limit. Not a rejection of the data. */
export function isRetryable(err: SendError): boolean {
  if (!err) return false;
  if (isNetworkError(err)) return true;
  const status = err.status;
  if (typeof status === 'number') return status >= 500 || status === 408 || status === 429;
  // PostgREST errors have a code; PGRST3xx/Postgres 08xxx/53xxx/57xxx are connection or resource trouble.
  return typeof err.code === 'string' && /^(08|53|57|PGRST30)/.test(err.code);
}

/** Which pending entries may be uploaded for this person. Entries owned by anyone else are never sent. */
export function planFlush(pending: PendingEntry[], userId: string): { send: PendingEntry[]; foreign: PendingEntry[] } {
  const send: PendingEntry[] = [];
  const foreign: PendingEntry[] = [];
  for (const p of [...pending].sort((a, b) => a.logDate.localeCompare(b.logDate))) {
    (p.ownerId === userId ? send : foreign).push(p);
  }
  return { send, foreign };
}

// ---- store operations -----------------------------------------------------------------------

export async function enqueue(store: QueueStore, ownerId: string, payload: PendingEntry['payload'], now = Date.now()): Promise<void> {
  const key = payload.log_date;
  const existing = await store.get(key);
  await store.put(key, mergeEntry(existing, { logDate: key, ownerId, payload, queuedAt: now }));
}

export async function listPending(store: QueueStore, ownerId?: string): Promise<PendingEntry[]> {
  const all = await store.getAll();
  const mine = ownerId ? all.filter((p) => p.ownerId === ownerId) : all;
  return mine.sort((a, b) => a.logDate.localeCompare(b.logDate));
}

/** Pending days laid over rows loaded from the cache, so an offline view shows what was just logged. */
export function overlayPending<R extends { log_date: string }>(rows: R[], pending: PendingEntry[]): R[] {
  const byDate = new Map(rows.map((r) => [r.log_date, r]));
  for (const p of pending) {
    byDate.set(p.logDate, { ...(byDate.get(p.logDate) ?? {}), ...p.payload } as unknown as R);
  }
  return [...byDate.values()].sort((a, b) => a.log_date.localeCompare(b.log_date));
}

// ---- flush ----------------------------------------------------------------------------------

/** The slice of the Supabase client that flushQueue uses (injected, so tests need no network). */
export type UpsertClient = {
  from(table: 'habit_logs'): {
    upsert(
      rows: Record<string, unknown>[],
      options: { onConflict: string },
    ): { select(columns: string): PromiseLike<{ data: { log_date: string }[] | null; error: SendError }> };
  };
};

export type FlushDeps = {
  store: QueueStore;
  isOnline?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Total tries for the batched request, including the first. */
  maxAttempts?: number;
  baseDelayMs?: number;
  capDelayMs?: number;
};

export type FlushResult = {
  status: 'empty' | 'offline' | 'done' | 'partial' | 'failed';
  uploaded: number;
  remaining: number;
  error?: string;
  /** True when trying again later could succeed (connection or server trouble, not a rejected day). */
  retryable?: boolean;
};

/**
 * Uploads this person's pending days in ONE batched upsert, retrying with backoff and jitter
 * (bounded by maxAttempts). Only days the server confirmed are removed, and only if they were not
 * rewritten while the request was in flight. If the server rejects the batch (not a connection
 * problem), each day is tried alone once so one bad day cannot hold up the others; rejected days
 * stay on the device.
 */
export async function flushQueue(client: UpsertClient, userId: string, deps: FlushDeps): Promise<FlushResult> {
  const { store } = deps;
  const isOnline = deps.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = Math.max(1, deps.maxAttempts ?? 5);
  const backoff = { baseMs: deps.baseDelayMs ?? 1000, capMs: deps.capDelayMs ?? 30_000 };

  const { send } = planFlush(await store.getAll(), userId);
  if (send.length === 0) return { status: 'empty', uploaded: 0, remaining: 0 };
  if (!isOnline()) return { status: 'offline', uploaded: 0, remaining: send.length };

  const attemptUpload = async (batch: PendingEntry[]) => {
    const { data, error } = await client
      .from('habit_logs')
      .upsert(batch.map((b) => b.payload), { onConflict: 'user_id,log_date' })
      .select('log_date');
    return { confirmed: new Set((data ?? []).map((d) => d.log_date)), error };
  };

  // Remove only what the server confirmed and only if the stored entry is still the version we sent.
  const removeConfirmed = async (sent: PendingEntry[], confirmed: Set<string>) => {
    const gone: string[] = [];
    for (const s of sent) {
      if (!confirmed.has(s.logDate)) continue;
      const now = await store.get(s.logDate);
      if (now && now.queuedAt === s.queuedAt) gone.push(s.logDate);
    }
    if (gone.length) await store.delete(gone);
    return gone.length;
  };

  let lastError: SendError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let outcome: Awaited<ReturnType<typeof attemptUpload>>;
    try {
      outcome = await attemptUpload(send);
    } catch (e) {
      outcome = { confirmed: new Set(), error: { message: e instanceof Error ? e.message : String(e) } };
    }
    if (!outcome.error) {
      const uploaded = await removeConfirmed(send, outcome.confirmed);
      const remaining = send.length - uploaded;
      // A success response that confirmed nothing must not be treated as done.
      return remaining === 0 ? { status: 'done', uploaded, remaining } : { status: 'partial', uploaded, remaining };
    }
    lastError = outcome.error;

    if (!isRetryable(outcome.error)) {
      if (send.length > 1) return flushOneByOne(send, attemptUpload, removeConfirmed, outcome.error);
      return { status: 'failed', uploaded: 0, remaining: send.length, error: outcome.error.message, retryable: false };
    }
    if (attempt < maxAttempts - 1) {
      await sleep(backoffDelay(attempt, backoff, deps.random));
      if (!isOnline()) return { status: 'offline', uploaded: 0, remaining: send.length };
    }
  }
  return { status: 'failed', uploaded: 0, remaining: send.length, error: lastError?.message, retryable: true };
}

async function flushOneByOne(
  send: PendingEntry[],
  attemptUpload: (batch: PendingEntry[]) => Promise<{ confirmed: Set<string>; error: SendError }>,
  removeConfirmed: (sent: PendingEntry[], confirmed: Set<string>) => Promise<number>,
  batchError: SendError,
): Promise<FlushResult> {
  let uploaded = 0;
  for (const entry of send) {
    try {
      const { confirmed, error } = await attemptUpload([entry]);
      if (!error) uploaded += await removeConfirmed([entry], confirmed);
    } catch {
      // Stays queued; the next flush tries again.
    }
  }
  const remaining = send.length - uploaded;
  return remaining === 0
    ? { status: 'done', uploaded, remaining }
    : { status: uploaded > 0 ? 'partial' : 'failed', uploaded, remaining, error: batchError?.message, retryable: false };
}
