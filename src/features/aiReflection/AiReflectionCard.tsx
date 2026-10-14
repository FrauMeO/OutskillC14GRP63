// TEMPORARY, for the hackathon (see supabase/functions/daily-reflection/logic.ts for removal steps).
// Shown only when VITE_AI_REFLECTION is "on". Opt-in: nothing is sent until the person asks, or
// until they turn on "Write my daily reflection automatically" in Settings (profiles.auto_reflection).
// Two asks: a reflection on today, and a gentle coach on the week (Michael's idea, with goals).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import AiConsentDialog from './AiConsentDialog';
import { entryFingerprint } from './fingerprint';
import HardDaySupport from './HardDaySupport';
import { needsSupportLines } from './hardDayResources';
import { FALLBACK_MESSAGE, checkReply } from '../../lib/replySafety';
import { useAiConsent } from './useAiConsent';
import { useDataSaver } from '../../lib/useDataSaver';
import { REFLECTION_DATA_NOTE } from '../../lib/dataSaver';
import Notice from '../../components/Notice';
import { consentRevision, mayCallAi, readConsent } from '../../lib/aiConsent';

export const AI_REFLECTION_ENABLED = import.meta.env.VITE_AI_REFLECTION === 'on';

type Mode = 'day' | 'week';
type Result = { text: string; source: 'ai' | 'fixed'; mode: Mode; reason?: string };

let cachedAuto: { scope: string; result: Result } | null = null;

const buttonClass = 'inline-flex min-h-12 min-w-12 items-center rounded-md px-5 font-semibold disabled:opacity-60';

type Props = { date: string; today: Record<string, unknown> | null; auto: boolean };

export default function AiReflectionCard({ date, today, auto: autoSetting }: Props) {
  const { user } = useAuth();
  const consent = useAiConsent(user?.id);
  const { saveData } = useDataSaver();
  const fingerprint = entryFingerprint(today);
  // A new account, consent state, day or entry owns a fresh component and fresh state.
  // Automatic navigation cache is keyed by account, consent decision and entry context.
  const scope = JSON.stringify([user?.id, consent.allowed, consentRevision(user?.id), date, fingerprint, autoSetting && !saveData]);
  if (!consent.allowed) cachedAuto = null;
  return <ScopedReflection key={scope} scope={scope} date={date} fingerprint={fingerprint} userId={user?.id}
    consent={consent} autoSetting={autoSetting} saveData={saveData} />;
}

