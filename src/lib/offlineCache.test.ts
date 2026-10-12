import { describe, expect, it } from 'vitest';
import { memoryStore } from './idb';
import { allRowsOwnedBy, buildSnapshot, loadCache, replaceCache, type DashboardSnapshot, type SnapshotInput } from './offlineCache';

const ME = 'user-me';
const TODAY = '2026-10-12';

const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  name: 'Miah',
  autoReflection: false,
  rows: [{ log_date: '2026-10-12', user_id: ME, id: 'x', water_liters: 2 }],
  streakRows: [
    { log_date: '2026-10-12', user_id: ME, water_liters: 2 },
    { log_date: '2026-09-13', user_id: ME, water_liters: 1 }, // 29 days back: inside the window
    { log_date: '2026-09-12', user_id: ME, water_liters: 1 }, // 30 days back: outside
    { log_date: '2025-12-01', user_id: ME, water_liters: 1 },
  ],
  goals: [{ goal_type: 'water', target_value: 2 }],
  ...over,
});

describe('buildSnapshot', () => {
  it('keeps the last 30 days only, and strips ids', () => {
    const snap = buildSnapshot(ME, input(), TODAY)!;
    expect(snap.streakRows.map((r) => r.log_date)).toEqual(['2026-10-12', '2026-09-13']);
    expect(JSON.stringify(snap)).not.toContain('user_id');
    expect(JSON.stringify(snap)).not.toContain('"id"');
    expect(snap.ownerId).toBe(ME);
  });

  it('refuses to cache a response that contains another user’s id', () => {
    const bad = input({ streakRows: [{ log_date: TODAY, user_id: 'someone-else', water_liters: 1 }] });
    expect(buildSnapshot(ME, bad, TODAY)).toBeNull();
  });

  it('rows without a user_id (RLS-scoped selects) are accepted (control)', () => {
    expect(buildSnapshot(ME, input({ rows: [{ log_date: TODAY, water_liters: 1 }] }), TODAY)).not.toBeNull();
  });
});

describe('allRowsOwnedBy', () => {
  it('flags a single foreign row', () => {
    expect(allRowsOwnedBy([{ user_id: ME }, { user_id: 'x' }], ME)).toBe(false);
    expect(allRowsOwnedBy([{ user_id: ME }, {}], ME)).toBe(true);
  });
});

describe('replaceCache / loadCache', () => {
  it('replaces the previous snapshot rather than adding to it', async () => {
    const store = memoryStore<DashboardSnapshot>();
    await replaceCache(store, ME, input({ name: 'First' }), TODAY);
    await replaceCache(store, ME, input({ name: 'Second' }), TODAY);
    expect(store.size()).toBe(1);
    expect((await loadCache(store, ME))?.name).toBe('Second');
  });

  it('does not store anything for a response with another user’s data, and keeps the old snapshot', async () => {
    const store = memoryStore<DashboardSnapshot>();
    await replaceCache(store, ME, input({ name: 'Mine' }), TODAY);
    const stored = await replaceCache(store, ME, input({ rows: [{ log_date: TODAY, user_id: 'other' }] }), TODAY);
    expect(stored).toBe(false);
    expect((await loadCache(store, ME))?.name).toBe('Mine');
  });

  it('another person’s leftover cache is never shown, and is removed', async () => {
    const store = memoryStore<DashboardSnapshot>();
    await replaceCache(store, 'user-a', input(), TODAY);
    expect(await loadCache(store, 'user-b')).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('clear() empties the cache (sign-out)', async () => {
    const store = memoryStore<DashboardSnapshot>();
    await replaceCache(store, ME, input(), TODAY);
    await store.clear();
    expect(await loadCache(store, ME)).toBeUndefined();
  });
});
