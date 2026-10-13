import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';
import FullPageStatus from '../components/FullPageStatus';

const inputClass =
  'mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce placeholder:text-moss focus:border-current focus:outline-none';

// Step 2: the emailed link signs the person in for a moment, and here they choose a new password.
// Also used from Settings to change a password while signed in.
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <FullPageStatus message="Opening your reset link…" />;

  if (!session) {
    return (
      <AuthShell title="This link has expired">
        <p className="mt-6 text-moss">
          Reset links work once and for a limited time. Request a new one, and use the newest email.
        </p>
        <p className="mt-6 text-sm">
          <Link to="/forgot-password" className="font-semibold text-spruce underline underline-offset-4">
            Send a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('Use at least 6 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) return setError(err.message);
    navigate('/dashboard', { replace: true, state: { passwordChanged: true } });
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <p className="text-moss">For {session.user.email}.</p>
        <label className="block text-sm font-medium">
          New password
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="mt-1.5 block text-xs text-moss">At least 6 characters.</span>
        </label>
        <label className="block text-sm font-medium">
          New password again
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-alert/10 px-3 py-2 text-sm text-alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-spruce px-4 py-2.5 font-semibold text-mist transition-colors hover:bg-spruce-soft disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  );
}
