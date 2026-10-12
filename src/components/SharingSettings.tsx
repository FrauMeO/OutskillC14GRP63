import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  NO_PILLAR_ERROR,
  flagsOf,
  hasAnyPillar,
  normaliseEmail,
  openShares,
  pillarSummary,
  sameFlags,
  statusLabel,
  validateEmail,
  type CareShareRow,
  type PillarFlags,
} from '../lib/careShares';

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const PILLAR_BOXES: { key: keyof PillarFlags; name: string }[] = [
  { key: 'eat', name: 'Eat' },
  { key: 'sleep', name: 'Sleep' },
  { key: 'move', name: 'Move' },
  { key: 'balance', name: 'Balance' },
];

function PillarBoxes({ value, onChange, idPrefix }: { value: PillarFlags; onChange: (next: PillarFlags) => void; idPrefix: string }) {
  return (
    <div className="flex flex-wrap gap-x-5">
      {PILLAR_BOXES.map((p) => (
        <label key={p.key} htmlFor={`${idPrefix}-${p.key}`} className="flex min-h-11 items-center gap-3">
          <input
            id={`${idPrefix}-${p.key}`}
            type="checkbox"
            className="h-5 w-5"
            checked={value[p.key]}
            onChange={(e) => onChange({ ...value, [p.key]: e.target.checked })}
          />
          <span className="text-base font-medium">{p.name}</span>
        </label>
      ))}
    </div>
  );
}

