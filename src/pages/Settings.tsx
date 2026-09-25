import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setFullName(data?.full_name ?? ''));
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: fullName.trim() || null });
    setSaving(false);
    setStatus(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Name saved.' });
  }

  return (
    <>
      <PageHeader title="Settings" />

      <section className="max-w-md rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold">Profile</h2>
        <p className="mt-1 text-sm text-spruce/70">Signed in as {user?.email}</p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Full name
            <input
              className="mt-1.5 block w-full rounded-md border border-line px-3 py-2.5 focus:border-current focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-spruce px-4 py-2 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save name'}
          </button>
          {status && (
            <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'text-sm text-alert' : 'text-sm text-current'}>
              {status.text}
            </p>
          )}
        </form>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="mt-8 rounded-md border border-spruce px-4 py-2 font-semibold hover:bg-spruce hover:text-mist"
      >
        Log out
      </button>
    </>
  );
}
