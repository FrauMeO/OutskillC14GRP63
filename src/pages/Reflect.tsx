import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { toISODate } from '../lib/dates';
import { encouragementFor } from '../lib/encouragement';
import {
  ANSWERS,
  FOOTER,
  MESSAGES,
  PHQ2_FOLLOW_UP,
  PHQ9_ITEMS,
  QUESTION_INTRO,
  phq2Score,
  phq9Score,
  resourcesFor,
  tierFor,
  type Answer,
  type Resource,
} from '../lib/reflection';

type Step = 'intro' | 'short' | 'short-done' | 'full' | 'done';

const primaryBtn = 'min-h-11 rounded-md bg-spruce px-5 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';
const quietBtn = 'min-h-11 rounded-md px-4 font-semibold text-spruce hover:bg-white';

function Resources({ items }: { items: Resource[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((r) => (
        <li key={r.key} className="rounded-md border border-line bg-white p-3">
          <p className="font-semibold">
            {r.href ? (
              <a href={r.href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {r.name}
              </a>
            ) : r.tel ? (
              <a href={`tel:${r.tel}`} className="underline underline-offset-4">
                {r.name}
              </a>
            ) : (
              r.name
            )}
          </p>
          <p className="text-sm text-moss">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function CrisisPanel({ items }: { items: Resource[] }) {
  return (
    <section role="alert" className="rounded-lg border-2 border-alert/50 bg-alert/5 p-5">
      <p className="font-semibold">{MESSAGES.item9}</p>
      <Resources items={items} />
    </section>
  );
}

function Question({
  index,
  value,
  onChange,
}: {
  index: number;
  value: Answer | null;
  onChange: (a: Answer) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-line bg-white p-4">
      <legend className="px-1 font-medium">
        {index + 1}. {PHQ9_ITEMS[index]}
      </legend>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
        {ANSWERS.map((label, a) => (
          <label
            key={label}
            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-current ${
              value === a ? 'border-spruce bg-spruce text-mist' : 'border-line hover:bg-mist'
            }`}
          >
            <input type="radio" className="sr-only" name={`q${index}`} checked={value === a} onChange={() => onChange(a as Answer)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function Reflect() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const todayIso = toISODate(new Date());
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<(Answer | null)[]>(Array(9).fill(null));
  const [country, setCountry] = useState<string | null>(null);
  const [rowId, setRowId] = useState<string | null>(params.get('offer'));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('home_country_code')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setCountry(data?.home_country_code ?? null));
  }, [user]);

  const set = (i: number, a: Answer) => setAnswers((prev) => prev.map((x, j) => (j === i ? a : x)));
  const short = phq2Score(answers);
  const full = phq9Score(answers);
  const item9 = answers[8];

  // Saves scores to this visit's row; creates the row first if the visit did not come from an offer.
  async function save(fields: { phq2_score?: number; phq9_score?: number; phq9_item9?: number }) {
    setSaving(true);
    setError(null);
    let id = rowId;
    if (!id) {
      const { data, error: err } = await supabase.from('reflections').insert({ offered_on: todayIso }).select('id').single();
      if (err) {
        setSaving(false);
        setError(`Your answers could not be saved: ${err.message}. You can still read your results below.`);
        return;
      }
      id = data.id;
      setRowId(id);
    }
    const { error: err } = await supabase.from('reflections').update({ ...fields, taken_on: todayIso }).eq('id', id);
    if (err) setError(`Your answers could not be saved: ${err.message}. You can still read your results below.`);
    setSaving(false);
  }

  async function finishShort() {
    if (short === null) return;
    await save({ phq2_score: short });
    setStep('short-done');
  }

  async function finishFull() {
    if (full === null || item9 === null) return;
    await save({ phq9_score: full, phq9_item9: item9 });
    setStep('done');
  }

  const header = (
    <PageHeader title="A moment to reflect">
      A few questions about the last two weeks. It's optional, only you can see your answers, and you can stop at any time.
    </PageHeader>
  );
  const footer = <p className="mt-8 border-t border-line pt-4 text-sm text-moss">{FOOTER}</p>;
  const errorNote = error && (
    <p role="alert" className="mb-4 rounded-md bg-alert/10 px-4 py-3 text-sm text-alert">
      {error}
    </p>
  );

  if (step === 'intro') {
    return (
      <div className="max-w-2xl">
        {header}
        <p className="text-moss">
          There are no right or wrong answers. Answer the way things have actually been, not the way you think they should be.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={primaryBtn} onClick={() => setStep('short')}>
            Begin
          </button>
          <Link to="/dashboard" className={`${quietBtn} inline-flex items-center`}>
            Not now
          </Link>
        </div>
        {footer}
      </div>
    );
  }

  if (step === 'short') {
    return (
      <div className="max-w-2xl">
        {header}
        <p className="mb-3 font-medium">{QUESTION_INTRO}</p>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Question key={i} index={i} value={answers[i]} onChange={(a) => set(i, a)} />
          ))}
        </div>
        <button type="button" className={`${primaryBtn} mt-5`} disabled={short === null || saving} onClick={finishShort}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
        {footer}
      </div>
    );
  }

  if (step === 'short-done') {
    const goDeeper = short !== null && short >= PHQ2_FOLLOW_UP;
    return (
      <div className="max-w-2xl">
        {header}
        {errorNote}
        {goDeeper ? (
          <section className="rounded-lg border border-line bg-white p-5">
            <p>
              Thank you. Would you like to reflect a little further? There are seven more questions, and your first two answers are
              kept. It takes about two minutes.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={primaryBtn} onClick={() => setStep('full')}>
                Keep reflecting
              </button>
              <Link to="/dashboard" className={`${quietBtn} inline-flex items-center`}>
                Stop here
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-line bg-white p-5">
            <p>{MESSAGES.short}</p>
            <p className="mt-3 italic text-moss">{encouragementFor(todayIso)}</p>
          </section>
        )}
        {footer}
      </div>
    );
  }

  if (step === 'full') {
    const crisis = item9 !== null && item9 > 0 ? resourcesFor(country, 'calm', item9).crisis : [];
    return (
      <div className="max-w-2xl">
        {header}
        <p className="mb-3 font-medium">{QUESTION_INTRO}</p>
        <div className="space-y-3">
          {PHQ9_ITEMS.map((_, i) => (
            <Question key={i} index={i} value={answers[i]} onChange={(a) => set(i, a)} />
          ))}
        </div>
        {/* Shown as soon as item 9 is answered above 0, before any total. */}
        {crisis.length > 0 && (
          <div className="mt-4">
            <CrisisPanel items={crisis} />
          </div>
        )}
        <button type="button" className={`${primaryBtn} mt-5`} disabled={full === null || saving} onClick={finishFull}>
          {saving ? 'Saving…' : 'See my reflection'}
        </button>
        {footer}
      </div>
    );
  }

  // step === 'done'
  const tier = tierFor(full ?? 0);
  const res = resourcesFor(country, tier, item9);
  return (
    <div className="max-w-2xl space-y-5">
      {header}
      {errorNote}
      {res.crisis.length > 0 && <CrisisPanel items={res.crisis} />}
      <section className="rounded-lg border border-line bg-white p-5">
        <p>{MESSAGES[tier]}</p>
        {res.tier.length > 0 && <Resources items={res.tier} />}
        <p className="mt-4 italic text-moss">{encouragementFor(todayIso)}</p>
      </section>
      <Link to="/dashboard" className={`${quietBtn} inline-flex items-center`}>
        Back to your dashboard
      </Link>
      {footer}
    </div>
  );
}
