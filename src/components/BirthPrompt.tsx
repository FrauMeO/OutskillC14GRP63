import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { MONTHS, birthYearOptions, validateBirth } from '../lib/signup';

// For accounts made before sign-up asked for birth month and year. Month and year ONLY, never a day.
// Mount it where profile_birth_needed() is true (see docs/billing.md, "Mount points").
const field =
  'block min-h-[44px] w-full rounded-md border border-line bg-white px-3 py-2.5 text-lg text-spruce focus:border-current focus:outline-none';

export default function BirthPrompt({ onSaved }: { onSaved?: () => void }) {
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const today = new Date();

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const result = validateBirth(month ? Number(month) : null, year ? Number(year) : null, today);
    if (!result.ok) return setMessage(result.message); // includes refusing anyone under 16
    setBusy(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const id = sessionData.session?.user.id;
    if (!id) {
      setBusy(false);
      return setMessage('Please log in again.');
    }
    const { error } = await (supabase as unknown as SupabaseClient)
      .from('profiles')
      .update({ birth_month: result.month, birth_year: result.year })
      .eq('id', id);
    setBusy(false);
    if (error) return setMessage('We could not save that. Please try again in a moment.');
    setDone(true);
    onSaved?.();
  }

  if (done) {
    return (
      <p role="status" className="rounded-lg border border-line bg-white p-5 text-lg">
        Thank you. That is saved.
      </p>
    );
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-line bg-white p-5" aria-labelledby="birth-title">
      <h2 id="birth-title" className="font-display text-2xl font-bold">
        When were you born?
      </h2>
      <p className="mt-2 max-w-prose text-lg text-spruce/80">
        Please choose your birth month and year. We use them only to work out your plan, and we never ask for the day.
      </p>
      <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
        <label className="block text-lg">
          <span className="mb-1 block font-semibold">Month</span>
          <select className={field} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Choose</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-lg">
          <span className="mb-1 block font-semibold">Year</span>
          <select className={field} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Choose</option>
            {birthYearOptions(today).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message && (
        <p role="alert" className="mt-3 text-lg text-ember">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 min-h-[44px] rounded-md bg-spruce px-5 py-2.5 text-lg font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
      >
        {busy ? 'Saving' : 'Save'}
      </button>
    </form>
  );
}
