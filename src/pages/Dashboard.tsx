import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toISODate } from '../lib/dates';
import PageHeader from '../components/PageHeader';
import ProgressIndicator from '../components/ProgressIndicator';
import TrendChart, { type TrendMetric } from '../components/TrendChart';
import { isNetworkError, overlayPending } from '../lib/offlineQueue';
import { loadDashboardCache, pendingEntries, saveDashboardCache } from '../lib/offlineSync';
import { FEELINGS, RATING_SCALES } from '../lib/checkin';
import type { GoalConfig } from '../lib/goals';
import { OFFER_TEXT, checkinState, type DayRow } from '../lib/reflection';
import { PILLARS } from '../lib/pillars';
import AiReflectionCard from '../features/aiReflection/AiReflectionCard';
import TodayWeather from '../components/TodayWeather';
import SharedWithLine from '../components/SharedWithLine';
import {
  CATEGORY_FIELDS,
  FULL_WEEK_DAYS,
  addDays,
  goalTargets,
  goalsIn,
  indicatorFor,
  netCalories,
  num,
  progress,
  rhythmText,
  series,
  weeklyRhythm,
  type Rhythm,
} from '../lib/dashboard';
import Notice from '../components/Notice';

type Row = Record<string, unknown> & { log_date: string };

const COLORS = {
  exercise: 'var(--color-ember)',
  sleep: 'var(--color-dusk)',
  water: 'var(--color-current)',
  nutrition: 'var(--color-sprout)',
  wellbeing: 'var(--color-bloom)',
};

const fmtNumber = (n: number, decimals = 0) => n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });

function Card({ title, subtitle, accent, children }: { title: string; subtitle?: string; accent: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="relative overflow-hidden rounded-lg border border-line bg-white p-5 pl-6">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} aria-hidden />
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-moss">{subtitle}</p>}
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
            <span className="text-moss">Day off</span>
          ) : (
            <>
              <strong className="tabular-nums">{fmtNumber(value, decimals)}</strong> {cfg.short}
              {goal !== null && (
                <span className="text-moss">
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
        <span className="text-moss">Day off</span>
      ) : (
        <span>
          <strong className="tabular-nums">{fmtNumber(value, decimals)}</strong> {unit}
        </span>
      )}
    </div>
  );
}

