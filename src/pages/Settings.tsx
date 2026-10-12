import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import CityPicker from '../components/CityPicker';
import type { HomeCity } from '../lib/location';
import { exportFileName, logsToCsv, toJson, type ExportData } from '../lib/export';
import { toISODate } from '../lib/dates';
import { ABOUT_STORY, foundersLine } from '../lib/about';
import { validateDisplayName } from '../lib/signup';
import SharingSettings from '../components/SharingSettings';
import DeleteAccount from '../components/DeleteAccount';
import EmailPreferences from '../components/EmailPreferences';
import AiConsentSetting from '../components/AiConsentSetting';
import ReminderSetting from '../components/ReminderSetting';
import HealthImport from '../components/HealthImport';
import { AI_REFLECTION_ENABLED } from '../features/aiReflection/AiReflectionCard';

export default function Settings() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [homeCity, setHomeCity] = useState<string | null>(null);
  const [homeStatus, setHomeStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [checkinOn, setCheckinOn] = useState(true);
  const [autoOn, setAutoOn] = useState(false);
  const [downloading, setDownloading] = useState<'json' | 'csv' | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [autoStatus, setAutoStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reflectStatus, setReflectStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name, home_city, gentle_checkin_enabled, auto_reflection')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? '');
        setHomeCity(data?.home_city ?? null);
        setCheckinOn(data?.gentle_checkin_enabled ?? true);
        setAutoOn(data?.auto_reflection ?? false);
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

  // Everything the person has logged, fetched as them (RLS), saved as a file on their device.
  async function download(kind: 'json' | 'csv') {
    if (!user) return;
    setDownloading(kind);
    setDownloadStatus(null);
    const [profile, logs, goals, conditions, reflections, shares] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('habit_logs').select('*').order('log_date'),
      supabase.from('goals').select('*'),
      supabase.from('daily_conditions').select('*').order('date'),
      supabase.from('reflections').select('*').order('offered_on'),
      supabase.from('care_shares').select('*').eq('owner_id', user.id).order('created_at'),
    ]);
    const failed = profile.error ?? logs.error ?? goals.error ?? conditions.error ?? reflections.error ?? shares.error;
    if (failed) {
      setDownloading(null);
      setDownloadStatus({ kind: 'error', text: `Could not gather your data: ${failed.message}` });
      return;
    }
    const data: ExportData = {
      profile: profile.data,
      habit_logs: logs.data ?? [],
      goals: goals.data ?? [],
      daily_conditions: conditions.data ?? [],
      reflections: reflections.data ?? [],
      care_shares: shares.data ?? [],
    };
    const text = kind === 'json' ? toJson(data, user.email ?? null, new Date().toISOString()) : logsToCsv(data.habit_logs);
    const url = URL.createObjectURL(new Blob([text], { type: kind === 'json' ? 'application/json' : 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(toISODate(new Date()), kind);
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(null);
    const days = data.habit_logs.length;
    setDownloadStatus({ kind: 'ok', text: `Downloaded ${days} logged ${days === 1 ? 'day' : 'days'}. The file is yours to keep.` });
  }

  async function toggleAuto(next: boolean) {
    if (!user) return;
    setAutoStatus(null);
    setAutoOn(next);
    const { error } = await supabase.from('profiles').update({ auto_reflection: next }).eq('id', user.id);
    if (error) {
      setAutoOn(!next);
      setAutoStatus({ kind: 'error', text: error.message });
    } else {
      setAutoStatus({
        kind: 'ok',
        text: next ? 'Your daily reflection will be written after each log.' : 'Your daily reflection is written when you ask for it.',
      });
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
    const nameCheck = fullName.trim() ? validateDisplayName(fullName) : null;
    if (nameCheck && !nameCheck.ok) {
      setSaving(false);
      setStatus({ kind: 'error', text: nameCheck.message });
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: nameCheck?.name ?? null });
    setSaving(false);
    setStatus(error ? { kind: 'error', text: error.message } : { kind: 'ok', text: 'Name saved.' });
  }

  return (
    <>
      <PageHeader title="Settings" />

      <section className="max-w-md rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold">Profile</h2>
        <p className="mt-1 text-sm text-spruce/70">
          Signed in as {user?.email} ·{' '}
          <Link to="/reset-password" className="font-semibold underline underline-offset-4">
            Change password
          </Link>
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            What should we call you?
            <input
              className="mt-1.5 block w-full rounded-md border border-line px-3 py-2.5 focus:border-current focus:outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="nickname"
              maxLength={40}
            />
            <span className="mt-1.5 block text-xs text-spruce/60">One name only. It does not need to be your real name.</span>
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

      {AI_REFLECTION_ENABLED && (
        <section aria-labelledby="ai-settings" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
          <h2 id="ai-settings" className="font-display text-xl font-bold">
            Daily reflection
          </h2>
          <p className="mt-1 text-sm text-spruce/70">
            Choose when the few gentle sentences about your day are written. Either way, only today’s numbers, ratings and
            feelings are sent to Claude (Anthropic), never your name, email, location or notes, and nothing is saved.
          </p>
          <div className="mt-4">
            <AiConsentSetting />
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={autoOn} onChange={(e) => toggleAuto(e.target.checked)} />
            <span className="font-medium">Write my daily reflection automatically after I log</span>
          </label>
          <p className="mt-1 text-sm text-spruce/70">
            {autoOn
              ? 'On: each time you log or change today, a fresh reflection is waiting on your Dashboard.'
              : 'Off: the reflection is written only when you ask for it on the Dashboard.'}
          </p>
          {autoStatus && (
            <p role={autoStatus.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${autoStatus.kind === 'error' ? 'text-alert' : 'text-current'}`}>
              {autoStatus.text}
            </p>
          )}
        </section>
      )}

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

      <section aria-labelledby="your-data" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="your-data" className="font-display text-xl font-bold">
          Your data
        </h2>
        <p className="mt-1 text-sm text-spruce/70">
          Everything you have logged belongs to you. Download it any time: your days, notes, goals, the weather for each
          day, and your settings. Nothing is sent anywhere else; the file is saved straight to this device.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download('json')}
            disabled={downloading !== null}
            className="min-h-11 rounded-md bg-spruce px-4 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
          >
            {downloading === 'json' ? 'Gathering…' : 'Download all my data'}
          </button>
          <button
            type="button"
            onClick={() => download('csv')}
            disabled={downloading !== null}
            className="min-h-11 rounded-md border border-spruce px-4 font-semibold hover:bg-mist disabled:opacity-60"
          >
            {downloading === 'csv' ? 'Gathering…' : 'Daily log as a spreadsheet'}
          </button>
        </div>
        {downloadStatus && (
          <p role={downloadStatus.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${downloadStatus.kind === 'error' ? 'text-alert' : 'text-current'}`}>
            {downloadStatus.text}
          </p>
        )}
      </section>

      <section aria-labelledby="plan" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="plan" className="font-display text-xl font-bold">
          Your plan
        </h2>
        <p className="mt-2 text-sm text-spruce/80">See what you pay, if anything. Free for everyone 60 and over.</p>
        <Link to="/plan" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          See my plan
        </Link>
      </section>

      <section aria-labelledby="appt" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="appt" className="font-display text-xl font-bold">
          For a doctor visit
        </h2>
        <p className="mt-2 text-sm text-spruce/80">A one-page summary of your last 30 or 90 days that you can print or save. It uses only what you logged, and it never leaves your device.</p>
        <Link to="/appointment-summary" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Summary for my appointment
        </Link>
      </section>

      <SharingSettings />

      <EmailPreferences />

      <ReminderSetting />

      <HealthImport />

      <DeleteAccount />

      <section aria-labelledby="about" className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
        <h2 id="about" className="font-display text-xl font-bold">
          About Build Your Pillars
        </h2>
        <p className="mt-2 text-sm text-spruce/80">{ABOUT_STORY}</p>
        <p className="mt-2 text-sm text-spruce/80">Founders: {foundersLine()}.</p>
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
