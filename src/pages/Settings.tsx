import { useEffect, useState, type FormEvent } from 'react';
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

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name, home_city')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? '');
        setHomeCity(data?.home_city ?? null);
      });
  }, [user]);

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
