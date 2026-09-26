import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toISODate } from '../lib/dates';
import PageHeader from '../components/PageHeader';
import ProgressIndicator from '../components/ProgressIndicator';
import TrendChart, { type TrendMetric } from '../components/TrendChart';
import { FEELINGS, RATING_SCALES } from '../lib/checkin';
import type { GoalConfig } from '../lib/goals';
import {
  CATEGORY_FIELDS,
  CATEGORY_LABELS,
  addDays,
  goalTargets,
  goalsIn,
  indicatorFor,
  loggingStreak,
  netCalories,
  num,
  progress,
  series,
  type Streak,
} from '../lib/dashboard';

type Row = Record<string, unknown> & { log_date: string };

const COLORS = {
  exercise: 'var(--color-ember)',
  sleep: 'var(--color-dusk)',
  water: 'var(--color-current)',
  nutrition: 'var(--color-sprout)',
  wellbeing: 'var(--color-bloom)',
};

const fmtNumber = (n: number, decimals = 0) => n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });

function Card({ title, accent, children }: { title: string; accent: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="relative overflow-hidden rounded-lg border border-line bg-white p-5 pl-6">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} aria-hidden />
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

// One goal-tracked metric: today's value, the goal, the percentage (text and graphic).
function GoalMetric({ cfg, row, goal, color }: { cfg: GoalConfig; row: Row | undefined; goal: number | null; color: string }) {
  const value = num(row, cfg.field);
  const decimals = cfg.step < 1 ? 1 : 0;
  const p = progress(value, goal);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{cfg.label}</span>
        <span className="text-sm">
          {value === null ? (
            <span className="text-spruce/60">Not logged</span>
          ) : (
            <>
              <strong className="tabular-nums">{fmtNumber(value, decimals)}</strong> {cfg.short}
              {goal !== null && (
                <span className="text-spruce/60">
                  {' '}
                  of {fmtNumber(goal, decimals)}
                </span>
              )}
            </>
          )}
        </span>
      </div>
      {goal === null ? (
        <Link to="/goals" className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
          Set a goal
        </Link>
      ) : p ? (
        <div className="mt-1.5">
          <ProgressIndicator
            kind={indicatorFor(row?.source as string | undefined)}
            progress={p}
            color={color}
            label={`${cfg.label}: ${fmtNumber(p.value, decimals)} of ${fmtNumber(p.goal, decimals)} ${cfg.short}, ${p.percent} percent`}
          />
        </div>
      ) : null}
    </div>
  );
}

function Value({ label, value, unit, decimals = 0 }: { label: string; value: number | null; unit: string; decimals?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {value === null ? (
        <span className="text-spruce/60">Not logged</span>
      ) : (
        <span>
          <strong className="tabular-nums">{fmtNumber(value, decimals)}</strong> {unit}
        </span>
      )}
    </div>
  );
}

