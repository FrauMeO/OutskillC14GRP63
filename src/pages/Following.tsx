import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import { flagsOf, pillarSummary } from '../lib/careShares';
import { friendlyError, levelOf, viewerLevelText } from '../lib/careShareLevels';
import { notifyFollowedChanged, useFollowedPeople } from '../lib/useFollowedPeople';
import Notice from '../components/Notice';

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const primaryBtn = 'min-h-11 rounded-md bg-spruce px-4 text-lg font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';
const quietBtn = 'min-h-11 rounded-md border border-spruce px-4 text-lg font-semibold hover:bg-mist disabled:opacity-60';

export default function Following() {
  const { people, loading, failed } = useFollowedPeople();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const pending = people.filter((p) => p.status === 'pending');
  const active = people.filter((p) => p.status === 'active');

  async function run(shareId: string, fn: 'accept_care_share' | 'end_care_share', okText: string) {
    setBusy(shareId);
    setFlash(null);
    let error: { code?: string; message: string } | null = null;
    try {
      ({ error } = await supabase.rpc(fn, { p_id: shareId }));
    } catch {
      error = { message: '' };
    }
    setBusy(null);
    setLeavingId(null);
    if (error) return setFlash({ kind: 'error', text: friendlyError(error) });
    setFlash({ kind: 'ok', text: okText });
    notifyFollowedChanged();
  }

  return (
    <>
      <PageHeader title="Following">People who chose to share their pillars with you, as a read-only view.</PageHeader>

      {flash && (
        <Notice kind={flash.kind} className="mb-4 max-w-xl text-lg">
          {flash.text}
        </Notice>
      )}
      {failed && (
        <Notice kind="error" className="mb-4 max-w-xl text-lg">
          Could not load this page: {failed}
        </Notice>
      )}
      {loading && <p role="status" className="text-lg text-moss">Loading…</p>}

      {!loading && !failed && people.length === 0 && (
        <p className="max-w-xl text-lg text-moss">
          No one is sharing with you right now. When someone invites you, the invitation will wait here.
        </p>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="invitations" className="max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 id="invitations" className="font-display text-xl font-bold">
            Invitations
          </h2>
          <ul className="mt-3 space-y-4">
            {pending.map((p) => (
              <li key={p.share_id} className="rounded-md border border-line p-4">
                <p className="text-lg font-semibold">{p.owner_name} would like you to follow along.</p>
                <p className="mt-1 text-lg text-moss">
                  You would see {viewerLevelText(levelOf(p), flagsOf(p))}, as a read-only view. Their notes, feelings and places are never shared.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === p.share_id} onClick={() => run(p.share_id, 'accept_care_share', `You are now following ${p.owner_name}.`)} className={primaryBtn}>
                    Accept
                  </button>
                  <button type="button" disabled={busy === p.share_id} onClick={() => run(p.share_id, 'end_care_share', 'Invitation declined.')} className={quietBtn}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {active.length > 0 && (
        <section aria-labelledby="people" className="mt-6 max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 id="people" className="font-display text-xl font-bold">
            People you follow
          </h2>
          <ul className="mt-3 space-y-4">
            {active.map((p) => (
              <li key={p.share_id} className="rounded-md border border-line p-4">
                <p className="text-lg font-semibold">{p.owner_name}</p>
                {p.paused ? (
                  <p className="text-lg text-moss">{p.owner_name} has paused sharing for now.</p>
                ) : (
                  <p className="text-lg text-moss">Shares {pillarSummary(flagsOf(p))}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!p.paused && (
                    <Link to={`/following/${p.owner_id}`} className={`${primaryBtn} inline-flex items-center`}>
                      See {p.owner_name}’s pillars
                    </Link>
                  )}
                  {leavingId !== p.share_id && (
                    <button type="button" onClick={() => setLeavingId(p.share_id)} className="min-h-11 rounded-md px-3 text-lg font-semibold underline underline-offset-4 hover:bg-mist">
                      Stop following
                    </button>
                  )}
                </div>
                {leavingId === p.share_id && (
                  <div role="alertdialog" aria-label={`Stop following ${p.owner_name}`} className="mt-3 rounded-md border border-line bg-mist p-3">
                    <p className="text-lg">Stop following {p.owner_name}? You would need a new invitation to follow again.</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy === p.share_id} onClick={() => run(p.share_id, 'end_care_share', `You stopped following ${p.owner_name}.`)} className={primaryBtn}>
                        Stop following
                      </button>
                      <button type="button" onClick={() => setLeavingId(null)} className={quietBtn}>
                        Keep following
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
