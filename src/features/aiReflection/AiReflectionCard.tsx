// TEMPORARY, for the hackathon (see supabase/functions/daily-reflection/logic.ts for removal steps).
// Shown only when VITE_AI_REFLECTION is "on". Opt-in: nothing is sent until the person asks.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const AI_REFLECTION_ENABLED = import.meta.env.VITE_AI_REFLECTION === 'on';

type Result = { text: string; source: 'ai' | 'fixed' };

export default function AiReflectionCard({ date, hasEntry }: { date: string; hasEntry: boolean }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!AI_REFLECTION_ENABLED) return null;

  async function ask() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('daily-reflection', { body: { date } });
    setBusy(false);
    if (err || !data?.text) {
      setError('A reflection is not available right now. Please try again in a moment.');
      return;
    }
    setResult({ text: data.text, source: data.source === 'ai' ? 'ai' : 'fixed' });
  }

  return (
    <section aria-labelledby="ai-reflection" className="mb-6 rounded-lg border border-line bg-white p-5">
      <h2 id="ai-reflection" className="font-display text-xl font-bold">
        A reflection on your day
      </h2>
      {!hasEntry ? (
        <>
          <p className="mt-1 text-spruce/75">Log something today, and you can ask for a short, kind reflection on it.</p>
          <Link
            to="/habits"
            className="mt-3 inline-flex min-h-11 items-center rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft"
          >
            Log today
          </Link>
        </>
      ) : result ? (
        <>
          <p className="mt-2 text-lg leading-relaxed" aria-live="polite">
            {result.text}
          </p>
          <p className="mt-2 text-xs text-spruce/60">
            {result.source === 'ai' ? 'Written by AI (Claude, by Anthropic) from today’s entry. ' : ''}Not medical advice. Nothing is saved.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-spruce/75">
            Get a few gentle sentences about today. Only today’s numbers, ratings and feelings are sent to Claude (Anthropic) to write it:
            never your name, email, location or reflection answers. Nothing is saved.
          </p>
          <button
            type="button"
            onClick={ask}
            disabled={busy}
            className="mt-3 inline-flex min-h-11 items-center rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
          >
            {busy ? 'Writing your reflection…' : 'Reflect on today'}
          </button>
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
