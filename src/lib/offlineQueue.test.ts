import { describe, expect, it } from 'vitest';
import { memoryStore } from './idb';
import {
  backoffDelay,
  enqueue,
  flushQueue,
  isNetworkError,
  isRetryable,
  listPending,
  mergeEntry,
  overlayPending,
  planFlush,
  type PendingEntry,
  type SendError,
  type UpsertClient,
} from './offlineQueue';

const ME = 'user-me';
const OTHER = 'user-other';
const row = (log_date: string, extra: Record<string, unknown> = {}) => ({ log_date, source: 'manual', ...extra });

function fakeClient(script: Array<{ error?: SendError; throws?: Error; confirm?: 'all' | 'none' | string[] }>) {
  const calls: Record<string, unknown>[][] = [];
  const client: UpsertClient = {
    from: () => ({
      upsert: (rows) => {
        calls.push(rows);
        const step = script[Math.min(calls.length - 1, script.length - 1)];
        return {
          select: async () => {
            if (step.throws) throw step.throws;
            if (step.error) return { data: null, error: step.error };
            const dates = rows.map((r) => String(r.log_date));
            const confirmed = step.confirm === 'none' ? [] : Array.isArray(step.confirm) ? step.confirm : dates;
            return { data: confirmed.map((log_date) => ({ log_date })), error: null };
          },
        };
      },
    }),
  };
  return { client, calls };
}

const noSleep = async () => {};
const deps = (store: ReturnType<typeof memoryStore<PendingEntry>>, extra = {}) => ({ store, sleep: noSleep, isOnline: () => true, random: () => 0.5, ...extra });

describe('mergeEntry / enqueue: latest write wins per day', () => {
  it('replaces the payload for the same day and keeps one entry', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-10', { water_liters: 1 }), 1000);
    await enqueue(store, ME, row('2026-10-10', { water_liters: 2.5 }), 2000);
    const all = await listPending(store);
    expect(all).toHaveLength(1);
    expect(all[0].payload.water_liters).toBe(2.5);
  });

  it('keeps different days separate (control)', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-10'), 1);
    await enqueue(store, ME, row('2026-10-11'), 2);
    expect((await listPending(store)).map((p) => p.logDate)).toEqual(['2026-10-10', '2026-10-11']);
  });

  it('queuedAt moves forward even if the clock does not', () => {
    const a: PendingEntry = { logDate: 'd', ownerId: ME, payload: row('d'), queuedAt: 500 };
    const merged = mergeEntry(a, { ...a, queuedAt: 400 });
    expect(merged.queuedAt).toBeGreaterThan(500);
  });

  it('listPending(owner) hides other owners', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, OTHER, row('2026-10-01'), 1);
    await enqueue(store, ME, row('2026-10-02'), 2);
    expect((await listPending(store, ME)).map((p) => p.logDate)).toEqual(['2026-10-02']);
  });
});

describe('backoffDelay', () => {
  it('grows with the attempt, bounded by the cap, with jitter between half and full', () => {
    const lo = (n: number) => backoffDelay(n, { baseMs: 1000, capMs: 30_000 }, () => 0);
    const hi = (n: number) => backoffDelay(n, { baseMs: 1000, capMs: 30_000 }, () => 1);
    expect(lo(0)).toBe(500);
    expect(hi(0)).toBe(1000);
    expect(hi(2)).toBe(4000);
    expect(lo(2)).toBe(2000);
    expect(hi(20)).toBe(30_000); // capped
    expect(lo(20)).toBe(15_000);
  });
});

describe('error classification', () => {
  it('network failures are retryable', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isRetryable({ message: 'Failed to fetch' })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
    expect(isRetryable({ status: 429 })).toBe(true);
  });
  it('a rejected row is not retryable (control)', () => {
    expect(isRetryable({ status: 400, message: 'bad' })).toBe(false);
    expect(isRetryable({ code: '42501', message: 'RLS' })).toBe(false);
    expect(isRetryable({ code: '23514', message: 'check violation' })).toBe(false);
  });
});

describe('planFlush', () => {
  it('sends only the signed-in person’s days, oldest first', () => {
    const mk = (d: string, o: string): PendingEntry => ({ logDate: d, ownerId: o, payload: row(d), queuedAt: 1 });
    const { send, foreign } = planFlush([mk('2026-10-03', ME), mk('2026-10-01', ME), mk('2026-10-02', OTHER)], ME);
    expect(send.map((s) => s.logDate)).toEqual(['2026-10-01', '2026-10-03']);
    expect(foreign.map((s) => s.logDate)).toEqual(['2026-10-02']);
  });
});

