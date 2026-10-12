// Crisis lines for the person's country, shown under the fixed hard-day and hard-week messages.
// Reads only profiles.home_country_code (the same value the gentle check-in uses).
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { hardDayResources } from './hardDayResources';

export default function HardDaySupport() {
  const { user } = useAuth();
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase
      .from('profiles')
      .select('home_country_code')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (live) setCountry(data?.home_country_code ?? null);
      });
    return () => {
      live = false;
    };
  }, [user]);

  // Shown at once with the fallback list, then refined when the country arrives.
  const items = hardDayResources(country);
  return (
    <ul className="mt-3 space-y-2" aria-label="Support lines">
      {items.map((r) => (
        <li key={r.key} className="rounded-md border border-line bg-white p-3">
          <p className="font-semibold">
            {r.href ? (
              <a href={r.href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                {r.name}
              </a>
            ) : r.tel ? (
              <a href={`tel:${r.tel}`} className="underline underline-offset-4">
                {r.name}
              </a>
            ) : (
              r.name
            )}
          </p>
          <p className="text-sm text-spruce/80">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}
