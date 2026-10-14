// Live view of one person's AI consent. Every component that calls this sees a change at once
// (the Settings switch, the dialog, the card), in this tab and in other tabs.
import { useCallback, useEffect, useState } from 'react';
import { consentKey, isSnoozed, mayCallAi, readConsent, snoozeAsk, writeConsent, type ConsentStatus } from '../../lib/aiConsent';
import { noteSynced, shouldSyncStored, syncConsentToServer } from '../../lib/aiConsentSync';
import { supabase } from '../../lib/supabase';

// Best effort, never blocks the screen and never throws (migration 0019 may not be applied yet).
const sendToServer = (granted: boolean) =>
  syncConsentToServer((g, version) => supabase.rpc('set_ai_consent', { p_granted: g, p_version: version }), granted);

const EVENT = 'byp-ai-consent-changed';

export function useAiConsent(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<{ userId: typeof userId; status: ConsentStatus }>(() => ({ userId, status: readConsent(userId) }));
  // Never expose the previous account's choice during the render before effects refresh.
  const status = snapshot.userId === userId ? snapshot.status : readConsent(userId);
  const [snoozed, setSnoozed] = useState(() => isSnoozed(userId));

  useEffect(() => {
    const refresh = () => {
      setSnapshot({ userId, status: readConsent(userId) });
      setSnoozed(isSnoozed(userId));
    };
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (!userId || e.key === null || e.key === consentKey(userId)) refresh();
    };
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId]);

  // The choice already stored in this browser is copied to the server once per page load, so people who
  // said yes before the server kept a record are covered. "Not asked yet" sends nothing.
  useEffect(() => {
    if (!userId || status === 'unset') return;
    const granted = status === 'granted';
    if (shouldSyncStored(userId, granted)) void sendToServer(granted);
  }, [userId, status]);

  const set = useCallback(
    (granted: boolean) => {
      if (!userId) return;
      writeConsent(userId, granted);
      noteSynced(userId, granted);
      void sendToServer(granted); // also tell the server; the screen does not wait for it
      window.dispatchEvent(new Event(EVENT));
    },
    [userId],
  );

  // "Not now": nothing is stored; we simply do not ask again until the next visit.
  const notNow = useCallback(() => {
    if (!userId) return;
    snoozeAsk(userId);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  return { status, allowed: mayCallAi(status), snoozed, grant: () => set(true), withdraw: () => set(false), notNow };
}