function ScopedReflection({ scope, date, fingerprint, userId, consent, autoSetting, saveData }: {
  scope: string; date: string; fingerprint: string | null; userId: string | undefined;
  consent: ReturnType<typeof useAiConsent>; autoSetting: boolean; saveData: boolean;
}) {
  const allowed = consent.allowed;
  const [asking, setAsking] = useState(false);
  const auto = autoSetting && !saveData;
  const [result, setResult] = useState<Result | null>(cachedAuto?.scope === scope ? cachedAuto.result : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Mode | null>(null);
  const lastAuto = useRef<Result | null>(cachedAuto?.scope === scope ? cachedAuto.result : null);
  const generation = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; };
  }, []);

  const revision = consentRevision(userId);

  async function ask(mode: Mode): Promise<Result | null> {
    // Re-read consent as well as render state: a storage event can precede React's update.
    if (!allowed || !userId || !mayCallAi(readConsent(userId))) return null;
    const request = ++generation.current;
    const current = () => mounted.current && request === generation.current && revision === consentRevision(userId) && mayCallAi(readConsent(userId));
    setBusy(mode);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('daily-reflection', { body: { date, mode } });
      if (!current()) return null;
      if (err || !data?.text) {
        const status = (err as { context?: { status?: number } } | null)?.context?.status;
        setError(
          mode === 'week' && status === 404
            ? 'Log a day or two this week, and the coach can look at it with you.'
            : 'A reflection is not available right now. Please try again in a moment.',
        );
        return null;
      }
      // Second line of defence: the same checker the server uses. Anything doubtful becomes the fixed kind
      // message. The check fails closed (it never throws; a surprise is "not ok").
      const checked = data.source === 'ai' && !checkReply(data.text, { mode: mode === 'week' ? 'coach' : 'day' }).ok;
      const next: Result = checked
        ? { text: FALLBACK_MESSAGE, source: 'fixed', mode, reason: 'filtered' }
        : { text: data.text, source: data.source === 'ai' ? 'ai' : 'fixed', mode, reason: typeof data.reason === 'string' ? data.reason : undefined };
      setResult(next);
      if (auto && mode === 'day') { lastAuto.current = next; cachedAuto = { scope, result: next }; }
      return next;
    } catch {
      if (current()) setError('A reflection is not available right now. Please try again in a moment.');
      return null;
    } finally {
      if (current()) setBusy(null);
    }
  }

  // One automatic request per mounted scope. Cleanup invalidates even StrictMode replay.
  useEffect(() => {
    let disposed = false;
    // StrictMode replays effects: wait until its first cleanup can mark that setup obsolete.
    queueMicrotask(() => {
      if (!disposed && AI_REFLECTION_ENABLED && allowed && auto && fingerprint && !lastAuto.current) void ask('day');
    });
    // Scope changes remount this component, so this effect never reuses old context.
    return () => { disposed = true; };
  }, []);

  function back() {
    generation.current++;
    setBusy(null);
    setError(null);
    setResult(auto ? lastAuto.current : null);
  }

  if (!AI_REFLECTION_ENABLED) return null;

  if (!allowed) {
    return (
      <section aria-labelledby="ai-reflection" className="mb-6 rounded-lg border border-line bg-white p-5">
        <h2 id="ai-reflection" className="font-display text-xl font-bold">
          A reflection on your day
        </h2>
        <p className="mt-2 text-lg leading-relaxed">
          AI reflection is off. Turn it on if you would like gentle, written reflections.
        </p>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={`${buttonClass} mt-3 border border-spruce text-lg text-spruce hover:bg-mist`}
        >
          Turn on AI reflection
        </button>
        {asking && (
          <AiConsentDialog
            onYes={() => {
              consent.grant();
              setAsking(false);
            }}
            onNotNow={() => {
              consent.notNow();
              setAsking(false);
            }}
          />
        )}
      </section>
    );
  }

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
          <p className="mt-2 text-base leading-relaxed text-moss">
            {result.source === 'ai'
              ? `Written by AI (Claude, by Anthropic) from ${result.mode === 'week' ? 'this week’s entries and your goals' : 'today’s entry'}${autoDay ? ', automatically after you logged' : ''}. `
              : 'A kind message from the app. '}
            Not medical advice. Nothing is saved.
          </p>
          {needsSupportLines(result.reason) && <HardDaySupport />}
          <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
            {result.mode === 'week' ? (
              <button type="button" onClick={back} className="inline-flex min-h-12 min-w-12 items-center underline underline-offset-4">
                Back
              </button>
            ) : (
              <button type="button" onClick={() => ask('week')} disabled={busy !== null} className="inline-flex min-h-12 min-w-12 items-center underline underline-offset-4 disabled:opacity-60">
                {busy === 'week' ? 'Looking at your week…' : 'Coach me on my week'}
              </button>
            )}
            {!auto && result.mode === 'day' && (
              <button type="button" onClick={back} className="inline-flex min-h-12 min-w-12 items-center underline underline-offset-4">
                Back
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-moss">
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
          {saveData && <p className="mt-2 text-base leading-relaxed text-moss">{REFLECTION_DATA_NOTE}</p>}
          {!autoSetting && (
            <p className="mt-2 text-base leading-relaxed text-moss">
              Prefer it written automatically after each log?{' '}
              <Link to="/settings" className="inline-flex min-h-12 min-w-12 items-center underline underline-offset-4">
                Turn it on in Settings
              </Link>
              .
            </p>
          )}
        </>
      )}
      {error && (
        <Notice kind="error" className="mt-2 text-sm">
          {error}
        </Notice>
      )}
    </section>
  );
}
