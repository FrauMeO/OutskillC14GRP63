import { useId, useState } from 'react';
import { searchCities, type CityMatch, type HomeCity } from '../lib/location';

const input =
  'block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce placeholder:text-moss focus:border-current focus:outline-none';

// Search a city by name (Open-Meteo Geocoding) and pick one match. Used at sign-up, in Settings,
// and on Log Habits when no home city is set.
export default function CityPicker({
  label = 'Home city',
  onPick,
}: {
  label?: string;
  onPick: (city: HomeCity & { label: string }) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CityMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    if (query.trim().length < 2) return setError('Type at least 2 letters of the city name.');
    setSearching(true);
    try {
      const found = await searchCities(query);
      setMatches(found);
      if (!found.length) setError(`No city found for "${query.trim()}". Check the spelling.`);
    } catch {
      setError('City search is not available right now. Try again in a moment.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          className={input}
          type="text"
          autoComplete="address-level2"
          placeholder="For example, Philadelphia"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              search();
            }
          }}
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="min-h-11 rounded-md border border-spruce px-4 font-semibold hover:bg-spruce hover:text-mist disabled:opacity-60"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-white" aria-label="Matching cities">
          {matches.map((m) => (
            <li key={`${m.label}-${m.latitude}-${m.longitude}`}>
              <button
                type="button"
                className="min-h-11 w-full px-3 py-2 text-left hover:bg-mist"
                onClick={() => {
                  onPick(m);
                  setMatches(null);
                  setQuery('');
                }}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
