import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { validateWaitlist, WAITLIST_PRIVACY, WAITLIST_SUCCESS } from '../lib/waitlist';
import Notice from './Notice';

// App Store / Google Play waiting list. Works signed out. Nothing is kept in the browser.
export default function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const id = 'waitlist'; // fixed, not useId(): the page is prerendered, and useId differs between the build and the browser. One form per page.
  const [email, setEmail] = useState('');
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validateWaitlist({ email, ios, android, consent });
    if (!v.ok) return setError(v.message);
    setBusy(true);
    const { error: err } = await supabase.rpc('join_waitlist', { p_email: v.email, p_ios: v.ios, p_android: v.android, p_consent: consent });
    setBusy(false);
    if (err) return setError(err.message);
    setDone(true); // same message whether or not the address was already listed
  }

  if (done) {
    return (
      <p role="status" className="rounded-md border border-line bg-white px-4 py-3 text-lg">
        {WAITLIST_SUCCESS}
      </p>
    );
  }

  const Heading = compact ? 'h3' : 'h2';
  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${id}-h`} className="max-w-xl rounded-lg border border-line bg-white p-5 text-lg">
      <Heading id={`${id}-h`} className="font-display text-2xl font-bold">
        App Store and Google Play waiting list
      </Heading>
      <p className="mt-2">The store apps are not ready yet. Leave your email and we will tell you when they are.</p>

      <label className="mt-4 block font-medium" htmlFor={`${id}-email`}>
        Email
      </label>
      <input
        id={`${id}-email`}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1.5 block min-h-12 w-full rounded-md border border-spruce/40 bg-white px-3 py-2 text-spruce"
      />

      <fieldset className="mt-4">
        <legend className="font-medium">Which store?</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={ios} onChange={(e) => setIos(e.target.checked)} className="size-6 accent-spruce" />
          App Store (iPhone)
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={android} onChange={(e) => setAndroid(e.target.checked)} className="size-6 accent-spruce" />
          Google Play (Android)
        </label>
      </fieldset>

      <label className="mt-3 flex items-start gap-3">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-6 shrink-0 accent-spruce" />
        <span>Yes, you may email me once when the app is ready.</span>
      </label>

      {error && (
        <Notice kind="error" className="mt-3 rounded-md bg-alert/10 px-3 py-2">
          {error}
        </Notice>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 inline-flex min-h-12 items-center justify-center rounded-md bg-spruce px-6 py-3 font-semibold text-mist transition-colors hover:bg-spruce-soft disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Tell me when it is ready'}
      </button>
      <p className="mt-3 text-base text-moss">{WAITLIST_PRIVACY}</p>
    </form>
  );
}
