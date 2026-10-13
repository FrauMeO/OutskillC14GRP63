import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CONSENT_CHANGED, setConsent } from '../lib/consentApi';
import Notice from './Notice';

// Email choices (GDPR opt-in): news about Build Your Pillars is off unless the person turns it on.
export default function EmailPreferences() {
  const { user } = useAuth();
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () =>
      supabase
        .from('profiles')
        .select('marketing_opt_in')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setOptIn(data?.marketing_opt_in ?? false);
        });
    load();
    // The Privacy and consent section can change this too; stay in step with it.
    window.addEventListener(CONSENT_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_CHANGED, load);
    };
  }, [user]);

  // The choice goes through the consent ledger, which also keeps the profile flag in step.
  async function change(next: boolean) {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    const problem = await setConsent('email_marketing', next);
    setBusy(false);
    if (problem) return setMessage({ kind: 'error', text: problem });
    setOptIn(next);
    setMessage({ kind: 'ok', text: next ? 'You will get occasional news by email.' : 'You will not get news by email.' });
  }

  return (
    <section aria-labelledby="email-prefs" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id="email-prefs" className="font-display text-xl font-bold">
        Email
      </h2>
      <p className="mt-2 text-sm text-moss">
        We email you about your account when needed, such as a password reset. News and updates only if you say yes.
      </p>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={optIn === true}
          disabled={optIn === null || busy}
          onChange={(e) => change(e.target.checked)}
          className="size-5 accent-spruce"
        />
        Email me occasional news about Build Your Pillars
      </label>
      {message && (
        <Notice kind={message.kind} className="mt-2 text-sm">
          {message.text}
        </Notice>
      )}
    </section>
  );
}
