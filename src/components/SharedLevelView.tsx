import { useMemo } from 'react';
import { PILLARS } from '../lib/pillars';
import {
  barFill,
  formatValue,
  summariseShared,
  weekText,
  type MetricSeries,
  type PillarFlags,
  type ShareLevel,
  type WeekSummary,
  type SharedDay,
  type SharedGoal,
} from '../lib/careShares';
import { pillarWeekLine, presenceSummary, presenceText, type PillarWeek } from '../lib/careShareLevels';

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

function weekLabel(i: number): string {
  return i === 0 ? 'Latest week' : `${i} ${i === 1 ? 'week' : 'weeks'} earlier`;
}

// Seven days for one measure. A day with nothing logged is an empty slot, never a zero or a mark.
function MetricCard({ s }: { s: MetricSeries }) {
  const { metric, days, goal } = s;
  const color = PILLAR_COLOR[metric.pillar];
  const hasGoal = goal !== null;
  const top = Math.max(goal ?? 0, ...days.map((d) => d.value ?? 0), 1);
  return (
    <section aria-label={metric.label} className="rounded-lg border border-line bg-white p-4">
      <h3 className="font-display text-xl font-bold">{metric.label}</h3>
      {hasGoal && (
        <p className="text-lg text-moss">
          Their goal: {formatValue(goal)} {metric.unit}
        </p>
      )}
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const fill = d.value === null ? null : hasGoal ? barFill(d.value, goal) : Math.min(1, d.value / top);
          return (
            <li key={d.date} className="flex min-w-0 flex-col items-center text-center">
              <span className="text-sm text-moss" aria-hidden="true">
                {weekdayLabel(d.date).slice(0, 3)}
              </span>
              <div className="relative mt-1 flex h-16 w-full items-end justify-center">
                <div className="absolute inset-y-0 w-3 rounded-full bg-mist" aria-hidden="true" />
                {fill !== null && (
                  <div className="relative w-3 rounded-full" style={{ height: `${Math.max(fill, 0.04) * 100}%`, background: color }} aria-hidden="true" />
                )}
              </div>
              <span className="mt-1 text-lg font-semibold tabular-nums">
                {d.value === null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="sr-only">{weekdayLabel(d.date)} {dateLabel(d.date)}: Day off</span>
                  </>
                ) : (
                  <>
                    {formatValue(d.value)}
                    <span className="sr-only">
                      {' '}
                      {metric.unit} on {weekdayLabel(d.date)} {dateLabel(d.date)}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-lg text-moss">{metric.unit === 'of 5' ? 'Ratings from 1 to 5.' : `Measured in ${metric.unit}.`} A dot means a Day off.</p>
    </section>
  );
}

function RhythmList({ weeks, name }: { weeks: WeekSummary[]; name: string }) {
  return (
    <section aria-labelledby="rhythm" className="max-w-xl rounded-lg border border-line bg-white p-6">
      <h2 id="rhythm" className="font-display text-2xl font-bold">
        The last four weeks
      </h2>
      <p className="mt-1 text-lg text-moss">Days {name} logged each week. Any four days in seven makes a full week.</p>
      <ul className="mt-3 divide-y divide-line">
        {[...weeks].reverse().map((w, i) => (
          <li key={w.end} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
            <span className="text-lg font-medium">
              {weekLabel(i)}
              <span className="text-moss">
                {' '}
                · {dateLabel(w.start)} to {dateLabel(w.end)}
              </span>
            </span>
            <span className="text-lg font-semibold">{weekText(w)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What a supporter sees at each level. Used by the supporter page (real rows from the database)
 * and by the owner's preview (the same shapes, computed from the owner's own entries), so the
 * preview cannot drift from the real thing.
 */
export default function SharedLevelView({
  level,
  name,
  flags,
  days,
  weekRows,
  goals,
  todayIso,
}: {
  level: ShareLevel;
  name: string; // "Anna", or "you" in the preview
  flags: PillarFlags;
  days: SharedDay[];
  weekRows: PillarWeek[];
  goals: SharedGoal[];
  todayIso: string;
}) {
  const detail = useMemo(() => (level === 'detail' ? summariseShared(days, flags, goals, todayIso) : null), [level, days, flags, goals, todayIso]);
  const presence = useMemo(() => (level === 'presence' ? presenceSummary(days, todayIso) : null), [level, days, todayIso]);

  if (level === 'presence' && presence) {
    return (
      <>
        <section aria-labelledby="lastseven" className="max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 id="lastseven" className="font-display text-2xl font-bold">
            The last seven days
          </h2>
          <p className="mt-2 text-lg font-semibold">{presenceText(presence.last7)}</p>
          <p className="mt-1 text-lg text-moss">This is all that is shared at this level: just that a day was logged.</p>
        </section>
        <div className="mt-6">
          <RhythmList weeks={presence.weeks} name={name} />
        </div>
      </>
    );
  }

  if (level === 'summary') {
    return (
      <section aria-labelledby="weeksummary" className="max-w-xl rounded-lg border border-line bg-white p-6">
        <h2 id="weeksummary" className="font-display text-2xl font-bold">
          This week, in words
        </h2>
        <p className="mt-1 text-lg text-moss">Compared with {name === 'you' ? 'your' : `${name}’s`} own usual. No numbers are shared.</p>
        {weekRows.length === 0 ? (
          <p className="mt-3 text-lg">Nothing to show yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {weekRows.map((w) => (
              <li key={w.pillar} className="py-2">
                <p className="text-lg font-semibold">{pillarWeekLine(w, name)}</p>
                <p className="text-lg text-moss">
                  Logged on {w.days_logged} of the last 7 days.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (detail) {
    return (
      <>
        <RhythmList weeks={detail.weeks} name={name} />
        <h2 className="mt-8 font-display text-2xl font-bold">The last seven days</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {detail.metrics.map((m) => (
            <MetricCard key={m.metric.field} s={m} />
          ))}
        </div>
      </>
    );
  }
  return null;
}
