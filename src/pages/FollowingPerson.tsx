import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import { PILLARS } from '../lib/pillars';
import { toISODate } from '../lib/dates';
import {
  barFill,
  flagsOf,
  formatValue,
  pillarSummary,
  summariseShared,
  summaryRange,
  weekText,
  type MetricSeries,
  type SharedDay,
  type SharedGoal,
} from '../lib/careShares';
import { useFollowedPeople } from '../lib/useFollowedPeople';

const PILLAR_COLOR: Record<string, string> = {
  eat: PILLARS.nutrition.color,
  sleep: PILLARS.sleep.color,
  move: PILLARS.exercise.color,
  balance: PILLARS.wellbeing.color,
};

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' });
}

function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Seven days for one measure. A day with nothing logged is an empty slot, never a zero or a mark.
function MetricCard({ s }: { s: MetricSeries }) {
  const { metric, days, goal } = s;
  const color = PILLAR_COLOR[metric.pillar];
  const hasGoal = goal !== null;
  const top = Math.max(goal ?? 0, ...days.map((d) => d.value ?? 0), 1);
  return (
    <section aria-label={metric.label} className="rounded-lg border border-line bg-white p-4">
      <h3 className="font-display text-lg font-bold">{metric.label}</h3>
      {hasGoal && (
        <p className="text-base text-spruce/80">
          Their goal: {formatValue(goal)} {metric.unit}
        </p>
      )}
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const fill = d.value === null ? null : hasGoal ? barFill(d.value, goal) : Math.min(1, d.value / top);
          return (
            <li key={d.date} className="flex flex-col items-center text-center">
              <span className="text-base text-spruce/70">{weekdayLabel(d.date).slice(0, 3)}</span>
              <div className="relative mt-1 flex h-16 w-full items-end justify-center">
                <div className="absolute inset-y-0 w-3 rounded-full bg-mist" aria-hidden="true" />
                {fill !== null && (
                  <div className="relative w-3 rounded-full" style={{ height: `${Math.max(fill, 0.04) * 100}%`, background: color }} aria-hidden="true" />
                )}
              </div>
              <span className="mt-1 text-base font-semibold tabular-nums">
                {d.value === null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="sr-only">{dateLabel(d.date)}: no entry</span>
                  </>
                ) : (
                  <>
                    {formatValue(d.value)}
                    <span className="sr-only">
                      {' '}
                      {metric.unit} on {dateLabel(d.date)}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-base text-spruce/70">{metric.unit === 'of 5' ? 'Ratings from 1 to 5.' : `Measured in ${metric.unit}.`} A dot means no entry that day.</p>
    </section>
  );
}

export default function FollowingPerson() {
  const { ownerId = '' } = useParams();
  const { people, loading, failed } = useFollowedPeople();
  const person = people.find((p) => p.owner_id === ownerId && p.status === 'active') ?? null;

  const [days, setDays] = useState<SharedDay[] | null>(null);
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const todayIso = toISODate(new Date());

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    const { from, to } = summaryRange(toISODate(new Date()));
    Promise.all([
      supabase.rpc('shared_days', { p_owner: person.owner_id, p_from: from, p_to: to }),
      supabase.rpc('shared_goals', { p_owner: person.owner_id }),
    ]).then(([d, g]) => {
      if (cancelled) return;
      const failure = d.error ?? g.error;
      if (failure) return setError(failure.message);
      setError(null);
      setDays((d.data ?? []) as SharedDay[]);
      setGoals((g.data ?? []) as SharedGoal[]);
    });
    return () => {
      cancelled = true;
    };
  }, [person?.owner_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(
    () => (person && days ? summariseShared(days, flagsOf(person), goals, todayIso) : null),
    [person, days, goals, todayIso],
  );

  if (loading) return <p role="status" className="text-base text-spruce/70">Loading…</p>;

  if (!person) {
    return (
      <>
        <PageHeader title="Following" />
        {failed && <p role="alert" className="mb-3 text-base text-alert">Could not load this page: {failed}</p>}
        <p className="max-w-xl text-base text-spruce/80">You are not following this person. This may have ended, or the invitation is still waiting.</p>
        <Link to="/following" className="mt-4 inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4">
          Back to Following
        </Link>
      </>
    );
  }

  const name = person.owner_name;
  return (
    <>
      <PageHeader title={`Following ${name}`}>
        Shared with you: {pillarSummary(flagsOf(person))}. This is a read-only view. {name} chooses what you see.
      </PageHeader>
      <Link to="/following" className="-mt-4 mb-6 inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4">
        Back to Following
      </Link>

      {error && <p role="alert" className="mb-4 max-w-xl text-base text-alert">Could not load {name}’s days: {error}</p>}
      {!error && !summary && <p role="status" className="text-base text-spruce/70">Loading…</p>}

      {summary && (
        <>
          <section aria-labelledby="rhythm" className="max-w-xl rounded-lg border border-line bg-white p-6">
            <h2 id="rhythm" className="font-display text-xl font-bold">
              The last four weeks
            </h2>
            <p className="mt-1 text-base text-spruce/80">Days {name} logged each week. Any four days in seven makes a full week.</p>
            <ul className="mt-3 divide-y divide-line">
              {[...summary.weeks].reverse().map((w, i) => (
                <li key={w.end} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                  <span className="text-base font-medium">
                    {i === 0 ? 'Latest week' : `${i} ${i === 1 ? 'week' : 'weeks'} earlier`}
                    <span className="text-spruce/70">
                      {' '}
                      · {dateLabel(w.start)} to {dateLabel(w.end)}
                    </span>
                  </span>
                  <span className="text-base font-semibold">{weekText(w)}</span>
                </li>
              ))}
            </ul>
            {summary.weeksInRow >= 2 && <p className="mt-3 text-base text-spruce/80">{summary.weeksInRow} full weeks in a row.</p>}
          </section>

          <h2 className="mt-8 font-display text-xl font-bold">The last seven days</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {summary.metrics.map((m) => (
              <MetricCard key={m.metric.field} s={m} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