function Message({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <p role={flash.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-base ${flash.kind === 'error' ? 'text-alert' : 'text-current'}`}>
      {flash.text}
    </p>
  );
}

// The owner's side of care sharing. All writes are the database functions from migration 0010;
// their error messages are plain English and are shown as they come.
export default function SharingSettings() {
  const { user } = useAuth();
  const [shares, setShares] = useState<CareShareRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<PillarFlags>({ eat: true, sleep: true, move: true, balance: false });
  const [inviting, setInviting] = useState(false);
  const [inviteFlash, setInviteFlash] = useState<Flash>(null);
  const [drafts, setDrafts] = useState<Record<string, PillarFlags>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowFlash, setRowFlash] = useState<Record<string, Flash>>({});
  const [endingId, setEndingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('care_shares').select('*').eq('owner_id', user.id).order('created_at');
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);
    const rows = openShares((data ?? []) as CareShareRow[]);
    setShares(rows);
    setDrafts(Object.fromEntries(rows.map((r) => [r.id, flagsOf(r)])));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteFlash(null);
    const problem = validateEmail(email) ?? (hasAnyPillar(invite) ? null : NO_PILLAR_ERROR);
    if (problem) return setInviteFlash({ kind: 'error', text: problem });
    const clean = normaliseEmail(email);
    setInviting(true);
    const { error } = await supabase.rpc('create_care_share', {
      p_email: clean,
      p_eat: invite.eat,
      p_sleep: invite.sleep,
      p_move: invite.move,
      p_balance: invite.balance,
    });
    setInviting(false);
    if (error) return setInviteFlash({ kind: 'error', text: error.message });
    setEmail('');
    setInviteFlash({
      kind: 'ok',
      text: `Invitation saved for ${clean}. We do not send email yet, so please tell them. They need to create an account or log in with exactly ${clean} to accept.`,
    });
    await load();
  }

  async function saveRow(r: CareShareRow) {
    const d = drafts[r.id] ?? flagsOf(r);
    setRowFlash((f) => ({ ...f, [r.id]: null }));
    if (!hasAnyPillar(d)) {
      return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: 'Choose at least one pillar, or end the share.' } }));
    }
    setBusyId(r.id);
    const { error } = await supabase.rpc('update_care_share', { p_id: r.id, p_eat: d.eat, p_sleep: d.sleep, p_move: d.move, p_balance: d.balance });
    setBusyId(null);
    if (error) return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: error.message } }));
    setRowFlash((f) => ({ ...f, [r.id]: { kind: 'ok', text: `Saved. ${r.viewer_email} can now see ${pillarSummary(d)}.` } }));
    await load();
  }

  async function endShare(r: CareShareRow) {
    setBusyId(r.id);
    const { error } = await supabase.rpc('end_care_share', { p_id: r.id });
    setBusyId(null);
    setEndingId(null);
    if (error) return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: error.message } }));
    setInviteFlash({ kind: 'ok', text: `Sharing with ${r.viewer_email} has ended.` });
    await load();
  }

  return (
    <section aria-labelledby="sharing" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id="sharing" className="font-display text-xl font-bold">
        Sharing
      </h2>
      <p className="mt-2 text-base text-spruce/80">
        Choose who can follow along. They see only what you tick, only as a read-only view, and you can end it any time.
        Your notes, feelings and places are never shared.
      </p>

      <form onSubmit={handleInvite} className="mt-5 space-y-3" noValidate>
        <label className="block text-base font-medium">
          Their email address
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            className="mt-1.5 block min-h-11 w-full rounded-md border border-line px-3 py-2.5 text-base focus:border-current focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby="sharing-email-help"
          />
        </label>
        <p id="sharing-email-help" className="text-base text-spruce/70">
          They need to create an account or log in with this exact email address to accept. We do not send email yet, so
          let them know yourself.
        </p>
        <fieldset>
          <legend className="text-base font-medium">What they can see</legend>
          <PillarBoxes value={invite} onChange={setInvite} idPrefix="invite" />
          <p className="text-base text-spruce/70">Balance is mood, energy and stress.</p>
        </fieldset>
        <button
          type="submit"
          disabled={inviting}
          className="min-h-11 rounded-md bg-spruce px-4 text-base font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
        >
          {inviting ? 'Saving…' : 'Invite'}
        </button>
        <Message flash={inviteFlash} />
      </form>

      <h3 className="mt-8 font-display text-lg font-bold">People you share with</h3>
      {loadError && (
        <p role="alert" className="mt-2 text-base text-alert">
          Could not load your shares: {loadError}
        </p>
      )}
      {!loadError && shares.length === 0 && <p className="mt-2 text-base text-spruce/70">You are not sharing with anyone.</p>}
      <ul className="mt-2 space-y-4">
        {shares.map((r) => {
          const d = drafts[r.id] ?? flagsOf(r);
          const changed = !sameFlags(d, flagsOf(r));
          return (
            <li key={r.id} className="rounded-md border border-line p-4">
              <p className="break-words text-base font-semibold">{r.viewer_email}</p>
              <p className="text-base text-spruce/80">
                {statusLabel(r.status)} · sees {pillarSummary(flagsOf(r))}
              </p>
              <fieldset className="mt-2">
                <legend className="text-base font-medium">Change what they see</legend>
                <PillarBoxes value={d} onChange={(next) => setDrafts((all) => ({ ...all, [r.id]: next }))} idPrefix={`share-${r.id}`} />
              </fieldset>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveRow(r)}
                  disabled={busyId === r.id || !changed}
                  className="min-h-11 rounded-md bg-spruce px-4 text-base font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
                >
                  Save
                </button>
                {endingId !== r.id && (
                  <button
                    type="button"
                    onClick={() => setEndingId(r.id)}
                    className="min-h-11 rounded-md px-3 text-base font-semibold text-alert underline underline-offset-4 hover:bg-mist"
                  >
                    End sharing
                  </button>
                )}
              </div>
              {endingId === r.id && (
                <div role="alertdialog" aria-label={`End sharing with ${r.viewer_email}`} className="mt-3 rounded-md border border-alert/40 bg-alert/5 p-3">
                  <p className="text-base">
                    End sharing with {r.viewer_email}? They will stop seeing your pillars straight away. You can invite them again later.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => endShare(r)}
                      disabled={busyId === r.id}
                      className="min-h-11 rounded-md bg-alert px-4 text-base font-semibold text-white disabled:opacity-60"
                    >
                      End sharing
                    </button>
                    <button type="button" onClick={() => setEndingId(null)} className="min-h-11 rounded-md px-4 text-base font-semibold hover:bg-mist">
                      Keep sharing
                    </button>
                  </div>
                </div>
              )}
              <Message flash={rowFlash[r.id] ?? null} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
