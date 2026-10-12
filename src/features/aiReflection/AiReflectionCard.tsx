// TEMPORARY, for the hackathon (see supabase/functions/daily-reflection/logic.ts for removal steps).
// Shown only when VITE_AI_REFLECTION is "on". Opt-in: nothing is sent until the person asks, or
// until they turn on "Write my daily reflection automatically" in Settings (profiles.auto_reflection).
// Two asks: a reflection on today, and a gentle coach on the week (Michael's idea, with goals).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { entryFingerprint } from './fingerprint';
import { useDataSaver } from '../../lib/useDataSaver';
import { REFLECTION_DATA_NOTE } from '../../lib/dataSaver';

export const AI_REFLECTION_ENABLED = import.meta.env.VITE_AI_REFLECTION === 'on';

type Mode = 'day' | 'week';
type Result = { text: string; source: 'ai' | 'fixed'; mode: Mode };

// The last automatic reflection, kept in memory only (never stored), so moving between pages does
// not ask Claude again. A reload, or a changed entry, writes a fresh one.
let lastAuto: { date: string; fingerprint: string; result: Result } | null = null;

const buttonClass = 'inline-flex min-h-11 items-center rounded-md px-5 font-semibold disabled:opacity-60';

type Props = { date: string; today: Record<string, unknown> | null; auto: boolean };

export default function AiReflectionCard({ date, today, auto: autoSetting }: Props) {
  // Data saver: never write a reflection by itself; only when the person taps.
  const { saveData } = useDataSaver();
  const auto = autoSetting && !saveData;
  const fingerprint = entryFingerprint(today);
  const cached = auto && lastAuto && lastAuto.date === date && lastAuto.fingerprint === fingerprint ? lastAuto.result : null;
  const [result, setResult] = useState<Result | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Mode | null>(null);
  const started = useRef<string | null>(null);

  async function ask(mode: Mode): Promise<Result | null> {
    setBusy(mode);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('daily-reflection', { body: { date, mode } });
    setBusy(null);
    if (err || !data?.text) {
      const status = (err as { context?: { status?: number } } | null)?.context?.status;
      setError(
        mode === 'week' && status === 404
          ? 'Log a day or two this week, and the coach can look at it with you.'
          : 'A reflection is not available right now. Please try again in a moment.',
      );
      return null;
    }
    const next: Result = { text: data.text, source: data.source === 'ai' ? 'ai' : 'fixed', mode };
    setResult(next);
    return next;
  }

  // Automatic mode: write once per changed entry.
  useEffect(() => {
    if (!AI_REFLECTION_ENABLED || !auto || !fingerprint || cached || started.current === fingerprint) return;
    started.current = fingerprint;
    ask('day').then((r) => {
      if (r) lastAuto = { date, fingerprint, result: r };
    });
    // ask is recreated each render; the fingerprint decides when to run.
  }, [auto, fingerprint, date]);

  if (!AI_REFLECTION_ENABLED) return null;

  const hasEntry = fingerprint !== null;
  const autoDay = auto && result?.mode !== 'week';

  return (
    <section aria-labelledby="ai-reflection" className="mb-6 rounded-lg border border-line bg-white p-5">
      <h2 id="ai-reflection" className="font-display text-xl font-bold">
        {result?.mode === 'week' ? 'Your week, with a gentle coach' : 'A reflection on your day'}
      </h2>
      {result ? (
        <>
          <p className="mt-2 text-lg leading-relaxed" aria-live="polite">
            {result.text}
          </p>
          <p className="mt-2 text-xs text-spruce/60">
            {result.source === 'ai'
              ? `Written by AI (Claude, by Anthropic) from ${result.mode === 'week' ? 'this week’s entries and your goals' : 'today’s entry'}${autoDay ? ', automatically after you logged' : ''}. `
              : ''}
            Not medical advice. Nothing is saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
            {result.mode === 'week' ? (
              <button type="button" onClick={() => setResult(auto && lastAuto?.date === date ? lastAuto.result : null)} className="underline underline-offset-4">
                Back
              </button>
            ) : (
              <button type="button" onClick={() => ask('week')} disabled={busy !== null} className="underline underline-offset-4 disabled:opacity-60">
                {busy === 'week' ? 'Looking at your week…' : 'Coach me on my week'}
              </button>
            )}
            {!auto && result.mode === 'day' && (
              <button type="button" onClick={() => setResult(null)} className="underline underline-offset-4">
                Back
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-spruce/75">
            {auto && hasEntry
              ? busy === 'day'
                ? 'Writing today’s reflection…'
                : 'Your reflection is written automatically after you log.'
              : 'Written when you ask for it: a few gentle sentences about today, or a kind coach’s look at your week and the goals you chose.'}{' '}
            Only your numbers, ratings, feelings and goals are sent to Claude (Anthropic): never your name, email, location,
            notes or reflection answers. Nothing is saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!hasEntry ? (
              <Link to="/habits" className={`${buttonClass} bg-spruce text-mist hover:bg-spruce-soft`}>
                Log today
              </Link>
            ) : (
              (!auto || error) && (
                <button
                  type="button"
                  onClick={() => ask('day')}
                  disabled={busy !== null}
                  className={`${buttonClass} bg-spruce text-mist hover:bg-spruce-soft`}
                >
                  {busy === 'day' ? 'Writing your reflection…' : auto ? 'Try again' : 'Reflect on today'}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => ask('week')}
              disabled={busy !== null}
              className={`${buttonClass} border border-spruce text-spruce hover:bg-mist`}
            >
              {busy === 'week' ? 'Looking at your week…' : 'Coach me on my week'}
            </button>
          </div>
          {saveData && <p className="mt-2 text-xs text-spruce/60">{REFLECTION_DATA_NOTE}</p>}
          {!autoSetting && (
            <p className="mt-2 text-xs text-spruce/60">
              Prefer it written automatically after each log?{' '}
              <Link to="/settings" className="underline underline-offset-4">
                Turn it on in Settings
              </Link>
              .
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
    </section>
  );
}
