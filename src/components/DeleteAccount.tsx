import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { canConfirmDelete, DELETE_WORD } from '../lib/deleteAccount';

// Delete my account: removes the sign-in and everything saved (logs, goals, check-ins, sharing).
export default function DeleteAccount() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!canConfirmDelete(typed)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) {
      setBusy(false);
      setError(`Your account was not deleted: ${err.message}`);
      return;
    }
    await signOut();
  }

  return (
    <section aria-labelledby="delete-account" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id="delete-account" className="font-display text-xl font-bold">
        Delete my account
      </h2>
      <p className="mt-2 text-sm text-spruce/80">
        This permanently deletes your sign-in and everything saved: your logs, goals, check-ins and sharing. It cannot be undone. You can
        download your data first, above.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-11 rounded-md border border-alert px-4 font-semibold text-alert hover:bg-alert/10"
        >
          Delete my account…
        </button>
      ) : (
        <div className="mt-4">
          <label htmlFor="delete-confirm" className="block text-sm font-medium">
            Type <strong>{DELETE_WORD}</strong> to confirm
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 block min-h-11 w-full rounded-md border border-spruce/40 px-3 py-2"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={!canConfirmDelete(typed) || busy}
              className="min-h-11 rounded-md bg-alert px-4 font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete everything'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
                setError(null);
              }}
              disabled={busy}
              className="min-h-11 rounded-md border border-spruce px-4 font-semibold hover:bg-mist"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-alert">
          {error}
        </p>
      )}
    </section>
  );
}
