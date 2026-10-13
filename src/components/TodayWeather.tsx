// Today's weather on the Dashboard, linking to Insights. Uses the day's cached conditions; if
// there are none yet, fetches them for the home city (the same cache Log habits fills).
// With Data saver on, nothing is fetched until the person taps to load it.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ensureConditions } from '../lib/conditions';
import { weatherParts } from '../lib/todayWeather';
import { WEATHER_SKIPPED_TEXT } from '../lib/dataSaver';
import { useDataSaver } from '../lib/useDataSaver';

const TAP_TO_LOAD = 'Tap to load it.'; // the end of WEATHER_SKIPPED_TEXT, shown as the button

type State =
  | { status: 'loading' }
  | { status: 'skipped' }
  | { status: 'none' }
  | { status: 'no-city' }
  | { status: 'ready'; place: string; parts: string[] };

export default function TodayWeather({ userId, todayIso }: { userId: string; todayIso: string }) {
  const { saveData } = useDataSaver();
  const [state, setState] = useState<State>(saveData ? { status: 'skipped' } : { status: 'loading' });
  const [requested, setRequested] = useState(false); // the person tapped "load it"

  const load = useCallback(
    async (isCancelled: () => boolean) => {
      const read = () => supabase.from('daily_conditions').select('*').eq('date', todayIso).maybeSingle();
      let { data: row, error } = await read();
      if (error) return isCancelled() ? undefined : setState({ status: 'none' }); // offline or failed: say nothing
      if (!row) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('home_city, home_latitude, home_longitude')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) return isCancelled() ? undefined : setState({ status: 'none' });
        const lat = profile?.home_latitude;
        const lon = profile?.home_longitude;
        if (lat === null || lat === undefined || lon === null || lon === undefined) {
          if (!isCancelled()) setState({ status: 'no-city' });
          return;
        }
        await ensureConditions({ name: profile?.home_city ?? null, latitude: Number(lat), longitude: Number(lon) }, todayIso, todayIso);
        ({ data: row, error } = await read());
      }
      if (isCancelled()) return;
      const parts = weatherParts(row);
      setState(parts.length ? { status: 'ready', place: row?.location_name ?? 'your area', parts } : { status: 'none' });
    },
    [userId, todayIso],
  );

  useEffect(() => {
    let cancelled = false;
    if (saveData && !requested) {
      setState((s) => (s.status === 'ready' ? s : { status: 'skipped' }));
      return;
    }
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load, saveData, requested]);

  if (state.status === 'loading' || state.status === 'none') return null;

  if (state.status === 'skipped') {
    return (
      <section aria-labelledby="today-weather" className="mb-6 rounded-lg border border-line bg-white px-5 py-4">
        <p id="today-weather" className="text-moss">
          {WEATHER_SKIPPED_TEXT.replace(TAP_TO_LOAD, '').trim()}{' '}
          <button
            type="button"
            onClick={() => setRequested(true)}
            className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {TAP_TO_LOAD}
          </button>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="today-weather" className="mb-6 rounded-lg border border-line bg-white px-5 py-4">
      {state.status === 'no-city' ? (
        <p className="text-moss">
          <span id="today-weather" className="font-semibold">
            Today's weather
          </span>{' '}
          appears here once you add a home city.{' '}
          <Link to="/settings" className="font-semibold underline underline-offset-4">
            Add it in Settings
          </Link>
        </p>
      ) : (
        <>
          <p>
            <span id="today-weather" className="font-semibold">
              Today in {state.place.split(',')[0]}:
            </span>{' '}
            {state.parts.join(', ')}.
          </p>
          <p className="mt-1 text-sm text-moss">
            <Link to="/insights" className="font-semibold underline underline-offset-4">
              See how weather and your days go together
            </Link>
            <span aria-hidden="true"> · </span>
            Weather by{' '}
            <a href="https://open-meteo.com/" className="underline underline-offset-4" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>
          </p>
        </>
      )}
    </section>
  );
}
