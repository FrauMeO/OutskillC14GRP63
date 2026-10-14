import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';
import type { FollowedPerson } from './careShares';

const CHANGED = 'followed-people-changed';
export const SHARING_APP_ACTIVE = 'byp-sharing-app-active';
export const ACCESS_REFRESH_MS = 15_000;
export const ACCESS_TIMEOUT_MS = 10_000;
export function notifyFollowedChanged() { window.dispatchEvent(new Event(CHANGED)); }

/** Access is a short-lived lease. Hide on recheck, background, offline or failure.
 * Request generations prevent a slow reply from resurrecting revoked/previous-account access.
 */
export function useFollowedPeople() {
  const { user } = useAuth();
  const userId = user?.id;
  const generation = useRef(0);
  const nativeActive = useRef(true);
  const [state, setState] = useState<{ userId?: string; people: FollowedPerson[]; loading: boolean; failed: string | null; revision: number }>(
    { people: [], loading: true, failed: null, revision: 0 },
  );
  const invalidate = useCallback(() => {
    generation.current++;
    setState({ userId, people: [], loading: false, failed: null, revision: generation.current });
  }, [userId]);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setState({ userId, people: [], loading: !!userId, failed: null, revision: request });
    if (!userId || !nativeActive.current || document.visibilityState === 'hidden' || navigator.onLine === false) {
      setState({ userId, people: [], loading: false, failed: userId ? 'Return online to check sharing access.' : null, revision: request });
      return;
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const reply = await Promise.race([
        Promise.resolve(supabase.rpc('followed_people_scoped')),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), ACCESS_TIMEOUT_MS); }),
      ]);
      if (generation.current !== request) return;
      setState({ userId, people: reply.error ? [] : (reply.data ?? []) as unknown as FollowedPerson[], loading: false,
        failed: reply.error ? 'Could not check sharing access. Please retry.' : null, revision: request });
    } catch {
      if (generation.current === request) setState({ userId, people: [], loading: false, failed: 'Could not check sharing access. Please retry.', revision: request });
    } finally { clearTimeout(timeout); }
  }, [userId]);
  useEffect(() => {
    void load();
    const appActive = (event: Event) => {
      nativeActive.current = (event as CustomEvent<boolean>).detail === true;
      if (nativeActive.current) void load(); else invalidate();
    };
    const visible = () => { if (document.visibilityState === 'hidden') invalidate(); else void load(); };
    const interval = window.setInterval(() => { void load(); }, ACCESS_REFRESH_MS);
    window.addEventListener(SHARING_APP_ACTIVE, appActive);
    window.addEventListener(CHANGED, load);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    window.addEventListener('offline', invalidate);
    window.addEventListener('pagehide', invalidate);
    document.addEventListener('visibilitychange', visible);
    return () => {
      generation.current++;
      clearInterval(interval);
      window.removeEventListener(SHARING_APP_ACTIVE, appActive);
      window.removeEventListener(CHANGED, load);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      window.removeEventListener('offline', invalidate);
      window.removeEventListener('pagehide', invalidate);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [load, invalidate]);
  const current = state.userId === userId;
  return { people: current ? state.people : [], loading: current ? state.loading : !!userId,
    failed: current ? state.failed : null, revision: state.revision, reload: load };
}
