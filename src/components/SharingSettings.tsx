import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toISODate } from '../lib/dates';
import SharedLevelView from './SharedLevelView';
import ShareConsentDialog from './ShareConsentDialog';
import { SAVE_PROBLEM, setConsent } from '../lib/consentApi';
import {
  NO_PILLAR_ERROR,
  flagsOf,
  hasAnyPillar,
  normaliseEmail,
  openShares,
  pillarSummary,
  sameFlags,
  sharedPillarNames,
  statusLabel,
  validateEmail,
  type CareShareRow,
  type PillarFlags,
  type ShareLevel,
  type SharedGoal,
} from '../lib/careShares';
import {
  GENERIC_PROBLEM,
  NOT_AVAILABLE_YET,
  PREVIEW_DAYS,
  SHARE_LEVELS,
  accessText,
  friendlyError,
  isPaused,
  levelOf,
  needsReconfirm,
  previewSharedDays,
  previewWeekSummary,
  reconfirmQuestion,
  viewDaysThisMonth,
  type ShareViewRow,
} from '../lib/careShareLevels';
import { CATEGORY_FIELDS, addDays } from '../lib/dashboard';

type Flash = { kind: 'ok' | 'error'; text: string } | null;
type OwnRow = Record<string, unknown> & { log_date: string };

const NO_PILLARS: PillarFlags = { eat: false, sleep: false, move: false, balance: false };

const PILLAR_BOXES: { key: keyof PillarFlags; name: string }[] = [
  { key: 'eat', name: 'Eat' },
  { key: 'sleep', name: 'Sleep' },
  { key: 'move', name: 'Move' },
  { key: 'balance', name: 'Balance' },
];

const primaryBtn = 'min-h-11 rounded-md bg-spruce px-4 text-base font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';
const quietBtn = 'min-h-11 rounded-md border border-spruce px-4 text-base font-semibold hover:bg-mist disabled:opacity-60';

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

