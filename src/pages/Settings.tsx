import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import CityPicker from '../components/CityPicker';
import type { HomeCity } from '../lib/location';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeStatus, setHomeStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [checkinOn, setCheckinOn] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reflectStatus, setReflectStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name, home_city, gentle_checkin_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? '');
        setHomeCity(data?.home_city ?? null);
        setCheckinOn(data?.gentle_checkin_enabled ?? true);
      });
  }, [user]);

  async function toggleCheckin(next: boolean) {
    if (!user) return;
    setReflectStatus(null);
    setCheckinOn(next);
    const { error } = await supabase.from('profiles').update({ gentle_checkin_enabled: next }).eq('id', user.id);
    if (error) {
      setCheckinOn(!next);
      setReflectStatus({ kind: 'error', text: error.message });
    } else {
      setReflectStatus({ kind: 'ok', text: next ? 'Gentle check-ins are on.' : 'Gentle check-ins are off.' });
    }
  }

  async function deleteReflections() {
    setReflectStatus(null);
    // RLS limits this to the signed-in user's own rows.
    const { error } = await supabase.from('reflections').delete().not('id', 'is', null);
    setConfirmDelete(false);
    setReflectStatus(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Your reflection history was deleted.' });
  }

  async function saveHome(city: HomeCity) {
    if (!user) return;
    setHomeStatus(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        home_city: city.city,
        home_country_code: city.countryCode,
        home_latitude: city.latitude,
        home_longitude: city.longitude,
      })
      .eq('id', user.id);
    if (error) return setHomeStatus({ kind: 'error', text: error.message });
    setHomeCity(city.city);
    setHomeStatus({ kind: 'ok', text: `Home city set to ${city.city}.` });
  }

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

      <section aria-labelledby="home-city" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="home-city" className="font-display text-xl font-bold">
          Home city
        </h2>
        <p className="mt-1 text-sm text-spruce/70">
          {homeCity ? `Currently ${homeCity}.` : 'Not set.'} Used for the weather on days you do not share your device
          location. Only the city and a location rounded to about 11 km are stored.
        </p>
        <div className="mt-4">
          <CityPicker label={homeCity ? 'Change home city' : 'Home city'} onPick={saveHome} />
        </div>
        {homeStatus && (
          <p
            role={homeStatus.kind === 'error' ? 'alert' : 'status'}
            className={`mt-3 text-sm ${homeStatus.kind === 'error' ? 'text-alert' : 'text-current'}`}
          >
            {homeStatus.text}
          </p>
        )}
      </section>

      <section aria-labelledby="reflection" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="reflection" className="font-display text-xl font-bold">
          Gentle check-ins
        </h2>
        <p className="mt-1 text-sm text-spruce/70">
          After more than 10 days in a row of check-ins, if many of them felt harder, the app may offer a short, optional
          moment to reflect on the last two weeks. At most once every 14 days. Only you can see your answers.
        </p>
        <label className="mt-4 flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={checkinOn} onChange={(e) => toggleCheckin(e.target.checked)} />
          <span className="font-medium">Offer gentle check-ins</span>
        </label>
        <p className="mt-2 text-sm">
          <Link to="/reflect" className="font-semibold underline underline-offset-4">
            Reflect now
          </Link>{' '}
          whenever you like, whether or not it is offered.
        </p>
        {confirmDelete ? (
          <div role="alertdialog" aria-label="Delete reflection history" className="mt-4 rounded-md border border-alert/40 bg-alert/5 p-3">
            <p className="text-sm">Delete all your saved reflection answers and dates? This cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={deleteReflections} className="min-h-11 rounded-md bg-alert px-3 text-sm font-semibold text-white">
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 rounded-md px-3 text-sm font-semibold hover:bg-mist">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mt-4 min-h-11 text-sm font-semibold text-alert underline underline-offset-4">
            Delete my reflection history
          </button>
        )}
        {reflectStatus && (
          <p role={reflectStatus.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${reflectStatus.kind === 'error' ? 'text-alert' : 'text-current'}`}>
            {reflectStatus.text}
          </p>
        )}
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
