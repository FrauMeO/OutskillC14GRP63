import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthShell from '../components/AuthShell';
import Notice from '../components/Notice';

const inputClass =
  'mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce placeholder:text-moss focus:border-current focus:outline-none';

// Step 1 of resetting a password: send a link to the email. The same message shows whether or
// not an account exists, so the page never reveals who has signed up.
export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (err) {
      setError(
        /rate limit/i.test(err.message)
          ? 'Too many emails have been sent in the last hour. Please try again a little later.'
          : err.message,
      );
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell title="Reset your password">
      {sent ? (
        <div className="mt-8 space-y-4">
          <Notice kind="success" className="rounded-md bg-current/10 px-3 py-3 text-sm">
            If there is an account for {email.trim()}, a link to choose a new password is on its way. It can take a
            minute or two; check your spam folder too.
          </Notice>
          <p className="text-sm text-moss">
            <Link to="/login" className="font-semibold text-spruce underline underline-offset-4">
              Back to log in
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <p className="text-moss">Enter the email you signed up with, and we will send you a link to choose a new password.</p>
          <label className="block text-sm font-medium">
            Email
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && (
            <Notice kind="error" className="rounded-md bg-alert/10 px-3 py-2 text-sm">
              {error}
            </Notice>
          )}
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-md bg-spruce px-4 py-2.5 font-semibold text-mist transition-colors hover:bg-spruce-soft disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-sm text-moss">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-spruce underline underline-offset-4">
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
