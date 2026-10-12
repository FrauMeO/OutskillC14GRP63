// Live view of one person's AI consent. Every component that calls this sees a change at once
// (the Settings switch, the dialog, the card), in this tab and in other tabs.
import { useCallback, useEffect, useState } from 'react';
import { consentKey, isSnoozed, mayCallAi, readConsent, snoozeAsk, writeConsent, type ConsentStatus } from '../../lib/aiConsent';

const EVENT = 'byp-ai-consent-changed';

export function useAiConsent(userId: string | null | undefined) {
  const [status, setStatus] = useState<ConsentStatus>(() => readConsent(userId));
  const [snoozed, setSnoozed] = useState(() => isSnoozed(userId));

  useEffect(() => {
    const refresh = () => {
      setStatus(readConsent(userId));
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

  const set = useCallback(
    (granted: boolean) => {
      if (!userId) return;
      writeConsent(userId, granted);
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
