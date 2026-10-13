import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  SUMMARY_CHOICES, SUMMARY_COLUMNS, SUMMARY_FOOTER, buildSummary, daysLoggedText, fewDaysNote, formatDate,
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
  const today = useMemo(() => todayLocal(), []);

  // One read covers the longest choice plus the period before it, so switching 30 and 90 is instant.
  useEffect(() => {
    let alive = true;
    const longest = Math.max(...SUMMARY_CHOICES);
    const { prevFrom } = periodBounds(today, longest);
    (async () => {
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
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [today]);

  const summary = useMemo(() => buildSummary(rows, goals, today, days), [rows, goals, today, days]);
  const note = fewDaysNote(summary.loggedDays);

  return (
    <div className="summary-page text-lg">
      <div className="summary-no-print mb-6 space-y-5">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Summary for my appointment</h1>
        <p className="max-w-prose text-lg text-moss">
          A one-page look at what you logged, to bring to a visit. It is built on this device from your own days.
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
          onClick={() => window.print()}
          className={`${button} bg-spruce text-mist hover:bg-spruce-soft disabled:opacity-60`}
          disabled={loading}
        >
          Print or save as PDF
        </button>
        <p className="text-base text-moss">
          In the print window, choose "Save as PDF" as the printer if you want a file to share.
        </p>
      </div>

      {error && (
        <Notice kind="error" className="summary-no-print rounded-md border border-alert bg-white p-4">
          {error}
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

            <section className="summary-block" aria-labelledby="mention-heading">
              <h2 id="mention-heading" className="font-display text-2xl font-bold">
                Things I want to mention
              </h2>
              <textarea
                className={`${input} summary-no-print mt-2 min-h-40`}
                aria-labelledby="mention-heading"
                value={mention}
                onChange={(e) => setMention(e.target.value)}
                placeholder="Write anything you want to say at the visit. It is not saved and it prints with this page."
              />
              <p className="summary-print-only mt-2 min-h-32 whitespace-pre-wrap border border-line p-3">{mention}</p>
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
