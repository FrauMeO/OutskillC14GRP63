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
  isDirty,
  type Feeling,
  type LogFormValues,
  type RatingScale,
} from '../lib/checkin';
import { chooseLocation, cityNameFor, deviceCoordinates, type HomeCity, type LoggedLocation } from '../lib/location';
import { ensureConditions } from '../lib/conditions';
import MonthCalendar from '../components/MonthCalendar';
import { setUnsaved } from '../lib/unsaved';
import { celebrationText, dayNumbers, encouragementLine, isCelebrationEntry, isEncouragementEntry } from '../lib/milestones';

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const input =
  'block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce focus:border-current focus:outline-none';
const primaryBtn =
  'min-h-11 rounded-md bg-spruce px-5 py-2.5 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// What the Location line says: the day's saved place, or what saving will use.
function locationText({ saved, isToday, home }: { saved: LoggedLocation | null; isToday: boolean; home: HomeCity | null }): string {
  if (saved) {
    const name = saved.name ?? 'Unnamed place';
    return `${name} (${saved.source === 'device' ? 'from your device' : 'your home city'})`;
  }
  if (isToday) {
    return home
      ? `your device location if you allow it when you save, otherwise ${home.city}`
      : 'your device location if you allow it when you save';
  }
  return home ? `${home.city} (your home city) when you save` : 'none yet; add a home city to include the weather';
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
  // What was loaded or last saved for this day, so unsaved changes are never dropped silently.
  const [baseline, setBaseline] = useState<LogFormValues>({ ...EMPTY_FORM });
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [existingLocation, setExistingLocation] = useState<LoggedLocation | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [loadingDay, setLoadingDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [flash, setFlash] = useState<Flash>(null);
  const [home, setHome] = useState<HomeCity | null>(null);
  const [homeLoaded, setHomeLoaded] = useState(false);
  const [allDates, setAllDates] = useState<string[]>([]);
  const [celebration, setCelebration] = useState<string | null>(null);

  const dirty = !loadingDay && isDirty(form, baseline);

  // Switching days: never drop unsaved changes without asking.
  function requestDate(next: string) {
    if (next === date || saving) return;
    if (dirty) setPendingDate(next);
    else setDate(next);
  }

  // Closing or reloading the tab, or leaving through the menu, with unsaved changes asks first, too.
  useEffect(() => {
    setUnsaved(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      setUnsaved(false);
    };
  }, [dirty]);

  const week = lastNDays(7).map(toISODate);
  const loggedDates = new Set(allDates);

  // Every logged date (dates only), for the 7-day row, the month calendar and entry numbers.
  const loadWeek = useCallback(async () => {
    const { data } = await supabase.from('habit_logs').select('log_date').order('log_date');
    const dates = (data ?? []).map((r) => r.log_date);
    setAllDates(dates);
    return dates;
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
        const loadedForm = formFromRow(data);
        setForm(loadedForm);
        setBaseline(loadedForm);
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
    await saveEntry();
  }

  // Saves the open day. Returns true when it was saved.
  async function saveEntry(): Promise<boolean> {
    setFlash(null);
    const saved = form; // the values being saved, even if the form changes while saving
    const { fields, errors: problems } = buildLogFields(saved);
    setErrors(problems);
    if (!fields) return false;
    if (date > todayIso) {
      setErrors(['You can only log today or an earlier day.']);
      return false;
    }
    if (!hasAnyValue(fields) && !isExisting) {
      setErrors(['Enter at least one value before saving.']);
      return false;
    }

    setSaving(true);
    setCelebration(null);
    const wasNew = !isExisting; // only a new day counts as a new entry
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
        // Entered or changed by hand, so the dashboard shows bars rather than Apple Health rings.
        source: 'manual',
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
      return false;
    }

    setBaseline(saved);
    setIsExisting(true);
    setExistingLocation(place);
    const dates = await loadWeek();
    const entry = dates.length; // this new day's entry number

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
    // Encouragement at random, never more than once every 5 new entries; a glow every 14th.
    const kind = wasNew && user && isEncouragementEntry(user.id, entry) ? ` ${encouragementLine(user.id, entry)}` : '';
    if (wasNew && isCelebrationEntry(entry)) setCelebration(celebrationText(entry));
    setFlash({ kind: 'ok', text: `Saved for ${longDate(date)}.${weatherNote}${kind}` });
    return true;
  }

  async function saveThenSwitch() {
    const next = pendingDate;
    setPendingDate(null);
    if (next && (await saveEntry())) setDate(next);
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

      {celebration && (
        <div role="status" className="celebrate mb-4 max-w-2xl rounded-lg border-2 px-5 py-4">
          <p className="font-display text-xl font-bold">
            <span aria-hidden className="text-sun">★ </span>
            {celebration}
          </p>
          <p className="mt-1 text-spruce/80">Thank you for making time for yourself.</p>
        </div>
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

      {pendingDate && (
        <div role="alertdialog" aria-labelledby="unsaved-title" className="mb-6 max-w-2xl rounded-lg border-2 border-sun bg-white p-5">
          <p id="unsaved-title" className="font-semibold">
            You have unsaved changes for {longDate(date)}.
          </p>
          <p className="mt-1 text-sm text-spruce/75">Save them before opening {longDate(pendingDate)}, or they will be lost.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={saveThenSwitch} className={primaryBtn}>
              Save, then open {longDate(pendingDate)}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = pendingDate;
                setPendingDate(null);
                setDate(next);
              }}
              className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold hover:bg-mist"
            >
              Discard changes
            </button>
            <button type="button" onClick={() => setPendingDate(null)} className="min-h-11 rounded-md px-4 text-sm font-semibold hover:bg-mist">
              Keep editing
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-2xl" aria-busy={loadingDay || saving}>
        {/* Locked while a day loads or saves, so a quick click can never be overwritten. */}
        <fieldset disabled={loadingDay || saving} className="min-w-0 space-y-6">
        <section className="rounded-lg border border-line bg-white p-5 md:p-6">
          <label className="block text-sm font-medium">
            Date
            <input
              type="date"
              className={`${input} mt-1.5 max-w-xs`}
              value={date}
              max={todayIso}
              onChange={(e) => e.target.value && requestDate(e.target.value)}
            />
          </label>
          <p className="mt-2 text-sm text-spruce/70" role="status">
            {loadingDay ? 'Loading…' : isExisting ? `Editing your entry for ${longDate(date)}.` : `New entry for ${longDate(date)}.`}
          </p>
          {!loadingDay && (
            <p className="mt-1 text-sm">
              <span className="font-medium">Location: </span>
              {locationText({ saved: existingLocation, isToday: date === todayIso, home })}
            </p>
          )}
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
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              Steps
              <input
                className={`${input} mt-1.5`}
                type="number"
                inputMode="numeric"
                min={0}
                max={200000}
                step={1}
                value={form.steps}
                onChange={(e) => set('steps', e.target.value)}
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
          {dirty && !saving && <p className="text-sm font-medium text-sun">Unsaved changes</p>}
          {date === todayIso && (
            <p className="text-sm text-spruce/70">Your browser may ask to share your location for the weather. Saying no is fine.</p>
          )}
        </div>
        </fieldset>
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
                  onClick={() => requestDate(d)}
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
        <div className="mt-6">
          <MonthCalendar dayNumbers={dayNumbers(allDates)} todayIso={todayIso} selected={date} onSelect={requestDate} />
        </div>
      </section>
    </>
  );
}
