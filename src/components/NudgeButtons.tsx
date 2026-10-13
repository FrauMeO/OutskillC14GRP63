import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendEmail } from '../lib/email/client';
import { NUDGE_SAVED_LATER_TEXT, NUDGE_SENT_TEXT, nudgeBlock, nudgeReasonText } from '../lib/email/nudgeState';
import { createNudge, lastNudgeAt, loadPrefs } from '../lib/email/prefs';
import { NUDGE_PRESETS } from '../lib/email/rules';

// Supporter side: two preset notes, no typing. Disabled, with a plain reason, when the person has not
// turned gentle notes on or a note was already sent today. The database enforces both rules too.
export default function NudgeButtons({ shareId, ownerName }: { shareId: string; ownerName: string }) {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [last, setLast] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([loadPrefs(), lastNudgeAt(shareId, user.id)])
      .then(([prefs, at]) => {
        if (cancelled) return;
        setAllowed(prefs.get(shareId)?.owner_allows_nudges === true);
        setLast(at);
        setReady(true);
      })
      .catch(() => {
        // Fail closed: if we cannot tell, the buttons stay off.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shareId, user]);

  if (!ready) return null;

  const block = nudgeBlock({ allowed, lastNudgeAt: last, now: new Date(), busy });
  const reason = nudgeReasonText(block, ownerName);

  async function send(preset: string) {
    setBusy(true);
    setError(null);
    try {
      const nudgeId = await createNudge(shareId, preset);
      setLast(new Date());
      const result = await sendEmail({ kind: 'care_nudge', nudge_id: nudgeId });
      setDone(result.deferred ? NUDGE_SAVED_LATER_TEXT : NUDGE_SENT_TEXT);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That note could not be sent right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="nudge-heading" className="rounded-2xl border border-line bg-white p-5">
      <h3 id="nudge-heading" className="font-display text-xl font-bold">
        Send {ownerName} a gentle note
      </h3>
      <div className="mt-3 flex flex-wrap gap-3">
        {NUDGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={block !== null}
            onClick={() => send(preset)}
            className="min-h-11 rounded-full border border-spruce px-5 py-2 text-lg font-semibold text-spruce hover:bg-mist disabled:cursor-not-allowed disabled:border-line disabled:text-moss"
          >
            {preset}
          </button>
        ))}
      </div>
      {reason && block !== 'busy' && <p className="mt-3 text-lg text-moss">{reason}</p>}
      {done && (
        <p role="status" className="mt-3 text-lg">
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-lg">
          {error}
        </p>
      )}
    </section>
  );
}
