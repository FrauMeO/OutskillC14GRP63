// Today's weather on the Dashboard, linking to Insights. Uses the day's cached conditions; if
// there are none yet, fetches them for the home city (the same cache Log habits fills).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ensureConditions } from '../lib/conditions';
import { weatherParts } from '../lib/todayWeather';

type State = { status: 'loading' } | { status: 'none' } | { status: 'no-city' } | { status: 'ready'; place: string; parts: string[] };

export default function TodayWeather({ userId, todayIso }: { userId: string; todayIso: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const read = () => supabase.from('daily_conditions').select('*').eq('date', todayIso).maybeSingle();

    (async () => {
      let { data: row } = await read();
      if (!row) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('home_city, home_latitude, home_longitude')
          .eq('id', userId)
          .maybeSingle();
        const lat = profile?.home_latitude;
        const lon = profile?.home_longitude;
        if (lat === null || lat === undefined || lon === null || lon === undefined) {
          if (!cancelled) setState({ status: 'no-city' });
          return;
        }
        await ensureConditions({ name: profile?.home_city ?? null, latitude: Number(lat), longitude: Number(lon) }, todayIso, todayIso);
        row = (await read()).data;
      }
      if (cancelled) return;
      const parts = weatherParts(row);
      setState(parts.length ? { status: 'ready', place: row?.location_name ?? 'your area', parts } : { status: 'none' });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, todayIso]);

  if (state.status === 'loading' || state.status === 'none') return null;

  return (
    <section aria-labelledby="today-weather" className="mb-6 rounded-lg border border-line bg-white px-5 py-4">
      {state.status === 'no-city' ? (
        <p className="text-spruce/80">
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
          <p className="mt-1 text-sm text-spruce/70">
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