describe('flushQueue', () => {
  it('empty queue: no request', async () => {
    const store = memoryStore<PendingEntry>();
    const { client, calls } = fakeClient([{}]);
    expect((await flushQueue(client, ME, deps(store))).status).toBe('empty');
    expect(calls).toHaveLength(0);
  });

  it('uploads all days in ONE request and empties the queue', async () => {
    const store = memoryStore<PendingEntry>();
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) await enqueue(store, ME, row(d));
    const { client, calls } = fakeClient([{}]);
    const res = await flushQueue(client, ME, deps(store));
    expect(res).toMatchObject({ status: 'done', uploaded: 3, remaining: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(3);
    expect(store.size()).toBe(0);
  });

  it('never sends the payload with a user_id of its own, and never sends another owner’s day', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    await enqueue(store, OTHER, row('2026-10-02'));
    const { client, calls } = fakeClient([{}]);
    await flushQueue(client, ME, deps(store));
    expect(calls[0].map((r) => r.log_date)).toEqual(['2026-10-01']);
    expect((await listPending(store)).map((p) => p.ownerId)).toEqual([OTHER]); // left alone, not deleted, not sent
  });

  it('offline: does not send and keeps everything', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client, calls } = fakeClient([{}]);
    const res = await flushQueue(client, ME, deps(store, { isOnline: () => false }));
    expect(res.status).toBe('offline');
    expect(calls).toHaveLength(0);
    expect(store.size()).toBe(1);
  });

  it('retries a network failure with backoff and then succeeds', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client, calls } = fakeClient([{ error: { message: 'Failed to fetch' } }, { error: { status: 503 } }, {}]);
    const waits: number[] = [];
    const res = await flushQueue(client, ME, deps(store, { sleep: async (ms: number) => void waits.push(ms) }));
    expect(res.status).toBe('done');
    expect(calls).toHaveLength(3);
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeGreaterThan(waits[0]); // grows
    expect(store.size()).toBe(0);
  });

  it('gives up after maxAttempts (bounded) and keeps the data', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client, calls } = fakeClient([{ error: { message: 'Failed to fetch' } }]);
    const res = await flushQueue(client, ME, deps(store, { maxAttempts: 3 }));
    expect(res).toMatchObject({ status: 'failed', retryable: true });
    expect(calls).toHaveLength(3);
    expect(store.size()).toBe(1);
  });

  it('a thrown fetch error counts as a network failure', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client } = fakeClient([{ throws: new TypeError('Failed to fetch') }, {}]);
    expect((await flushQueue(client, ME, deps(store))).status).toBe('done');
  });

  it('removes only what the server confirmed', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    await enqueue(store, ME, row('2026-10-02'));
    const { client } = fakeClient([{ confirm: ['2026-10-01'] }]);
    const res = await flushQueue(client, ME, deps(store));
    expect(res).toMatchObject({ status: 'partial', uploaded: 1, remaining: 1 });
    expect((await listPending(store)).map((p) => p.logDate)).toEqual(['2026-10-02']);
  });

  it('a success that confirms nothing is not treated as done (control)', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client } = fakeClient([{ confirm: 'none' }]);
    const res = await flushQueue(client, ME, deps(store));
    expect(res.status).toBe('partial');
    expect(store.size()).toBe(1);
  });

  it('keeps a day that was rewritten while the upload was in flight', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01', { water_liters: 1 }), 100);
    const client: UpsertClient = {
      from: () => ({
        upsert: (rows) => ({
          select: async () => {
            await enqueue(store, ME, row('2026-10-01', { water_liters: 3 }), 200); // person saves again meanwhile
            return { data: rows.map((r) => ({ log_date: String(r.log_date) })), error: null };
          },
        }),
      }),
    };
    const res = await flushQueue(client, ME, deps(store));
    expect(res.status).toBe('partial');
    const left = await listPending(store);
    expect(left).toHaveLength(1);
    expect(left[0].payload.water_liters).toBe(3);
  });

  it('a rejected day does not block the others: tried one by one, the bad one stays', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    await enqueue(store, ME, row('2026-10-02', { mood: 99 }));
    await enqueue(store, ME, row('2026-10-03'));
    const client: UpsertClient = {
      from: () => ({
        upsert: (rows) => ({
          select: async () =>
            rows.some((r) => r.mood === 99)
              ? { data: null, error: { code: '23514', message: 'check violation' } }
              : { data: rows.map((r) => ({ log_date: String(r.log_date) })), error: null },
        }),
      }),
    };
    const res = await flushQueue(client, ME, deps(store));
    expect(res).toMatchObject({ status: 'partial', uploaded: 2, remaining: 1, retryable: false });
    expect((await listPending(store)).map((p) => p.logDate)).toEqual(['2026-10-02']);
  });

  it('a single rejected day is reported as failed, not retried forever', async () => {
    const store = memoryStore<PendingEntry>();
    await enqueue(store, ME, row('2026-10-01'));
    const { client, calls } = fakeClient([{ error: { code: '42501', message: 'RLS' } }]);
    const res = await flushQueue(client, ME, deps(store));
    expect(res).toMatchObject({ status: 'failed', retryable: false });
    expect(calls).toHaveLength(1);
    expect(store.size()).toBe(1);
  });
});

describe('overlayPending', () => {
  it('lays pending days over cached rows and adds new days', () => {
    const out = overlayPending(
      [{ log_date: '2026-10-10', water_liters: 1, mood: 3 }],
      [
        { logDate: '2026-10-10', ownerId: ME, payload: { log_date: '2026-10-10', water_liters: 2 }, queuedAt: 1 },
        { logDate: '2026-10-11', ownerId: ME, payload: { log_date: '2026-10-11', steps: 100 }, queuedAt: 1 },
      ],
    );
    expect(out).toEqual([
      { log_date: '2026-10-10', water_liters: 2, mood: 3 },
      { log_date: '2026-10-11', steps: 100 },
    ]);
  });
});
