import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { lastNDays, toISODate } from '../lib/dates';
import type { Goal, HabitLog } from '../lib/database.types';
import PageHeader from '../components/PageHeader';

type Metric = 'exercise' | 'sleep' | 'water';

const METRICS: { key: Metric; label: string; field: keyof HabitLog; fallback: number; unit: string; color: string }[] = [
  { key: 'exercise', label: 'Exercise', field: 'exercise_minutes', fallback: 30, unit: 'min', color: 'bg-ember' },
  { key: 'sleep', label: 'Sleep', field: 'sleep_hours', fallback: 8, unit: 'h', color: 'bg-dusk' },
  { key: 'water', label: 'Water', field: 'water_liters', fallback: 2, unit: 'L', color: 'bg-current' },
];

function targetFor(metric: Metric, goals: Goal[]) {
  const match = goals.find((g) => g.goal_type.toLowerCase() === metric);
  return match ? Number(match.target_value) : METRICS.find((m) => m.key === metric)!.fallback;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const days = lastNDays(7);
  const since = toISODate(days[0]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // RLS limits every query to the signed-in user's rows; no user_id filter is needed.
      const [profileRes, logsRes, goalsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        supabase.from('habit_logs').select('*').gte('log_date', since).order('log_date'),
        supabase.from('goals').select('*').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;

      const firstError = profileRes.error ?? logsRes.error ?? goalsRes.error;
      if (firstError) setError(firstError.message);
      setName(profileRes.data?.full_name ?? null);
      setLogs(logsRes.data ?? []);
      setGoals(goalsRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, since]);

  const byDate = new Map(logs.map((l) => [l.log_date, l]));
  const firstName = name?.split(' ')[0];

  return (
    <>
      <PageHeader title={firstName ? `Hello, ${firstName}` : 'Your week'}>
        The last seven days of sleep, water, and exercise, measured against your targets.
      </PageHeader>

      {error && (
        <p role="alert" className="mb-6 rounded-md bg-alert/10 px-4 py-3 text-sm text-alert">
          Could not load your data: {error}
        </p>
      )}

      <section aria-labelledby="week-heading" className="rounded-lg border border-line bg-white p-5 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="week-heading" className="font-display text-xl font-bold">
            This week
          </h2>
          <ul className="flex gap-4 text-sm text-spruce/75">
            {METRICS.map((m) => (
              <li key={m.key} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${m.color}`} aria-hidden />
                {m.label} ({targetFor(m.key, goals)} {m.unit})
              </li>
            ))}
          </ul>
        </div>

        {loading ? (
          <p className="mt-8 text-sage" role="status">
            Loading your week…
          </p>
        ) : (
          <ol className="mt-8 grid grid-cols-7 gap-2 md:gap-4">
            {days.map((d) => {
              const iso = toISODate(d);
              const log = byDate.get(iso);
              const isToday = iso === toISODate(new Date());
              return (
                <li key={iso} className="flex flex-col items-center">
                  <div className="flex h-36 items-end gap-1 md:gap-1.5" aria-hidden>
                    {METRICS.map((m) => {
                      const value = Number(log?.[m.field] ?? 0);
                      const pct = Math.min(value / targetFor(m.key, goals), 1) * 100;
                      return (
                        <div key={m.key} className="relative h-full w-2.5 overflow-hidden rounded-full bg-mist md:w-3.5">
                          <div className={`absolute inset-x-0 bottom-0 rounded-full ${m.color}`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <span className={`mt-3 text-sm ${isToday ? 'font-semibold' : 'text-spruce/70'}`}>
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span className="sr-only">
                    {log
                      ? METRICS.map((m) => `${m.label} ${log[m.field] ?? 0} ${m.unit}`).join(', ')
                      : 'No log'}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {!loading && logs.length === 0 && (
          <p className="mt-8 border-t border-line pt-6 text-spruce/80">
            No logs this week yet.{' '}
            <Link to="/habits" className="font-semibold text-spruce underline underline-offset-4">
              Log today's habits
            </Link>{' '}
            to start filling in the columns.
          </p>
        )}
      </section>
    </>
  );
}
