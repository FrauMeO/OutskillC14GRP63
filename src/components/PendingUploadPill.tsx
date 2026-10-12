import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { QUEUE_EVENT, pendingCount, syncNow } from '../lib/offlineSync';

// A calm "N days waiting to upload" note. Hidden when nothing is waiting. It is mounted from
// main.tsx (fixed at the bottom of the screen), so it shows on every signed-in page; move it into
// AppLayout if you prefer it in the page flow.
export default function PendingUploadPill() {
  const { user } = useAuth();
  const userId = user?.id;
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setCount(userId ? await pendingCount(userId) : 0);
  }, [userId]);

  useEffect(() => {
    void refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_EVENT, refresh);
  }, [refresh]);

  if (!userId || count === 0) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-1 text-sm text-spruce shadow-md"
    >
      <span>
        {count} {count === 1 ? 'day' : 'days'} waiting to upload
      </span>
      <button
        type="button"
        disabled={busy || !navigator.onLine}
        onClick={async () => {
          setBusy(true);
          await syncNow();
          setBusy(false);
        }}
        className="min-h-11 shrink-0 rounded-full px-3 font-semibold underline underline-offset-4 disabled:no-underline disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Upload now'}
      </button>
    </div>
  );
}
