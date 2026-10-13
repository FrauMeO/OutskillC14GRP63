import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  loadFollowed,
  loadOwnerShares,
  loadPrefs,
  setDigestPref,
  setNudgePref,
  type FollowedShare,
  type OwnerShare,
  type PrefsRow,
} from '../lib/email/prefs';

// Email choices for care sharing. Both switches start OFF.
//  - As the person who shares: "Let {name} send me a gentle note" (one of two short notes, at most a day).
//  - As a supporter: "Email me a weekly summary" (only what that person has chosen to share with you).
// Turning a switch off, ending or pausing a share, never sends anyone an email.
export default function EmailPrefsPanel() {
  const { user } = useAuth();
  const [owned, setOwned] = useState<OwnerShare[]>([]);
  const [followed, setFollowed] = useState<FollowedShare[]>([]);
  const [prefs, setPrefs] = useState<Map<string, PrefsRow>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([loadOwnerShares(user.id), loadFollowed(), loadPrefs()])
      .then(([o, f, p]) => {
        if (cancelled) return;
        setOwned(o);
        setFollowed(f);
        setPrefs(p);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true); // fail closed: show nothing rather than a wrong switch
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (failed || !loaded || (owned.length === 0 && followed.length === 0)) return null;

  async function toggle(kind: 'nudge' | 'digest', shareId: string, next: boolean) {
    setSaving(shareId + kind);
    setMessage(null);
    try {
      if (kind === 'nudge') await setNudgePref(shareId, next);
      else await setDigestPref(shareId, next);
      setPrefs((old) => {
        const copy = new Map(old);
        const row = copy.get(shareId) ?? { share_id: shareId, owner_allows_nudges: false, supporter_digest: false };
        copy.set(shareId, kind === 'nudge' ? { ...row, owner_allows_nudges: next } : { ...row, supporter_digest: next });
        return copy;
      });
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setSaving(null);
    }
  }

  const box = 'flex min-h-11 items-start gap-3 text-lg';
  return (
    <section aria-labelledby="email-prefs-heading" className="rounded-2xl border border-line bg-white p-5">
      <h2 id="email-prefs-heading" className="font-display text-2xl font-bold">
        Emails about sharing
      </h2>
      <p className="mt-1 text-lg text-moss">Everything here is off until you turn it on. You can turn it off any time, and nobody is told.</p>

      {owned.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="font-display text-xl font-bold">If you share your pillars</h3>
          {owned.map((s) => (
            <label key={s.id} className={box}>
              <input
                type="checkbox"
                className="mt-1 h-6 w-6"
                checked={prefs.get(s.id)?.owner_allows_nudges === true}
                disabled={saving === s.id + 'nudge'}
                onChange={(e) => toggle('nudge', s.id, e.target.checked)}
              />
              <span>
                Let {s.viewer_email} send me a gentle note
                <span className="block text-base text-moss">One of two short messages, at most once a day. You never have to reply.</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {followed.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="font-display text-xl font-bold">If you follow someone</h3>
          {followed.map((f) => (
            <label key={f.share_id} className={box}>
              <input
                type="checkbox"
                className="mt-1 h-6 w-6"
                checked={prefs.get(f.share_id)?.supporter_digest === true}
                disabled={saving === f.share_id + 'digest'}
                onChange={(e) => toggle('digest', f.share_id, e.target.checked)}
              />
              <span>
                Email me a weekly summary about {f.owner_name}
                <span className="block text-base text-moss">Only what {f.owner_name} chooses to share. No numbers, no notes.</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {message && (
        <p role="status" className="mt-3 text-lg">
          {message}
        </p>
      )}
    </section>
  );
}
