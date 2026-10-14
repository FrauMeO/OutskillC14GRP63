import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  appointmentQuestions, SUMMARY_CHOICES, SUMMARY_COLUMNS, SUMMARY_FOOTER, buildSummary, daysLoggedText, fewDaysNote, formatDate,
  formatMeasure, formatRange, goalText, periodBounds, summaryTitle, todayLocal,
  type MeasureSummary, type SummaryDays, type SummaryGoal, type SummaryRow,
} from '../lib/appointmentSummary';
import { PILLARS } from '../lib/pillars';
import './appointmentSummary.css';
import Notice from '../components/Notice';

// Built only from the signed-in person's own habit_logs and goals (Row Level Security scopes both
// reads). Notes, feelings and locations are never selected. Nothing is stored or sent anywhere:
// the name and the "things I want to mention" text live only in this page.

const input = 'block w-full rounded-md border border-line bg-white px-3 py-2.5 text-lg text-spruce focus:border-current focus:outline-none';
const button = 'min-h-11 rounded-md px-4 py-2.5 text-lg font-semibold';

function MeasureBlock({ m }: { m: MeasureSummary }) {
  return (
    <div className="summary-block rounded-md border border-line bg-white p-4">
      <h3 className="text-lg font-semibold">{m.label}</h3>
      <dl className="summary-small mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-lg sm:grid-cols-4">
        <div>
          <dt className="text-base text-moss">Days logged</dt>
          <dd>{m.days}</dd>
        </div>
        <div>
          <dt className="text-base text-moss">Average</dt>
          <dd>{formatMeasure(m.average!, m)}</dd>
        </div>
        <div>
          <dt className="text-base text-moss">Lowest</dt>
          <dd>
            {formatMeasure(m.low!.value, m)}
            <span className="block text-base text-moss">{formatDate(m.low!.date)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-base text-moss">Highest</dt>
          <dd>
            {formatMeasure(m.high!.value, m)}
            <span className="block text-base text-moss">{formatDate(m.high!.date)}</span>
          </dd>
        </div>
      </dl>
      {m.trend && <p className="mt-2 text-lg">{m.trend.text}</p>}
      <p className="mt-2 text-base text-moss">{m.coverage}</p>
      {m.goal && <p className="mt-1 text-lg">My own goal: {goalText(m.goal)}</p>}
    </div>
  );
}

export default function AppointmentSummary() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [goals, setGoals] = useState<SummaryGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<SummaryDays>(30);
  const [name, setName] = useState('');
  const [mention, setMention] = useState('');
  const [includeMention, setIncludeMention] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const today = useMemo(() => todayLocal(), []);

  // One read covers the longest choice plus the period before it, so switching 30 and 90 is instant.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setRows([]);
    setGoals([]);
    const longest = Math.max(...SUMMARY_CHOICES);
    const { prevFrom } = periodBounds(today, longest);
    (async () => {
      try {
      const [logs, g] = await Promise.all([
        supabase.from('habit_logs').select(SUMMARY_COLUMNS.join(',')).gte('log_date', prevFrom).lte('log_date', today),
        supabase.from('goals').select('goal_type,target_value,unit'),
      ]);
      if (!alive) return;
      if (logs.error || g.error) {
        setError('We could not load your days just now. Please try again in a moment.');
      } else {
        setRows((logs.data ?? []) as unknown as SummaryRow[]);
        setGoals((g.data ?? []) as unknown as SummaryGoal[]);
      }
      } catch {
        if (alive) setError('We could not load your days just now. Please try again in a moment.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [today, attempt]);

  const summary = useMemo(() => buildSummary(rows, goals, today, days), [rows, goals, today, days]);
  const note = fewDaysNote(summary.loggedDays);
  const questions = appointmentQuestions(summary, mention);

  return (
    <div className="summary-page text-lg">
      <div className="summary-no-print mb-6 space-y-5">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Summary for my appointment</h1>
        <p className="max-w-prose text-lg text-moss">
          A look at what you logged, to bring to a visit. It is built on this device from your own days.
          Nothing is sent anywhere.
        </p>

        <div>
          <label htmlFor="summary-name" className="mb-1 block font-semibold">
            Your name (optional)
          </label>
          <input
            id="summary-name"
            className={`${input} max-w-sm`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Shown at the top of the page"
          />
          <p className="mt-1 text-base text-moss">Not saved. It is only on this page.</p>
        </div>

            <section className="summary-block summary-no-print" aria-labelledby="mention-heading">
              <h2 id="mention-heading" className="font-display text-2xl font-bold">
                Things I want to mention
              </h2>
              <textarea
                className={`${input} summary-no-print mt-2 min-h-40`}
                aria-labelledby="mention-heading"
                value={mention}
                onChange={(e) => setMention(e.target.value)}
                placeholder="Optional: what would you like to discuss? This stays on your device and is not saved."
              />
              <label className="mt-3 flex min-h-12 items-center gap-3">
                <input type="checkbox" checked={includeMention} onChange={e => setIncludeMention(e.target.checked)} className="h-5 w-5" />
                Include my written concerns in the printed report
              </label>
            </section>

        <fieldset>
          <legend className="mb-1 font-semibold">Choose 30 or 90 days</legend>
          <div className="flex gap-2">
            {SUMMARY_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={days === n}
                onClick={() => setDays(n)}
                className={`${button} border border-spruce ${days === n ? 'bg-spruce text-mist' : 'bg-white text-spruce hover:bg-mist'}`}
              >
                {n} days
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => { if (!loading && !error) window.print(); }}
          className={`${button} bg-spruce text-mist hover:bg-spruce-soft disabled:opacity-60`}
          disabled={loading || !!error}
        >
          Print or save as PDF
        </button>
        <p className="text-base text-moss">
          In the print window, choose "Save as PDF" as the printer if you want a file to share.
        </p>
      </div>

      {error && (
        <Notice kind="error" className="rounded-md border border-alert bg-white p-4">
          {error}
          <button type="button" className={`${button} summary-no-print mt-3 border border-spruce`} onClick={() => setAttempt(a => a + 1)}>Try again</button>
        </Notice>
      )}

      {loading && !error ? (
        <p role="status">Loading your days…</p>
      ) : (
        !error && (
          <article aria-label="Summary for my appointment" className="space-y-5">
            <header className="summary-block">
              <h2 className="font-display text-3xl font-bold">
                <span className="summary-print-only">{summaryTitle(name)}</span>
                <span className="summary-no-print">Your page</span>
              </h2>
              <p className="mt-1 text-lg">{formatRange(summary.from, summary.to)}</p>
              <p className="text-lg">{daysLoggedText(summary.loggedDays, summary.periodDays)}</p>
            </header>

            {note && (
              <p role="status" className="summary-block rounded-md border border-line bg-white p-4">
                {note}
              </p>
            )}

            {summary.pillars.map((p) => (
              <section key={p.key} className="summary-section space-y-3" aria-labelledby={`pillar-${p.key}`}>
                <h2 id={`pillar-${p.key}`} className="summary-block font-display text-2xl font-bold" style={{ color: PILLARS[p.key].color }}>
                  {p.name}
                  <span className="ml-2 text-lg font-normal text-moss">
                    {p.daysLogged === 1 ? '1 day logged' : `${p.daysLogged} days logged`}
                  </span>
                </h2>
                {p.measures.length === 0 ? (
                  <p className="summary-block text-moss">Days off in this time.</p>
                ) : (
                  p.measures.map((m) => <MeasureBlock key={m.key} m={m} />)
                )}
                {p.key === 'wellbeing' && p.measures.length > 0 && (
                  <p className="summary-block text-base text-moss">
                    Mood, energy and stress are your own 1 to 5 check-ins, on {summary.checkIns}{' '}
                    {summary.checkIns === 1 ? 'day' : 'days'}.
                  </p>
                )}
              </section>
            ))}



            {includeMention && mention.trim() && <section className="summary-block" aria-label="My written concerns"><h2 className="font-display text-2xl font-bold">My written concerns</h2><p className="whitespace-pre-wrap">{mention}</p></section>}
            <section className="summary-block" aria-labelledby="questions-heading">
              <h2 id="questions-heading" className="font-display text-2xl font-bold">Three questions for my visit</h2>
              <p className="text-base text-moss">Suggestions to help you prepare, based on your entries and whether you added concerns. Choose the questions that feel useful to you.</p>
              <ol className="mt-2 list-decimal space-y-2 pl-6">{questions.map(q => <li key={q}>{q}</li>)}</ol>
            </section>

            <footer className="summary-block border-t border-line pt-3 text-base text-moss">
              <p className="summary-small">{SUMMARY_FOOTER}</p>
            </footer>
          </article>
        )
      )}
    </div>
  );
}
