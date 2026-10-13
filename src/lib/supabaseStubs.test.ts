// Guards the aliases in vite.config.ts that swap @supabase/realtime-js and @supabase/storage-js for
// tiny stand-ins (this app uses neither). If a supabase-js upgrade starts needing more from them,
// this test fails and the alias must be removed (see src/lib/stubs/realtime-js.ts).
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { isNetworkError } from './offlineQueue';

describe('supabase-js with the realtime and storage stand-ins', () => {
  const offlineFetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
  const client = createClient('http://127.0.0.1:1', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: offlineFetch },
  });

  it('builds the client', () => {
    expect(client.from('habit_logs')).toBeDefined();
    expect(client.functions).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it('an offline query comes back as an error that the offline queue recognises as a network failure', async () => {
    const { error } = await client.from('habit_logs').select('log_date').limit(1).retry(false); // supabase-js retries GETs by default, which would outlast the test
    expect(error).toBeTruthy();
    expect(isNetworkError(error)).toBe(true);
  });

  it('an offline upsert (what flushQueue sends) is also recognised', async () => {
    const { error } = await client.from('habit_logs').upsert([{ log_date: '2026-10-12' }], { onConflict: 'user_id,log_date' }).select('log_date');
    expect(isNetworkError(error)).toBe(true);
  });

  it('auth listeners, sign-out and channel cleanup do not throw', async () => {
    const { data } = client.auth.onAuthStateChange(() => {});
    data.subscription.unsubscribe();
    await expect(client.removeAllChannels()).resolves.toBeDefined();
    await expect(client.auth.signOut()).resolves.toBeDefined();
  });

  it('the stand-in really is in use (control)', () => {
    expect(() => client.channel('x')).toThrow(/not included in this build/);
  });
});