function StreakBanner({ streak }: { streak: Streak }) {
  const missing = streak.todayMissing.map((c) => CATEGORY_LABELS[c]);
  return (
    <section aria-labelledby="streak" className="mb-6 rounded-lg border border-line bg-white p-5">
      <h2 id="streak" className="font-display text-2xl font-bold">
        {streak.days === 0 ? 'No logging streak yet' : `${streak.days}-day logging streak`}
      </h2>
      <p className="mt-1 text-spruce/75">
        {streak.todayComplete
          ? 'Today is fully logged. Nice work.'
          : `${streak.days > 0 ? 'Counting through yesterday. ' : ''}Still to log today: ${missing.join(', ')}.`}{' '}
        A day counts when Exercise, Sleep, Nutrition and Wellbeing each have at least one entry.
      </p>
      {!streak.todayComplete && (
        <Link to="/habits" className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Log today
        </Link>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="space-y-6">
      <div className="h-24 animate-pulse rounded-lg bg-white" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-white" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [streakRows, setStreakRows] = useState<Row[]>([]);
  const [goals, setGoals] = useState<{ goal_type: string; target_value: unknown }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const todayIso = toISODate(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const streakFields = ['log_date', ...Object.values(CATEGORY_FIELDS).flat()].join(', ');
    // RLS limits every query to the signed-in user's rows; no user_id filter is needed.
    const [profileRes, logsRes, streakRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase.from('habit_logs').select('*').gte('log_date', addDays(todayIso, -6)).lte('log_date', todayIso),
      // Separate query for the streak: only dates and the category columns, up to 365 days.
      supabase.from('habit_logs').select(streakFields).gte('log_date', addDays(todayIso, -364)).lte('log_date', todayIso),
      supabase.from('goals').select('goal_type, target_value'),
    ]);
    const firstError = profileRes.error ?? logsRes.error ?? streakRes.error ?? goalsRes.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      setName(profileRes.data?.full_name ?? null);
      setRows((logsRes.data ?? []) as unknown as Row[]);
      setStreakRows((streakRes.data ?? []) as unknown as Row[]);
      setGoals(goalsRes.data ?? []);
    }
    setLoading(false);
  }, [user, todayIso]);

  useEffect(() => {
    load();
  }, [load]);

  const firstName = name?.split(' ')[0];
  const today = rows.find((r) => r.log_date === todayIso);
  const targets = goalTargets(goals);
  const goalOf = (cfg: GoalConfig) => targets[cfg.value] ?? null;

  const header = (
    <PageHeader title={firstName ? `Hello, ${firstName}` : 'Your dashboard'}>
      Today against your goals, and how the last seven days went.
    </PageHeader>
  );

  if (loading) return (<>{header}<Skeleton /></>);

  if (error) {
    return (
      <>
        {header}
        <div role="alert" className="max-w-2xl rounded-md bg-alert/10 px-4 py-3 text-alert">
          Could not load your dashboard: {error}{' '}
          <button type="button" onClick={load} className="ml-1 min-h-11 font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      </>
    );
  }

  if (streakRows.length === 0) {
    return (
      <>
        {header}
        <section className="max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 className="font-display text-2xl font-bold">Welcome! Let's log your first day.</h2>
          <p className="mt-2 text-spruce/75">
            Your cards, charts and streak fill in as you log. It takes about a minute.
          </p>
          <Link to="/habits" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft">
            Log today
          </Link>
        </section>
      </>
    );
  }

  const streak = loggingStreak(streakRows, todayIso);
  const net = netCalories(today);
  const moodScale = RATING_SCALES[0];
  const mood = num(today, 'mood');
  const feelings = ((today?.feelings as string[] | null) ?? [])
    .map((f) => FEELINGS.find((x) => x.value === f))
    .filter((f): f is (typeof FEELINGS)[number] => Boolean(f));
  const note = typeof today?.notes === 'string' && today.notes.trim() ? today.notes.trim() : null;

  const trend = (cfg: GoalConfig): TrendMetric => ({
    key: cfg.value,
    label: cfg.label,
    unit: cfg.short,
    points: series(rows, cfg.field, todayIso),
    goal: goalOf(cfg),
    decimals: cfg.step < 1 ? 1 : 0,
  });
  const plain = (key: string, label: string, unit: string, decimals = 0, domain?: [number, number]): TrendMetric => ({
    key, label, unit, points: series(rows, key, todayIso), goal: null, decimals, domain,
  });
  const netPoints = series(rows, 'calories_consumed', todayIso).map((p) => ({
    date: p.date,
    value: netCalories(rows.find((r) => r.log_date === p.date)),
  }));

  return (
    <>
      {header}
      <StreakBanner streak={streak} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Exercise" accent={COLORS.exercise}>
          {goalsIn('exercise').map((cfg) => (
            <GoalMetric key={cfg.value} cfg={cfg} row={today} goal={goalOf(cfg)} color={COLORS.exercise} />
          ))}
        </Card>

        <Card title="Sleep" accent={COLORS.sleep}>
          {goalsIn('sleep').map((cfg) => (
            <GoalMetric key={cfg.value} cfg={cfg} row={today} goal={goalOf(cfg)} color={COLORS.sleep} />
          ))}
          <Value label="Time in bed" value={num(today, 'time_in_bed_hours')} unit="h" decimals={1} />
          <Value label="Awake in bed" value={num(today, 'awake_minutes')} unit="min" />
        </Card>

        <Card title="Nutrition" accent={COLORS.nutrition}>
          {goalsIn('nutrition').map((cfg) => (
            <GoalMetric
              key={cfg.value}
              cfg={cfg}
              row={today}
              goal={goalOf(cfg)}
              color={cfg.value === 'water' ? COLORS.water : COLORS.nutrition}
            />
          ))}
          <Value label="Net calories (eaten minus active)" value={net} unit="kcal" />
        </Card>

        <Card title="Wellbeing" accent={COLORS.wellbeing}>
          {mood === null ? (
            <p className="text-sm text-spruce/60">Mood not logged today.</p>
          ) : (
            <p className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden>
                {moodScale.faces![mood - 1]}
              </span>
              <span>
                <span className="block text-sm font-medium">Mood</span>
                <span className="font-semibold">{moodScale.levels[mood - 1]}</span>
              </span>
            </p>
          )}
          {RATING_SCALES.slice(1).map((scale) => {
            const v = num(today, scale.key);
            return (
              <div key={scale.key} className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{scale.label}</span>
                {v === null ? <span className="text-spruce/60">Not logged</span> : <span className="font-semibold">{scale.levels[v - 1]}</span>}
              </div>
            );
          })}
          {feelings.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Feelings today">
              {feelings.map((f) => (
                <li key={f.value} className="rounded-full border border-line px-3 py-1 text-sm">
                  <span aria-hidden>{f.face}</span> {f.label}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Notes" accent="var(--color-sage)">
          {note ? (
            <>
              <p className="line-clamp-4 whitespace-pre-line">{note}</p>
              <Link to="/habits" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
                Open today's entry
              </Link>
            </>
          ) : (
            <Link to="/habits" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Add a note
            </Link>
          )}
        </Card>
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold">Last 7 days</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TrendChart title="Exercise" color={COLORS.exercise} metrics={goalsIn('exercise').map(trend)} />
        <TrendChart
          title="Sleep"
          color={COLORS.sleep}
          metrics={[...goalsIn('sleep').map(trend), plain('time_in_bed_hours', 'Time in bed', 'h', 1), plain('awake_minutes', 'Awake in bed', 'min')]}
        />
        <TrendChart
          title="Nutrition"
          color={COLORS.nutrition}
          metrics={[
            ...goalsIn('nutrition').map(trend),
            { key: 'net', label: 'Net calories', unit: 'kcal', points: netPoints, goal: null, decimals: 0 },
          ]}
        />
        <TrendChart
          title="Wellbeing"
          color={COLORS.wellbeing}
          metrics={RATING_SCALES.map((s) => plain(s.key, s.label, '', 0, [1, 5]))}
        />
      </div>
    </>
  );
}
