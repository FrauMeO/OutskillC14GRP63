// TEMPORARY, for the hackathon (see supabase/functions/daily-reflection/logic.ts for removal steps).
// Shown only when VITE_AI_REFLECTION is "on". Opt-in: nothing is sent until the person asks.
// Two asks: a reflection on today, and a gentle coach on the week (Michael's idea, with goals).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const AI_REFLECTION_ENABLED = import.meta.env.VITE_AI_REFLECTION === 'on';

type Mode = 'day' | 'week';
type Result = { text: string; source: 'ai' | 'fixed'; mode: Mode };

const buttonClass =
  'inline-flex min-h-11 items-center rounded-md px-5 font-semibold disabled:opacity-60';

export default function AiReflectionCard({ date, hasEntry }: { date: string; hasEntry: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Mode | null>(null);

  if (!AI_REFLECTION_ENABLED) return null;

  async function ask(mode: Mode) {
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
      return;
    }
    setResult({ text: data.text, source: data.source === 'ai' ? 'ai' : 'fixed', mode });
  }

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
              ? `Written by AI (Claude, by Anthropic) from ${result.mode === 'week' ? 'this week’s entries and your goals' : 'today’s entry'}. `
              : ''}
            Not medical advice. Nothing is saved.
          </p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-3 text-sm font-semibold underline underline-offset-4"
          >
            Back
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-spruce/75">
            Ask for a few gentle sentences about today, or a kind coach’s look at your week and the goals you chose. Only
            your numbers, ratings, feelings and goals are sent to Claude (Anthropic): never your name, email, location, notes
            or reflection answers. Nothing is saved.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasEntry ? (
              <button
                type="button"
                onClick={() => ask('day')}
                disabled={busy !== null}
                className={`${buttonClass} bg-spruce text-mist hover:bg-spruce-soft`}
              >
                {busy === 'day' ? 'Writing your reflection…' : 'Reflect on today'}
              </button>
            ) : (
              <Link to="/habits" className={`${buttonClass} bg-spruce text-mist hover:bg-spruce-soft`}>
                Log today
              </Link>
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
