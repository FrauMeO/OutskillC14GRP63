import { useId, useState } from 'react';
import {
  IMPORT_DAYS,
  buildPlan,
  isHealthImportEnabled,
  readLastDays,
  savePlan,
} from '../lib/native/healthImport';
import { platform } from '../lib/native/platform';
import type { ImportPlan, UpsertRow } from '../lib/native/healthImportLogic';

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'preview'; plan: ImportPlan }
  | { kind: 'saving'; plan: ImportPlan }
  | { kind: 'done'; plan: ImportPlan }
  | { kind: 'problem'; text: string };

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function cell(v: number | null | undefined, unit: string): string {
  return v === null || v === undefined ? '' : `${v}${unit}`;
}

/**
 * "Import from Health": pre-fills steps, sleep, exercise minutes and water for the last 14 days
 * from Apple Health (iPhone) or Health Connect (Android). Shows nothing on the website, and
 * nothing at all unless the app was built with VITE_HEALTH_IMPORT=on.
 *
 * Mount on the Log Habits page (above the day form) or in Settings > Your data.
 * Nothing is saved until the person has seen the list and taps "Add".
 */
export default function HealthImport() {
  const headingId = useId();
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  if (!isHealthImportEnabled()) return null;

  const sourceName = platform() === 'ios' ? 'Apple Health' : 'Health Connect';

  async function start() {
    setStage({ kind: 'reading' });
    const read = await readLastDays();
    if (read.status !== 'ok') {
      setStage({ kind: 'problem', text: read.message });
      return;
    }
    const planned = await buildPlan(read.days);
    if (!planned.ok) {
      setStage({ kind: 'problem', text: planned.error });
      return;
    }
    setStage({ kind: 'preview', plan: planned.plan });
  }

  async function confirm(plan: ImportPlan) {
    setStage({ kind: 'saving', plan });
    const saved = await savePlan(plan);
    setStage(saved.ok ? { kind: 'done', plan } : { kind: 'problem', text: saved.error });
  }

  const busy = stage.kind === 'reading' || stage.kind === 'saving';

  return (
    <section aria-labelledby={headingId} className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id={headingId} className="font-display text-xl font-bold">
        Import from Health
      </h2>
      <p className="mt-2 text-sm text-spruce-soft">
        Fill in steps, sleep, exercise minutes and water for the last {IMPORT_DAYS} days from {sourceName}, so you
        do not have to type them. Your phone will ask for permission first. We only read, we never change{' '}
        {sourceName}, and nothing is saved until you have looked at the list.
      </p>

      {(stage.kind === 'idle' || stage.kind === 'done' || stage.kind === 'problem') && (
        <button
          type="button"
          onClick={() => void start()}
          className="mt-4 rounded-md bg-spruce px-4 py-2 font-semibold text-mist hover:bg-spruce-soft"
        >
          {stage.kind === 'idle' ? 'Import from Health' : 'Import again'}
        </button>
      )}

      {busy && (
        <p role="status" className="mt-4 text-sm">
          {stage.kind === 'reading' ? 'Reading your health data…' : 'Saving…'}
        </p>
      )}

      {(stage.kind === 'preview' || stage.kind === 'saving') && (
        <div className="mt-4">
          {stage.plan.dayCount === 0 ? (
            <>
              <p role="status" className="text-sm">
                Nothing new to add. Either {sourceName} has no data for these days, or you have already logged them.
              </p>
              <button
                type="button"
                onClick={() => setStage({ kind: 'idle' })}
                className="mt-3 rounded-md border border-line bg-white px-4 py-2 font-semibold"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">
                Add {stage.plan.dayCount} {stage.plan.dayCount === 1 ? 'day' : 'days'}? You can edit or delete them
                any time.
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Days that will be added</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="py-1 pr-3">Day</th>
                      <th scope="col" className="py-1 pr-3">Steps</th>
                      <th scope="col" className="py-1 pr-3">Sleep</th>
                      <th scope="col" className="py-1 pr-3">Exercise</th>
                      <th scope="col" className="py-1">Water</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stage.plan.rows.map((r: UpsertRow) => (
                      <tr key={r.log_date} className="border-b border-line/60">
                        <th scope="row" className="py-1 pr-3 font-normal">{dayLabel(r.log_date)}</th>
                        <td className="py-1 pr-3">{cell(r.steps, '')}</td>
                        <td className="py-1 pr-3">{cell(r.sleep_hours, ' h')}</td>
                        <td className="py-1 pr-3">{cell(r.exercise_minutes, ' min')}</td>
                        <td className="py-1">{cell(r.water_liters, ' L')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stage.plan.keptYours > 0 && (
                <p className="mt-2 text-sm text-spruce-soft">
                  Numbers you already logged yourself are left exactly as they are.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirm(stage.plan)}
                  className="rounded-md bg-spruce px-4 py-2 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
                >
                  Add {stage.plan.dayCount} {stage.plan.dayCount === 1 ? 'day' : 'days'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStage({ kind: 'idle' })}
                  className="rounded-md border border-line bg-white px-4 py-2 font-semibold"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {stage.kind === 'done' && (
        <p role="status" className="mt-4 text-sm">
          Added {stage.plan.dayCount} {stage.plan.dayCount === 1 ? 'day' : 'days'} from {sourceName}. You can edit
          or delete any of them on the Log page.
        </p>
      )}

      {stage.kind === 'problem' && (
        <p role="alert" className="mt-4 text-sm text-alert">
          {stage.text}
        </p>
      )}
    </section>
  );
}