// Weekly rhythm, not a daily streak (see weeklyRhythm in lib/dashboard.ts): rest days count,
// and nothing ever says a streak was lost.
function RhythmBanner({ rhythm }: { rhythm: Rhythm }) {
  const { title, body } = rhythmText(rhythm);
  return (
    <section aria-labelledby="rhythm" className="mb-6 rounded-lg border border-line bg-white p-5">
      <h2 id="rhythm" className="font-display text-2xl font-bold">
        {title}
      </h2>
      <p className="mt-1 text-moss">{body}</p>
      <p className="mt-1 text-sm text-moss">
        Rest days are part of the rhythm: any {FULL_WEEK_DAYS} logged days in seven make a full week.
      </p>
      {!rhythm.loggedToday && (
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
  const [autoReflection, setAutoReflection] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [streakRows, setStreakRows] = useState<Row[]>([]);
  const [goals, setGoals] = useState<{ goal_type: string; target_value: unknown }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the page shows the copy kept on this device (no connection): when it was saved.
  const [offlineSavedAt, setOfflineSavedAt] = useState<string | null>(null);
  const [checkinOffer, setCheckinOffer] = useState<string | null>(null); // reflections row id
  const offerChecked = useRef(false);

  const todayIso = toISODate(new Date());

  // Fills the page from the read-only copy kept on this device. False when there is none.
  const showCached = useCallback(async (userId: string): Promise<boolean> => {
    const cached = await loadDashboardCache(userId);
    if (!cached) return false;
    const waiting = await pendingEntries(userId); // days logged offline and not uploaded yet
    setName(cached.name);
    setAutoReflection(false);
    setRows(overlayPending(cached.rows, waiting) as Row[]);
    setStreakRows(overlayPending(cached.streakRows, waiting) as Row[]);
    setGoals(cached.goals);
    setOfflineSavedAt(cached.savedAt);
    return true;
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    // With no connection at all, go straight to the copy on this device (no waiting for requests to fail).
    if (!navigator.onLine && (await showCached(user.id))) return setLoading(false);
    const streakFields = ['log_date', ...Object.values(CATEGORY_FIELDS).flat()].join(', ');
    // RLS limits every query to the signed-in user's rows; no user_id filter is needed.
    const [profileRes, logsRes, streakRes, goalsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, auto_reflection').eq('id', user.id).maybeSingle(),
      supabase.from('habit_logs').select('*').gte('log_date', addDays(todayIso, -6)).lte('log_date', todayIso),
      // Separate query for the weekly rhythm: only dates and the category columns, up to 365 days.
      supabase.from('habit_logs').select(streakFields).gte('log_date', addDays(todayIso, -364)).lte('log_date', todayIso),
      supabase.from('goals').select('goal_type, target_value'),
    ]);
    const firstError = profileRes.error ?? logsRes.error ?? streakRes.error ?? goalsRes.error;
    if (firstError) {
      // No connection: show the read-only copy of this person's own last 30 days, if there is one.
      const offline = !navigator.onLine || isNetworkError(firstError);
      if (offline && (await showCached(user.id))) {
        // shown below the header as "You are offline"
      } else {
        setError(
          offline
            ? 'You are offline, and nothing is saved on this device yet. Open the app once with a connection and your last days will be here next time.'
            : firstError.message,
        );
      }
    } else {
      setOfflineSavedAt(null);
      setName(profileRes.data?.full_name ?? null);
      setAutoReflection(profileRes.data?.auto_reflection ?? false);
      const freshRows = (logsRes.data ?? []) as unknown as Row[];
      const freshStreak = (streakRes.data ?? []) as unknown as Row[];
      setRows(freshRows);
      setStreakRows(freshStreak);
      setGoals(goalsRes.data ?? []);
      // Replace the on-device copy (own data only; see src/lib/offlineCache.ts).
      void saveDashboardCache(
        user.id,
        {
          name: profileRes.data?.full_name ?? null,
          autoReflection: profileRes.data?.auto_reflection ?? false,
          rows: freshRows,
          streakRows: freshStreak,
          goals: goalsRes.data ?? [],
        },
        todayIso,
      );
    }
    setLoading(false);
  }, [user, todayIso, showCached]);

  // Gentle check-in: decided by the rules in src/lib/reflection.ts (more than 10 sequential days of
  // check-ins, 7 of the last 14 harder, not offered in 14 days, setting on). Each offer is saved,
  // so the 14-day limit counts it whether or not the person reflects.
  useEffect(() => {
    if (!user || loading || offerChecked.current || streakRows.length === 0) return;
    offerChecked.current = true;
    (async () => {
      const [profile, offers] = await Promise.all([
        supabase.from('profiles').select('gentle_checkin_enabled').eq('id', user.id).maybeSingle(),
        supabase.from('reflections').select('id, offered_on, taken_on').order('offered_on', { ascending: false }).limit(5),
      ]);
      if (profile.error || offers.error) return; // never block the dashboard on this
      const days: DayRow[] = streakRows.map((r) => ({ log_date: r.log_date, mood: num(r, 'mood'), stress: num(r, 'stress') }));
      const state = checkinState({ enabled: profile.data?.gentle_checkin_enabled ?? true, days, offers: offers.data ?? [], todayIso });
      if (!state.show) return;
      const existing = (offers.data ?? []).find((o) => o.offered_on === todayIso && !o.taken_on);
      if (existing) return setCheckinOffer(existing.id);
      const { data } = await supabase.from('reflections').insert({ offered_on: todayIso }).select('id').single();
      if (data) setCheckinOffer(data.id);
    })();
  }, [user, loading, streakRows, todayIso]);

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
        <Notice kind="error" as="div" className="max-w-2xl rounded-md bg-alert/10 px-4 py-3">
          Could not load your dashboard: {error}{' '}
          <button type="button" onClick={load} className="ml-1 min-h-11 font-semibold underline underline-offset-4">
            Try again
          </button>
        </Notice>
      </>
    );
  }

  if (streakRows.length === 0) {
    return (
      <>
        {header}
        <section className="max-w-xl rounded-lg border border-line bg-white p-6">
          <h2 className="font-display text-2xl font-bold">Welcome. Let's log your first day.</h2>
          <p className="mt-2 text-moss">
            Your cards, charts and weekly rhythm fill in as you log. It takes about a minute.
          </p>
          <Link to="/habits" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft">
            Log today
          </Link>
        </section>
      </>
    );
  }

  const rhythm = weeklyRhythm(streakRows, todayIso);
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
      {offlineSavedAt && (
        <p role="status" className="mb-6 rounded-md border border-line bg-white px-4 py-3 text-sm text-moss">
          You are offline. This is the view saved on this device on {new Date(offlineSavedAt).toLocaleString()}. You can
          still log a day; it will upload when you are back online.
        </p>
      )}
      <SharedWithLine />
      {checkinOffer && (
        <section aria-labelledby="gentle-checkin" className="mb-6 rounded-lg border border-bloom/40 bg-bloom/5 p-5">
          <h2 id="gentle-checkin" className="font-display text-xl font-bold">
            A gentle check-in
          </h2>
          <p className="mt-1">{OFFER_TEXT}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/reflect?offer=${checkinOffer}`}
              className="inline-flex min-h-11 items-center rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft"
            >
              Take a moment to reflect
            </Link>
            <button type="button" onClick={() => setCheckinOffer(null)} className="min-h-11 rounded-md px-4 font-semibold hover:bg-white">
              Not now
            </button>
          </div>
        </section>
      )}
      <RhythmBanner rhythm={rhythm} />
      {user && <TodayWeather userId={user.id} todayIso={todayIso} />}
      {/* TEMPORARY (hackathon): AI reflection on today. Remove with src/features/aiReflection. */}
      <AiReflectionCard date={todayIso} today={today ?? null} auto={autoReflection} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={PILLARS.nutrition.name} subtitle={PILLARS.nutrition.subtitle} accent={COLORS.nutrition}>
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

        <Card title={PILLARS.sleep.name} subtitle={PILLARS.sleep.subtitle} accent={COLORS.sleep}>
          {goalsIn('sleep').map((cfg) => (
            <GoalMetric key={cfg.value} cfg={cfg} row={today} goal={goalOf(cfg)} color={COLORS.sleep} />
          ))}
          <Value label="Time in bed" value={num(today, 'time_in_bed_hours')} unit="h" decimals={1} />
          <Value label="Awake in bed" value={num(today, 'awake_minutes')} unit="min" />
        </Card>

        <Card title={PILLARS.exercise.name} subtitle={PILLARS.exercise.subtitle} accent={COLORS.exercise}>
          {goalsIn('exercise').map((cfg) => (
            <GoalMetric key={cfg.value} cfg={cfg} row={today} goal={goalOf(cfg)} color={COLORS.exercise} />
          ))}
        </Card>

        <Card title={PILLARS.wellbeing.name} subtitle={PILLARS.wellbeing.subtitle} accent={COLORS.wellbeing}>
          {mood === null ? (
            <p className="text-sm text-moss">Mood: day off today.</p>
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
                {v === null ? <span className="text-moss">Day off</span> : <span className="font-semibold">{scale.levels[v - 1]}</span>}
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
        <TrendChart
          title={PILLARS.nutrition.name}
          color={COLORS.nutrition}
          metrics={[
            ...goalsIn('nutrition').map(trend),
            { key: 'net', label: 'Net calories', unit: 'kcal', points: netPoints, goal: null, decimals: 0 },
          ]}
        />
        <TrendChart
          title={PILLARS.sleep.name}
          color={COLORS.sleep}
          metrics={[...goalsIn('sleep').map(trend), plain('time_in_bed_hours', 'Time in bed', 'h', 1), plain('awake_minutes', 'Awake in bed', 'min')]}
        />
        <TrendChart title={PILLARS.exercise.name} color={COLORS.exercise} metrics={goalsIn('exercise').map(trend)} />
        <TrendChart
          title={PILLARS.wellbeing.name}
          color={COLORS.wellbeing}
          metrics={RATING_SCALES.map((s) => plain(s.key, s.label, '', 0, [1, 5]))}
        />
      </div>
    </>
  );
}
