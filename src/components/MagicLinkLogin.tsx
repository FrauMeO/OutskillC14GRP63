import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import {
  MAGIC_LINK_BAD_ADDRESS_MESSAGE,
  interpretOtpError,
  looksLikeEmail,
  messageFor,
} from '../lib/email/magicLink';

// "Email me a sign-in link" for people who forget passwords. Signs in only people who already have an
// account (shouldCreateUser: false) and shows the same message whether or not the address has one.
export default function MagicLinkLogin({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setMessage(MAGIC_LINK_BAD_ADDRESS_MESSAGE);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    setMessage(messageFor(interpretOtpError(error)));
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 min-h-11 text-lg font-semibold text-current underline">
        Email me a sign-in link instead
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" aria-label="Sign in with an emailed link">
      <label className="block text-lg">
        Your email address
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-lg"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-full bg-spruce px-6 text-lg font-semibold text-mist disabled:opacity-60"
      >
        {busy ? 'Sending...' : 'Email me a link'}
      </button>
      {message && (
        <p role="status" className="text-lg">
          {message}
        </p>
      )}
    </form>
  );
}
