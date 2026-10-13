import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';
import type { FollowedPerson } from './careShares';

const CHANGED = 'followed-people-changed';

/** Tell every mounted copy of the hook to look again (after accepting, declining or leaving). */
export function notifyFollowedChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * The people this signed-in person follows, and invitations waiting for them (followed_people()).
 * Fails closed: if the call errors, `people` stays empty and `failed` is true, nothing throws.
 */
export function useFollowedPeople() {
  const { user } = useAuth();
  const [people, setPeople] = useState<FollowedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setPeople([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('followed_people');
      if (error) {
        setPeople([]);
        setFailed(error.message);
      } else {
        setPeople((data ?? []) as FollowedPerson[]);
        setFailed(null);
      }
    } catch {
      setPeople([]);
      setFailed('Could not check who you follow.');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, [load]);

  return { people, loading, failed, reload: load };
}