function LevelChoice({ value, onChange, idPrefix }: { value: ShareLevel; onChange: (next: ShareLevel) => void; idPrefix: string }) {
  return (
    <fieldset className="mt-3">
      <legend className="text-base font-medium">How much do they see?</legend>
      <div className="mt-1 space-y-1">
        {SHARE_LEVELS.map((l) => (
          <label key={l.value} htmlFor={`${idPrefix}-level-${l.value}`} className="flex min-h-11 items-start gap-3 py-2">
            <input
              id={`${idPrefix}-level-${l.value}`}
              type="radio"
              name={`${idPrefix}-level`}
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={value === l.value}
              onChange={() => onChange(l.value)}
            />
            <span>
              <span className="block text-base font-medium">{l.label}</span>
              <span className="block text-base text-spruce/70">{l.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
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

// The owner's own entries and goals, loaded the first time a preview is opened. Own data only
// (row level security), kept in memory, never sent anywhere.
function useOwnEntries() {
  const [rows, setRows] = useState<OwnRow[] | null>(null);
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const ensure = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    try {
      const today = toISODate(new Date());
      const fields = ['log_date', ...Object.values(CATEGORY_FIELDS).flat()].join(', ');
      const [logs, g] = await Promise.all([
        supabase.from('habit_logs').select(fields).gte('log_date', addDays(today, -(PREVIEW_DAYS - 1))).lte('log_date', today),
        supabase.from('goals').select('goal_type, target_value, unit'),
      ]);
      if (logs.error) throw logs.error;
      setRows((logs.data ?? []) as unknown as OwnRow[]);
      setGoals(g.error ? [] : ((g.data ?? []) as SharedGoal[]));
    } catch {
      started.current = false;
      setError('Could not build the preview just now.');
    }
  }, []);
  return { rows, goals, error, ensure };
}

type Own = ReturnType<typeof useOwnEntries>;

// "Preview what {email} will see": computed here from the owner's own entries with the same rules
// the database uses, so nothing is sent and nothing is promised beyond what the rules do.
function Preview({ who, flags, level, paused, own, idPrefix }: { who: string; flags: PillarFlags; level: ShareLevel; paused: boolean; own: Own; idPrefix: string }) {
  const [open, setOpen] = useState(false);
  const todayIso = toISODate(new Date());
  const days = useMemo(() => (own.rows ? previewSharedDays(own.rows, flags, level, todayIso, paused) : []), [own.rows, flags, level, todayIso, paused]);
  const weekRows = useMemo(() => (own.rows && level === 'summary' && !paused ? previewWeekSummary(own.rows, flags, todayIso) : []), [own.rows, flags, level, todayIso, paused]);
  const panelId = `${idPrefix}-preview`;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => !o);
          own.ensure();
        }}
        className={quietBtn}
      >
        {open ? 'Hide preview' : `Preview what ${who} will see`}
      </button>
      {open && (
        <div id={panelId} className="mt-3 rounded-md border border-dashed border-spruce/40 bg-mist p-3">
          <p className="text-base font-semibold">Preview only</p>
          <p className="text-base text-spruce/80">
            This is what {who} would see, worked out here from your own entries. Nothing is sent, and your notes, feelings and places are never part of it.
          </p>
          {own.error && <p role="alert" className="mt-2 text-base text-alert">{own.error}</p>}
          {!own.error && !own.rows && <p role="status" className="mt-2 text-base text-spruce/70">Loading…</p>}
          {own.rows && !hasAnyPillar(flags) && <p className="mt-2 text-base">Tick at least one pillar to see a preview.</p>}
          {own.rows && hasAnyPillar(flags) && paused && <p className="mt-2 text-base">Sharing is paused, so they would see nothing right now.</p>}
          {own.rows && hasAnyPillar(flags) && !paused && (
            <div className="mt-3 [&_.text-lg]:text-base">
              <SharedLevelView level={level} name="you" flags={flags} days={days} weekRows={weekRows} goals={own.goals} todayIso={todayIso} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The owner's side of care sharing. Writes are database functions (0010 and 0015); their error
// messages are plain English and are shown as they come. A function that does not exist yet
// shows a calm "not available yet" and never throws.
export default function SharingSettings() {
  const { user } = useAuth();
  const own = useOwnEntries();
  const [shares, setShares] = useState<CareShareRow[]>([]);
  const [views, setViews] = useState<ShareViewRow[]>([]);
  const [viewsAvailable, setViewsAvailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<PillarFlags>(NO_PILLARS); // everything off until the owner chooses
  const [inviteLevel, setInviteLevel] = useState<ShareLevel>('presence');
  const [inviting, setInviting] = useState(false);
  const [inviteFlash, setInviteFlash] = useState<Flash>(null);
  const [askingConsent, setAskingConsent] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { flags: PillarFlags; level: ShareLevel }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowFlash, setRowFlash] = useState<Record<string, Flash>>({});
  const [endingId, setEndingId] = useState<string | null>(null);
  const [bannerFlash, setBannerFlash] = useState<Flash>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('care_shares').select('*').eq('owner_id', user.id).order('created_at');
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      const rows = openShares((data ?? []) as CareShareRow[]);
      setShares(rows);
      setDrafts(Object.fromEntries(rows.map((r) => [r.id, { flags: flagsOf(r), level: levelOf(r) }])));
      // Who looked: dates only. If the table is not there yet, the line is simply left out.
      const v = await supabase.from('care_share_views').select('share_id, viewed_on, views');
      setViewsAvailable(!v.error);
      setViews(v.error ? [] : ((v.data ?? []) as ShareViewRow[]));
    } catch {
      setLoadError(GENERIC_PROBLEM);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Run one database function; never throws. Returns a calm message on failure, or null on success.
  async function call(fn: 'set_care_share_options' | 'confirm_care_share' | 'end_care_share' | 'update_care_share', args: Record<string, unknown>): Promise<string | null> {
    try {
      const { error } = await supabase.rpc(fn as never, args as never);
      return error ? friendlyError(error) : null;
    } catch {
      return GENERIC_PROBLEM;
    }
  }

  // Step 1: check the form, then ask for the person's yes (the consent dialog). Nothing is created yet.
  function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteFlash(null);
    const problem = validateEmail(email) ?? (hasAnyPillar(invite) ? null : NO_PILLAR_ERROR);
    if (problem) return setInviteFlash({ kind: 'error', text: problem });
    setAskingConsent(true);
  }

  // Step 2, after "Send invitation" in the dialog: create the share, save the level, then record the
  // consent for THIS share. If the record cannot be saved, the share is ended so none exists without one.
  async function sendInvite() {
    setInviteFlash(null);
    const clean = normaliseEmail(email);
    setInviting(true);
    let createError: { code?: string; message: string } | null = null;
    let newId: string | null = null;
    try {
      const res = await supabase.rpc('create_care_share', {
        p_email: clean,
        p_eat: invite.eat,
        p_sleep: invite.sleep,
        p_move: invite.move,
        p_balance: invite.balance,
      });
      createError = res.error;
      newId = (res.data as string | null) ?? null;
    } catch {
      createError = { message: '' };
    }
    if (createError) {
      setInviting(false);
      setAskingConsent(false);
      return setInviteFlash({ kind: 'error', text: friendlyError(createError) });
    }
    // Save the level on the new share (the invitation itself still waits for them to accept).
    const levelProblem = newId ? await call('set_care_share_options', { p_id: newId, p_level: inviteLevel, p_paused: false }) : NOT_AVAILABLE_YET;
    // Record what they agreed to, naming the person, the pillars and the level at this moment.
    const recordProblem = newId
      ? await setConsent('share_caregiver', true, { shareId: newId, details: { recipient: clean, pillars: sharedPillarNames(invite), level: inviteLevel } })
      : SAVE_PROBLEM;
    if (recordProblem) {
      if (newId) await call('end_care_share', { p_id: newId });
      setInviting(false);
      setAskingConsent(false);
      await load();
      return setInviteFlash({ kind: 'error', text: 'We could not save your invitation, so nothing was shared. Please try again.' });
    }
    setInviting(false);
    setAskingConsent(false);
    setEmail('');
    setInvite(NO_PILLARS);
    setInviteLevel('presence');
    const base = `Invitation saved for ${clean}. We do not send email yet, so please tell them. They need to create an account or log in with exactly ${clean} to accept.`;
    setInviteFlash(
      levelProblem
        ? { kind: 'error', text: `${base} Your choice of how much they see could not be saved: ${levelProblem} Please check it below before they accept.` }
        : { kind: 'ok', text: base },
    );
    await load();
  }

  async function saveRow(r: CareShareRow) {
    const d = drafts[r.id] ?? { flags: flagsOf(r), level: levelOf(r) };
    setRowFlash((f) => ({ ...f, [r.id]: null }));
    if (!hasAnyPillar(d.flags)) {
      return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: 'Choose at least one pillar, or end the share.' } }));
    }
    setBusyId(r.id);
    let problem: string | null = null;
    if (!sameFlags(d.flags, flagsOf(r))) {
      problem = await call('update_care_share', { p_id: r.id, p_eat: d.flags.eat, p_sleep: d.flags.sleep, p_move: d.flags.move, p_balance: d.flags.balance });
    }
    if (!problem && d.level !== levelOf(r)) {
      problem = await call('set_care_share_options', { p_id: r.id, p_level: d.level, p_paused: isPaused(r) });
    }
    setBusyId(null);
    if (problem) return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: problem } }));
    setRowFlash((f) => ({ ...f, [r.id]: { kind: 'ok', text: `Saved. ${r.viewer_email} can now see ${pillarSummary(d.flags)}.` } }));
    await load();
  }

  async function setPaused(r: CareShareRow, paused: boolean) {
    setBusyId(r.id);
    setRowFlash((f) => ({ ...f, [r.id]: null }));
    // Pause and resume keep the level that is saved, not an unsaved choice on screen.
    const problem = await call('set_care_share_options', { p_id: r.id, p_level: levelOf(r), p_paused: paused });
    setBusyId(null);
    if (problem) return setRowFlash((f) => ({ ...f, [r.id]: { kind: 'error', text: problem } }));
    setRowFlash((f) => ({
      ...f,
      [r.id]: { kind: 'ok', text: paused ? `Sharing with ${r.viewer_email} is paused. They see nothing until you resume.` : `Sharing with ${r.viewer_email} has resumed.` },
    }));
    await load();
  }

  async function endShare(r: CareShareRow, fromBanner = false) {
    setBusyId(r.id);
    const problem = await call('end_care_share', { p_id: r.id });
    setBusyId(null);
    setEndingId(null);
    if (problem) return (fromBanner ? setBannerFlash : (f: Flash) => setRowFlash((all) => ({ ...all, [r.id]: f })))({ kind: 'error', text: problem });
    // The share has ended, so take back the consent for it too (the ledger keeps both rows). Best effort: the share is already ended.
    await setConsent('share_caregiver', false, { shareId: r.id, details: { recipient: r.viewer_email } });
    setInviteFlash({ kind: 'ok', text: `Sharing with ${r.viewer_email} has ended.` });
    setBannerFlash(null);
    await load();
  }

  async function confirmShare(r: CareShareRow) {
    setBusyId(r.id);
    setBannerFlash(null);
    const problem = await call('confirm_care_share', { p_id: r.id });
    setBusyId(null);
    if (problem) return setBannerFlash({ kind: 'error', text: problem });
    setBannerFlash({ kind: 'ok', text: `Thank you. Sharing with ${r.viewer_email} carries on. We will ask again in about three months.` });
    await load();
  }

  function goToOptions(r: CareShareRow) {
    const el = document.getElementById(`share-${r.id}`);
    if (!el) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }

  const now = new Date();
  const todayIso = toISODate(now);
  const due = shares.filter((r) => needsReconfirm(r, now));

  return (
    <section aria-labelledby="sharing" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id="sharing" className="font-display text-xl font-bold">
        Sharing
      </h2>
      <p className="mt-2 text-base text-spruce/80">
        You choose who can follow along, and how much. They get a read-only view, you can pause or end it any time, and it stops at once.
        Your notes, feelings and places are never shared.
      </p>

      {due.length > 0 && (
        <div className="mt-4 space-y-3" aria-label="Time to check in on your sharing">
          {due.map((r) => (
            <div key={r.id} className="rounded-md border border-sage bg-mist p-4">
              <p className="text-base font-semibold">{reconfirmQuestion(r.viewer_email)}</p>
              <p className="text-base text-spruce/80">It has been a while, so this is just a gentle check. Nothing changes unless you say so.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => confirmShare(r)} disabled={busyId === r.id} aria-label={`Yes, keep sharing with ${r.viewer_email}`} className={primaryBtn}>
                  Yes
                </button>
                <button type="button" onClick={() => goToOptions(r)} aria-label={`Change what ${r.viewer_email} sees`} className={quietBtn}>
                  Change
                </button>
                <button type="button" onClick={() => endShare(r, true)} disabled={busyId === r.id} aria-label={`Stop sharing with ${r.viewer_email}`} className={quietBtn}>
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Message flash={bannerFlash} />

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
          <legend className="text-base font-medium">Which pillars?</legend>
          <PillarBoxes value={invite} onChange={setInvite} idPrefix="invite" />
          <p className="text-base text-spruce/70">Nothing is shared until you tick it. Balance is mood, energy and stress.</p>
        </fieldset>
        <LevelChoice value={inviteLevel} onChange={setInviteLevel} idPrefix="invite" />
        <Preview who={validateEmail(email) === null ? normaliseEmail(email) : 'them'} flags={invite} level={inviteLevel} paused={false} own={own} idPrefix="invite" />
        <div>
          <button type="submit" disabled={inviting} className={primaryBtn}>
            {inviting ? 'Saving…' : 'Invite'}
          </button>
        </div>
        <Message flash={inviteFlash} />
      </form>
      {askingConsent && (
        <ShareConsentDialog
          email={normaliseEmail(email)}
          pillars={pillarSummary(invite)}
          level={inviteLevel}
          balance={invite.balance}
          busy={inviting}
          onCancel={() => setAskingConsent(false)}
          onConfirm={sendInvite}
        />
      )}

      <h3 className="mt-8 font-display text-lg font-bold">People you share with</h3>
      {loadError && (
        <p role="alert" className="mt-2 text-base text-alert">
          Could not load your shares: {loadError}
        </p>
      )}
      {!loadError && shares.length === 0 && <p className="mt-2 text-base text-spruce/70">You are not sharing with anyone.</p>}
      <ul className="mt-2 space-y-4">
        {shares.map((r) => {
          const d = drafts[r.id] ?? { flags: flagsOf(r), level: levelOf(r) };
          const changed = !sameFlags(d.flags, flagsOf(r)) || d.level !== levelOf(r);
          const paused = isPaused(r);
          const lookDays = viewDaysThisMonth(views, r.id, todayIso);
          const levelLabel = SHARE_LEVELS.find((l) => l.value === levelOf(r))?.label ?? '';
          return (
            <li key={r.id} className="rounded-md border border-line p-4">
              <p id={`share-${r.id}`} tabIndex={-1} className="break-words text-base font-semibold outline-offset-4">
                {r.viewer_email}
              </p>
              <p className="text-base text-spruce/80">
                {paused ? 'Paused' : statusLabel(r.status)} · {pillarSummary(flagsOf(r))}
              </p>
              {r.level && <p className="text-base text-spruce/80">{levelLabel}</p>}
              {r.status === 'active' && viewsAvailable && <p className="text-base text-spruce/80">{accessText(r.viewer_email, lookDays)}</p>}

              <fieldset className="mt-2">
                <legend className="text-base font-medium">Change what they see</legend>
                <PillarBoxes value={d.flags} onChange={(next) => setDrafts((all) => ({ ...all, [r.id]: { ...d, flags: next } }))} idPrefix={`share-${r.id}`} />
              </fieldset>
              <LevelChoice value={d.level} onChange={(next) => setDrafts((all) => ({ ...all, [r.id]: { ...d, level: next } }))} idPrefix={`share-${r.id}`} />
              <Preview who={r.viewer_email} flags={d.flags} level={d.level} paused={paused} own={own} idPrefix={`share-${r.id}`} />

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => saveRow(r)} disabled={busyId === r.id || !changed} className={primaryBtn}>
                  Save
                </button>
                {r.status === 'active' && (
                  <button type="button" onClick={() => setPaused(r, !paused)} disabled={busyId === r.id} className={quietBtn}>
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                )}
                {endingId !== r.id && (
                  <button type="button" onClick={() => setEndingId(r.id)} className="min-h-11 rounded-md px-3 text-base font-semibold underline underline-offset-4 hover:bg-mist">
                    End sharing
                  </button>
                )}
              </div>
              {endingId === r.id && (
                <div role="alertdialog" aria-label={`End sharing with ${r.viewer_email}`} className="mt-3 rounded-md border border-line bg-mist p-3">
                  <p className="text-base">
                    End sharing with {r.viewer_email}? They will stop seeing your pillars straight away. You can invite them again later.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => endShare(r)} disabled={busyId === r.id} className={primaryBtn}>
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
