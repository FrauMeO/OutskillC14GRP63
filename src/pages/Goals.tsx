import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/database.types';
import { GOAL_TYPES, formatTarget, goalConfig, validateTarget, type GoalType } from '../lib/goals';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';

type Pending = { existing: Goal; newValue: number };
type Flash = { kind: 'ok' | 'error'; text: string } | null;

const input =
  'block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce focus:border-current focus:outline-none';
const primaryBtn =
  'rounded-md bg-spruce px-4 py-2.5 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';
const quietBtn = 'rounded-md px-3 py-1.5 text-sm font-semibold text-spruce hover:bg-mist';

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [type, setType] = useState<GoalType>('exercise');
  const [value, setValue] = useState(String(GOAL_TYPES[0].suggested));
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  // per-card state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const cfg = goalConfig(type)!;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('goals').select('*').order('created_at');
    if (error) setFlash({ kind: 'error', text: `Could not load goals: ${error.message}` });
    const list = data ?? [];
    setGoals(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function changeType(next: GoalType) {
    setType(next);
    setValue(String(goalConfig(next)!.suggested));
    setFormError(null);
    setPending(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFlash(null);
    const problem = validateTarget(cfg, value);
    if (problem) return setFormError(problem);
    setFormError(null);
    const target = Number(value);

    const existing = goals.find((g) => g.goal_type === type);
    if (existing) return setPending({ existing, newValue: target });

    setBusy(true);
    const { error } = await supabase
      .from('goals')
      .insert({ goal_type: type, target_value: target, unit: cfg.unit });
    setBusy(false);

    if (error?.code === '23505') {
      // Another tab or device created this type first; offer to replace it.
      const fresh = await load();
      const clash = fresh.find((g) => g.goal_type === type);
      if (clash) return setPending({ existing: clash, newValue: target });
    }
    if (error) return setFlash({ kind: 'error', text: `Could not save goal: ${error.message}` });

    setFlash({ kind: 'ok', text: `${cfg.label} goal saved.` });
    await load();
  }

  async function confirmReplace() {
    if (!pending) return;
    const pcfg = goalConfig(pending.existing.goal_type)!;
    setBusy(true);
    const { error } = await supabase
      .from('goals')
      .update({ target_value: pending.newValue, unit: pcfg.unit, created_at: new Date().toISOString() })
      .eq('id', pending.existing.id);
    setBusy(false);
    if (error) return setFlash({ kind: 'error', text: `Could not replace goal: ${error.message}` });
    setPending(null);
    setFlash({ kind: 'ok', text: `${pcfg.label} goal replaced.` });
    await load();
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditValue(String(goal.target_value));
    setEditError(null);
    setDeletingId(null);
  }

  async function saveEdit(goal: Goal) {
    const gcfg = goalConfig(goal.goal_type)!;
    const problem = validateTarget(gcfg, editValue);
    if (problem) return setEditError(problem);
    setBusy(true);
    const { error } = await supabase
      .from('goals')
      .update({ target_value: Number(editValue) })
      .eq('id', goal.id);
    setBusy(false);
    if (error) return setEditError(error.message);
    setEditingId(null);
    setFlash({ kind: 'ok', text: `${gcfg.label} goal updated.` });
    await load();
  }

  async function confirmDelete(goal: Goal) {
    const gcfg = goalConfig(goal.goal_type);
    setBusy(true);
    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    setBusy(false);
    setDeletingId(null);
    if (error) return setFlash({ kind: 'error', text: `Could not delete goal: ${error.message}` });
    setFlash({ kind: 'ok', text: `${gcfg?.label ?? 'Goal'} goal deleted.` });
    await load();
  }

  // Show cards in a fixed order: Exercise, Sleep, Water.
  const ordered = GOAL_TYPES.map((t) => goals.find((g) => g.goal_type === t.value)).filter(
    (g): g is Goal => Boolean(g),
  );

  return (
    <>
      <PageHeader title="Goals">
        Set one daily target for each habit. Your dashboard measures each day against these.
      </PageHeader>

      {flash && (
        <Notice kind={flash.kind} className="mb-6 rounded-md border border-current/40 px-4 py-3 text-sm">
          {flash.text}
        </Notice>
      )}

      {/* ---------- Create ---------- */}
      <section aria-labelledby="new-goal" className="rounded-lg border border-line bg-white p-5 md:p-7">
        <h2 id="new-goal" className="font-display text-xl font-bold">
          Set a goal
        </h2>

        <form onSubmit={handleCreate} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block text-sm font-medium">
            Habit
            <select
              className={`${input} mt-1.5`}
              value={type}
              onChange={(e) => changeType(e.target.value as GoalType)}
            >
              {GOAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Target
            <div className="mt-1.5 flex items-center gap-2">
              <input
                className={input}
                type="number"
                inputMode="decimal"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-describedby="target-unit"
                aria-invalid={Boolean(formError)}
              />
              <span id="target-unit" className="whitespace-nowrap text-sm text-moss">
                {cfg.unit}
              </span>
            </div>
          </label>

          <button type="submit" disabled={busy || Boolean(pending)} className={primaryBtn}>
            Save goal
          </button>
        </form>

        {formError && (
          <Notice kind="error" className="mt-3 text-sm">
            {formError}
          </Notice>
        )}

        {pending && (
          <div role="alertdialog" aria-labelledby="replace-q" className="mt-5 rounded-md border border-ember/40 bg-ember/10 p-4">
            <p id="replace-q" className="text-spruce">
              You already have a {goalConfig(pending.existing.goal_type)!.label.toLowerCase()} goal of{' '}
              <strong>{formatTarget(pending.existing.target_value, pending.existing.unit)}</strong>. Replace it
              with <strong>{formatTarget(pending.newValue, goalConfig(pending.existing.goal_type)!.unit)}</strong>?
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={confirmReplace} disabled={busy} className={primaryBtn}>
                Replace goal
              </button>
              <button type="button" onClick={() => setPending(null)} className={quietBtn}>
                Keep current goal
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Active goals ---------- */}
      <section aria-labelledby="active-goals" className="mt-10">
        <h2 id="active-goals" className="font-display text-xl font-bold">
          Active goals
        </h2>

        {loading ? (
          <p className="mt-4 text-moss" role="status">
            Loading your goals…
          </p>
        ) : ordered.length === 0 ? (
          <p className="mt-4 text-moss">
            No goals yet. Until you set one, the dashboard uses 30 minutes of exercise, 8 hours of sleep,
            and 2 liters of water.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((goal) => {
              const gcfg = goalConfig(goal.goal_type)!;
              const editing = editingId === goal.id;
              const deleting = deletingId === goal.id;
              return (
                <li key={goal.id} className="relative overflow-hidden rounded-lg border border-line bg-white p-5 pl-6">
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${gcfg.accent}`} aria-hidden />
                  <h3 className="font-semibold">{gcfg.label}</h3>

                  {editing ? (
                    <div className="mt-3">
                      <label className="block text-sm font-medium">
                        New target ({gcfg.unit})
                        <input
                          className={`${input} mt-1.5`}
                          type="number"
                          inputMode="decimal"
                          min={gcfg.min}
                          max={gcfg.max}
                          step={gcfg.step}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          autoFocus
                        />
                      </label>
                      {editError && (
                        <Notice kind="error" className="mt-2 text-sm">
                          {editError}
                        </Notice>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => saveEdit(goal)} disabled={busy} className={primaryBtn}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={quietBtn}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2">
                        <span className="font-display text-4xl font-bold tracking-tight">
                          {Number(goal.target_value)}
                        </span>{' '}
                        <span className="text-moss">{goal.unit}</span>
                      </p>
                      <p className="mt-1 text-sm text-moss">
                        Set {new Date(goal.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>

                      {deleting ? (
                        <div className="mt-4" role="alertdialog" aria-label={`Delete ${gcfg.label} goal`}>
                          <p className="text-sm">Delete this goal? The dashboard will fall back to the default target.</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => confirmDelete(goal)}
                              disabled={busy}
                              className="rounded-md bg-alert px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Delete goal
                            </button>
                            <button type="button" onClick={() => setDeletingId(null)} className={quietBtn}>
                              Keep goal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex gap-1">
                          <button type="button" onClick={() => startEdit(goal)} className={quietBtn}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingId(goal.id);
                              setEditingId(null);
                            }}
                            className={`${quietBtn} text-alert`}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
