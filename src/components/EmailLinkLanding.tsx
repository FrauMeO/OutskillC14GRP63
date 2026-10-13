import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { redeemEmailLink, type LinkAction } from '../lib/email/prefs';

// The page behind the links in our emails: /email?a=confirm|mute|unsub&t=<token>. Works signed out.
// Public route, no layout needed. The token is read from the address bar, used once and never shown.
const COPY: Record<LinkAction, { ok: string; no: string }> = {
  confirm: {
    ok: 'Thank you. You are on the list, and we will email you once when the apps are ready.',
    no: 'This link has already been used or has run out. You can sign up again on the home page.',
  },
  mute: {
    ok: 'Done. Gentle notes are turned off for that person, and they have not been told.',
    no: 'This link does not work any more. You can change notes any time under Settings.',
  },
  unsub: {
    ok: 'Done. The weekly email is turned off.',
    no: 'This link does not work any more. You can change it any time under Following.',
  },
};

export default function EmailLinkLanding() {
  const [params] = useSearchParams();
  const action = params.get('a');
  const token = params.get('t') ?? '';
  const valid = (action === 'confirm' || action === 'mute' || action === 'unsub') && /^[A-Za-z0-9_-]{16,128}$/.test(token);
  const [state, setState] = useState<'working' | 'ok' | 'no' | 'error'>(valid ? 'working' : 'no');

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    redeemEmailLink(action as LinkAction, token)
      .then((ok) => !cancelled && setState(ok ? 'ok' : 'no'))
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [valid, action, token]);

  const text =
    state === 'working'
      ? 'One moment...'
      : state === 'error'
        ? 'Something went wrong. Please try the link again in a little while.'
        : COPY[(action as LinkAction) ?? 'confirm'][state === 'ok' ? 'ok' : 'no'];

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <meta name="referrer" content="no-referrer" />
      <h1 className="font-display text-3xl font-bold">Build Your Pillars</h1>
      <p role="status" className="mt-4 text-lg">
        {text}
      </p>
      <p className="mt-6 text-lg">
        <a href="/" className="font-semibold text-current underline">
          Go to the home page
        </a>
      </p>
    </main>
  );
}
