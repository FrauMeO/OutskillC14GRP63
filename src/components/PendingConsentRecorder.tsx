import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CONSENT_CHANGED, liveClient, recordPendingConsents } from '../lib/consentApi';

// Renders nothing. After a person's first sign-in it writes the consent choices they made on the
// sign-up form (kept in the sign-up metadata, because email confirmation means there was no session
// when they ticked the boxes). A kind that already has a ledger row is skipped, so this is safe on
// every sign-in and cannot undo a later withdrawal.
export default function PendingConsentRecorder() {
  const { user } = useAuth();
  const id = user?.id;
  const meta = user?.user_metadata;

  useEffect(() => {
    if (!id) return;
    void recordPendingConsents(id, meta, liveClient).then((written) => {
      if (written.length > 0) window.dispatchEvent(new Event(CONSENT_CHANGED));
    });
    // Only when the person changes; the metadata is read once per sign-in.
  }, [id]);

  return null;
}
