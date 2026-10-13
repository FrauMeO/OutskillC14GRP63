import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import {
  FACTORS,
  MIN_LOGGED_DAYS,
  factorCatalog,
  MIN_PAIRED_LIKELY,
  runInsights,
  type Comparison,
  type FactorGroup,
  type InsightDay,
  type InsightsResult,
} from '../lib/insights/engine';
import { invitations, lastFourWeeks, weekVsUsual, type Invitation, type Overview, type WeekLine } from '../lib/insights/overview';
import { PILLARS } from '../lib/pillars';
import { toISODate } from '../lib/dates';

const GROUP_ORDER: FactorGroup[] = [...new Set(FACTORS.map((f) => f.group))];

function Grouped({ items, tone }: { items: Comparison[]; tone: 'likely' | 'explore' }) {
  return (
    <div className="mt-4 space-y-5">
      {GROUP_ORDER.filter((g) => items.some((c) => c.factor.group === g)).map((group) => (
        <div key={group}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-moss">{group}</h3>
          <ul className="mt-2 space-y-2">
            {items
              .filter((c) => c.factor.group === group)
              .map((c) => (
                <li
                  key={`${c.factor.key}-${c.measure.key}`}
                  className={`rounded-lg border bg-white p-4 ${tone === 'likely' ? 'border-current/40' : 'border-dashed border-line'}`}
                >
                  <p>{c.sentence}</p>
                  {tone === 'explore' && (
                    <p className="mt-1 text-sm text-moss">Early hint. This may disappear as you log more days.</p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

type Summary = { overview: Overview; week: WeekLine[]; invites: Invitation[] };

// Suggested by Michael (team feedback): something useful at the top from the first week on.
function OverviewSection({ summary }: { summary: Summary }) {
  const { overview, week, invites } = summary;
  return (
    <section aria-labelledby="overview" className="max-w-3xl space-y-6">
      <div>
        <h2 id="overview" className="font-display text-2xl font-bold">
          Your last four weeks
        </h2>
        <p className="mt-1 text-moss">
          You logged {overview.loggedDays} {overview.loggedDays === 1 ? 'day' : 'days'}. Every one of them counts.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {overview.byPillar.map((p) => (
            <li
              key={p.pillar}
              className="rounded-full border border-line bg-white px-3 py-1 text-sm"
              style={{ borderLeft: `4px solid ${PILLARS[p.pillar].color}` }}
            >
              <span className="font-semibold">{p.name}</span> {p.days} {p.days === 1 ? 'day' : 'days'}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-display text-xl font-bold">This week and your usual</h3>
        <p className="mt-1 text-sm text-moss">
          This week's middle value compared with your own eight weeks before it. Only you, never anyone else.
        </p>
        {week.length ? (
          <ul className="mt-3 space-y-2">
            {week.map((w) => (
              <li
                key={w.key}
                className="rounded-lg border border-line bg-white p-4"
                style={{ borderLeft: `4px solid ${PILLARS[w.pillar].color}` }}
              >
                <span className="font-semibold">{w.label}.</span> {w.sentence}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-moss">
            This appears once you have a few days this week and a week or two before it to compare with.
          </p>
        )}
      </div>

      {invites.length > 0 && (
        <div>
          <h3 className="font-display text-xl font-bold">Something to try, if you like</h3>
          <p className="mt-1 text-sm text-moss">
            Small ideas from what has gone together in your own days. Not advice, and not a cause.
          </p>
          <ul className="mt-3 space-y-2">
            {invites.map((i) => (
              <li key={i.key} className="rounded-lg border border-dashed border-line bg-white p-4">
                <p>{i.text}</p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold text-moss underline underline-offset-4">
                    Why am I seeing this?
                  </summary>
                  <p className="mt-2 text-moss">{i.why}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Every weather factor Insights checks, so people can see the depth even before patterns appear.
function WhatWeLookAt() {
  const catalog = factorCatalog();
  const total = catalog.reduce((n, g) => n + g.items.length, 0);
  return (
    <details className="max-w-3xl rounded-lg border border-line bg-white p-5">
      <summary className="cursor-pointer font-display text-xl font-bold">What Insights looks at ({total} weather factors)</summary>
      <p className="mt-2 text-sm text-moss">
        Each logged day is paired with its real weather. Insights compares every factor below with your own days, checks all
        the comparisons together so chance findings are not shown as facts, and only ever says what went together, never
        what caused what.
      </p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {catalog.map((g) => (
          <div key={g.group}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-moss">{g.group}</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {g.items.map((i) => (
                <li key={i.key}>
                  {i.label}
                  <span className="block text-xs text-moss">Compared with {i.comparedWith}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function Insights() {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setResult(null);
    setSummary(null);
    const [logs, conditions] = await Promise.all([
      supabase
        .from('habit_logs')
        .select(
          'log_date, exercise_minutes, steps, stand_hours, active_calories, sleep_hours, time_in_bed_hours, awake_minutes, water_liters, calories_consumed, mood, energy, stress',
        ),
      supabase.from('daily_conditions').select('*'),
    ]);
    if (logs.error || conditions.error) {
      setError(`Could not load your data: ${(logs.error ?? conditions.error)!.message}`);
      return;
    }
    const byDate = new Map((conditions.data ?? []).map((c) => [c.date, c as unknown as Record<string, number | null>]));
    const days: InsightDay[] = (logs.data ?? []).map((l) => ({
      date: l.log_date,
      measures: l,
      conditions: byDate.get(l.log_date) ?? null,
    }));
    const insights = runInsights(days);
    const todayIso = toISODate(new Date());
    const rows = logs.data ?? [];
    const week = weekVsUsual(rows, todayIso);
    const patterns = insights.ready ? [...insights.likely, ...insights.explore] : [];
    setSummary({ overview: lastFourWeeks(rows, todayIso), week, invites: invitations(patterns, week) });
    setResult(insights);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Insights">
        Patterns between your local conditions and your habits and check-ins. They show what tends to happen together,
        not what causes what.
      </PageHeader>

      {error && (
        <div role="alert" className="mb-6 max-w-2xl rounded-md bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}{' '}
          <button type="button" onClick={load} className="ml-2 font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      {!result && !error && (
        <p role="status" className="text-moss">
          Looking for patterns…
        </p>
      )}

      {summary && (
        <div className="mb-10">
          <OverviewSection summary={summary} />
        </div>
      )}

      {result && !result.ready && (
        <section aria-labelledby="progress" className="max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 id="progress" className="font-display text-xl font-bold">
            {result.loggedDays} of {MIN_LOGGED_DAYS} days logged
          </h2>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={MIN_LOGGED_DAYS}
            aria-valuenow={result.loggedDays}
            aria-label="Days logged toward insights"
            className="mt-3 h-3 overflow-hidden rounded-full bg-mist"
          >
            <div className="h-full bg-current" style={{ width: `${(result.loggedDays / MIN_LOGGED_DAYS) * 100}%` }} />
          </div>
          <p className="mt-3 text-moss">
            Insights appear after {MIN_LOGGED_DAYS} logged days. Keep logging, and they will show up here.
          </p>
        </section>
      )}

      {result && !result.ready && (
        <div className="mt-6">
          <WhatWeLookAt />
        </div>
      )}

      {result && result.ready && (
        <div className="max-w-3xl space-y-10">
          <section aria-labelledby="likely">
            <h2 id="likely" className="font-display text-2xl font-bold">
              Likely patterns
            </h2>
            <p className="mt-1 text-sm text-moss">
              These held up after checking every comparison together, with at least {MIN_PAIRED_LIKELY} days of data.
            </p>
            {result.likely.length ? (
              <Grouped items={result.likely} tone="likely" />
            ) : (
              <p className="mt-4 text-moss">
                Nothing has held up yet across all {result.tested} comparisons, and that is normal early on. A pattern only
                shows here once it is strong enough that chance is an unlikely explanation. Early hints are below.
              </p>
            )}
          </section>

          <section aria-labelledby="explore">
            <h2 id="explore" className="font-display text-2xl font-bold">
              Worth exploring
            </h2>
            <p className="mt-1 text-sm text-moss">
              Early hints that stand out on their own but did not hold up once every comparison was checked together.
            </p>
            {result.explore.length ? (
              <Grouped items={result.explore} tone="explore" />
            ) : (
              <p className="mt-4 text-moss">Nothing to explore yet.</p>
            )}
          </section>

          <WhatWeLookAt />

          <footer className="border-t border-line pt-4 text-sm text-moss">
            <p>
              Based on {result.loggedDays} logged days and {result.tested} comparisons. Pollen shows only in Europe; elsewhere it
              is not available in your area.
            </p>
            <p className="mt-1">
              Weather and air-quality data by{' '}
              <a href="https://open-meteo.com/" className="underline underline-offset-4" target="_blank" rel="noreferrer">
                Open-Meteo.com
              </a>{' '}
              (CC BY 4.0), used under its free non-commercial terms.
            </p>
          </footer>
        </div>
      )}
    </>
  );
}
