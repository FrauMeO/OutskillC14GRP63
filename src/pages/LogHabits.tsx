import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import CityPicker from '../components/CityPicker';
import { lastNDays, toISODate } from '../lib/dates';
import {
  EMPTY_FORM,
  FEELINGS,
  NOTES_MAX,
  RATING_SCALES,
  buildLogFields,
  formFromRow,
  hasAnyValue,
  type Feeling,
  type LogFormValues,
  type RatingScale,
} from '../lib/checkin';
import { chooseLocation, cityNameFor, deviceCoordinates, type HomeCity, type LoggedLocation } from '../lib/location';
import { ensureConditions } from '../lib/conditions';

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const input =
  'block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce focus:border-current focus:outline-none';
const primaryBtn =
  'min-h-11 rounded-md bg-spruce px-5 py-2.5 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function RatingGroup({
  scale,
  value,
  onChange,
}: {
  scale: RatingScale;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <fieldset>
      <div className="flex items-baseline justify-between">
        <legend className="text-sm font-semibold">{scale.label}</legend>
        {value !== null && (
          <button type="button" className="text-sm text-spruce/70 underline underline-offset-4" onClick={() => onChange(null)}>
            Clear {scale.label.toLowerCase()}
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {scale.levels.map((level, i) => {
          const n = i + 1;
          const checked = value === n;
          return (
            <label
              key={level}
              className={`flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-md border px-1 py-2 text-center text-xs leading-tight has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-current ${
                checked ? 'border-spruce bg-spruce text-mist' : 'border-line bg-white hover:bg-mist'
              }`}
            >
              <input type="radio" className="sr-only" name={scale.key} value={n} checked={checked} onChange={() => onChange(n)} />
              {scale.faces && (
                <span className="text-2xl" aria-hidden>
                  {scale.faces[i]}
                </span>
              )}
              <span>{level}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LogHabits() {
  const { user } = useAuth();
  const todayIso = toISODate(new Date());

  const [date, setDate] = useState(todayIso);
  const [form, setForm] = useState<LogFormValues>({ ...EMPTY_FORM });
  const [existingLocation, setExistingLocation] = useState<LoggedLocation | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [loadingDay, setLoadingDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [home, setHome] = useState<HomeCity | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());

  const week = lastNDays(7).map(toISODate);

  const loadWeek = useCallback(async () => {
    const days = lastNDays(7).map(toISODate);
    const { data } = await supabase
      .from('habit_logs')
      .select('log_date')
      .gte('log_date', days[0])
      .lte('log_date', days[days.length - 1]);
    setLoggedDates(new Set((data ?? []).map((r) => r.log_date)));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('home_city, home_country_code, home_latitude, home_longitude')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.home_city && data.home_latitude !== null && data.home_longitude !== null) {
          setHome({
            city: data.home_city,
            countryCode: data.home_country_code,
            latitude: Number(data.home_latitude),
            longitude: Number(data.home_longitude),
          });
        }
        setHomeLoaded(true);
      });
    loadWeek();
  }, [user, loadWeek]);

  // Opening a date that already has a row loads it for editing.
  useEffect(() => {
    let cancelled = false;
    setLoadingDay(true);
    setErrors([]);
    supabase
      .from('habit_logs')
      .select('*')
      .eq('log_date', date)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFlash({ kind: 'error', text: `Could not load ${longDate(date)}: ${error.message}` });
        setForm(formFromRow(data));
        setIsExisting(Boolean(data));
        setExistingLocation(
          data && data.latitude !== null && data.longitude !== null
            ? {
                name: data.location_name,
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                source: data.location_source === 'device' ? 'device' : 'home',
              }
            : null,
        );
        setLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function set<K extends keyof LogFormValues>(key: K, value: LogFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleFeeling(value: Feeling) {
    setForm((f) => ({
      ...f,
      feelings: f.feelings.includes(value) ? f.feelings.filter((x) => x !== value) : [...f.feelings, value],
    }));
  }

  async function saveHome(city: HomeCity) {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        home_city: city.city,
        home_country_code: city.countryCode,
        home_latitude: city.latitude,
        home_longitude: city.longitude,
      })
      .eq('id', user.id);
    if (error) return setFlash({ kind: 'error', text: `Could not save home city: ${error.message}` });
    setHome(city);
    setFlash({ kind: 'ok', text: `Home city set to ${city.city}.` });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFlash(null);
    const { fields, errors: problems } = buildLogFields(form);
    setErrors(problems);
    if (!fields) return;
    if (date > todayIso) return setErrors(['You can only log today or an earlier day.']);
    if (!hasAnyValue(fields) && !isExisting) return setErrors(['Enter at least one value before saving.']);

    setSaving(true);
    // Device location only describes where you are now, so it is used only when logging today.
    const isToday = date === todayIso;
    let device = null;
    if (isToday) {
      const coords = await deviceCoordinates();
      if (coords) device = { ...coords, name: await cityNameFor(coords.latitude, coords.longitude) };
    }
    const place = chooseLocation({ isToday, device, existing: existingLocation, home });

    const { error } = await supabase.from('habit_logs').upsert(
      {
        log_date: date,
        ...fields,
        location_name: place?.name ?? null,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        location_source: place?.source ?? null,
      },
      { onConflict: 'user_id,log_date' },
    );
    if (error) {
      setSaving(false);
      setFlash({ kind: 'error', text: `Could not save: ${error.message}` });
      return;
    }

    setIsExisting(true);
    setExistingLocation(place);
    await loadWeek();

    let weatherNote = '';
    if (!place) {
      weatherNote = ' Add a home city to include the weather.';
    } else {
      const result = await ensureConditions(place, date, todayIso);
      if (result === 'failed') {
        weatherNote = ' The weather could not be fetched; it will be tried again the next time you save this day.';
      } else if (result === 'fetched') {
        weatherNote = ` Weather for ${place.name ?? 'your location'} added.`;
      }
    }
    setSaving(false);
    setFlash({ kind: 'ok', text: `Saved for ${longDate(date)}.${weatherNote}` });
  }

  return (
    <>
      <PageHeader title="Log habits">
        Record today, or pick an earlier day to fill in or change it. Leave blank anything you did not track.
      </PageHeader>

      {homeLoaded && !home && (
        <section aria-labelledby="home-city" className="mb-6 max-w-2xl rounded-lg border border-current/30 bg-current/5 p-5">
          <h2 id="home-city" className="font-semibold">
            Add your home city
          </h2>
          <p className="mt-1 text-sm text-spruce/75">
            It is used for the weather when you do not share your device location. You can still save without it.
          </p>
          <div className="mt-3">
            <CityPicker onPick={saveHome} />
          </div>
        </section>
      )}

      {flash && (
        <p
          role={flash.kind === 'error' ? 'alert' : 'status'}
          className={`mb-6 max-w-2xl rounded-md px-4 py-3 text-sm ${
            flash.kind === 'error' ? 'bg-alert/10 text-alert' : 'bg-current/10 text-current'
          }`}
        >
          {flash.text}
        </p>
      )}

      <form onSubmit={handleSave} className="max-w-2xl space-y-6" aria-busy={loadingDay}>
        <section className="rounded-lg border border-line bg-white p-5 md:p-6">
          <label className="block text-sm font-medium">
            Date
            <input
              type="date"
              className={`${input} mt-1.5 max-w-xs`}
              value={date}
              max={todayIso}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <p className="mt-2 text-sm text-spruce/70" role="status">
            {loadingDay ? 'Loading…' : isExisting ? `Editing your entry for ${longDate(date)}.` : `New entry for ${longDate(date)}.`}
          </p>
        </section>

        <section aria-labelledby="checkin" className="space-y-5 rounded-lg border border-line bg-white p-5 md:p-6">
          <h2 id="checkin" className="font-display text-xl font-bold">
            Check-in
          </h2>
          {RATING_SCALES.map((scale) => (
            <RatingGroup key={scale.key} scale={scale} value={form[scale.key]} onChange={(n) => set(scale.key, n)} />
          ))}
          <fieldset>
            <legend className="text-sm font-semibold">Feelings (choose any)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEELINGS.map((f) => {
                const on = form.feelings.includes(f.value);
                return (
                  <label
                    key={f.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-current ${
                      on ? 'border-spruce bg-spruce text-mist' : 'border-line bg-white hover:bg-mist'
                    }`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => toggleFeeling(f.value)} />
                    <span aria-hidden>{f.face}</span>
                    {f.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="habits" className="rounded-lg border border-line bg-white p-5 md:p-6">
          <h2 id="habits" className="font-display text-xl font-bold">
            Habits
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Exercise (minutes)
              <input
                className={`${input} mt-1.5`}
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                step={1}
                value={form.exercise}
                onChange={(e) => set('exercise', e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Sleep (hours)
              <input
                className={`${input} mt-1.5`}
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.25}
                value={form.sleep}
                onChange={(e) => set('sleep', e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Water (liters)
              <input
                className={`${input} mt-1.5`}
                type="number"
                inputMode="decimal"
                min={0}
                max={20}
                step={0.1}
                value={form.water}
                onChange={(e) => set('water', e.target.value)}
              />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium">
            Notes (optional)
            <textarea
              className={`${input} mt-1.5`}
              rows={3}
              maxLength={NOTES_MAX}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </section>

        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-md bg-alert/10 px-4 py-3 text-sm text-alert">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || loadingDay} className={primaryBtn}>
            {saving ? 'Saving…' : isExisting ? 'Save changes' : 'Save entry'}
          </button>
          {date === todayIso && (
            <p className="text-sm text-spruce/70">Your browser may ask to share your location for the weather. Saying no is fine.</p>
          )}
        </div>
      </form>

      <section aria-labelledby="last-week" className="mt-10 max-w-2xl">
        <h2 id="last-week" className="font-display text-xl font-bold">
          Last 7 days
        </h2>
        <ul className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const logged = loggedDates.has(d);
            const [y, m, day] = d.split('-').map(Number);
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => setDate(d)}
                  aria-current={d === date ? 'date' : undefined}
                  aria-label={`${longDate(d)}: ${logged ? 'logged' : 'not logged'}`}
                  className={`flex min-h-11 w-full flex-col items-center rounded-md border bg-white px-1 py-2 text-xs hover:bg-mist ${
                    d === date ? 'border-spruce' : 'border-line'
                  }`}
                >
                  <span>{new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="font-semibold">{day}</span>
                  <span aria-hidden className={`text-lg ${logged ? 'text-green-700' : 'text-line'}`}>
                    {logged ? '✓' : '·'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm text-spruce/70">A check mark means that day has an entry. Choose a day to open it.</p>
      </section>
    </>
  );
}
