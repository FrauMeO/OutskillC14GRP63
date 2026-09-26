// Where the person was on a given day. Only a city name and coordinates rounded to 0.1 degree
// (about 11 km) are ever stored.

export type Place = {
  name: string | null;
  latitude: number;
  longitude: number;
};

export type HomeCity = {
  city: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
};

export type LoggedLocation = Place & { source: 'device' | 'home' };

export function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

// Fallback order: device (only when logging today) -> the location already saved for that day
// -> home city -> none. Never blocks saving.
export function chooseLocation(opts: {
  isToday: boolean;
  device: Place | null;
  existing: LoggedLocation | null;
  home: HomeCity | null;
}): LoggedLocation | null {
  const { isToday, device, existing, home } = opts;
  if (isToday && device) {
    return { name: device.name, latitude: roundCoord(device.latitude), longitude: roundCoord(device.longitude), source: 'device' };
  }
  if (existing) return existing;
  if (home) {
    return { name: home.city, latitude: roundCoord(home.latitude), longitude: roundCoord(home.longitude), source: 'home' };
  }
  return null;
}

export type CityMatch = HomeCity & { label: string };

type GeocodeResult = {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
};

// Open-Meteo Geocoding API: city name -> matches the user picks from.
export async function searchCities(query: string, signal?: AbortSignal): Promise<CityMatch[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`City search failed (${res.status}).`);
  const body = (await res.json()) as { results?: GeocodeResult[] };
  return (body.results ?? []).map((r) => ({
    city: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
    countryCode: r.country_code ? r.country_code.toUpperCase() : null,
    latitude: roundCoord(r.latitude),
    longitude: roundCoord(r.longitude),
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

// BigDataCloud's free client endpoint: rounded coordinates -> city name. Null if it fails.
export async function cityNameFor(latitude: number, longitude: number, timeoutMs = 5000): Promise<string | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${roundCoord(latitude)}&longitude=${roundCoord(longitude)}&localityLanguage=en`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string };
    const place = body.city || body.locality;
    if (!place) return null;
    return body.principalSubdivision && body.principalSubdivision !== place ? `${place}, ${body.principalSubdivision}` : place;
  } catch {
    return null;
  }
}

// Asks the browser for the device's position. Resolves null if declined, unavailable or slow.
export function deviceCoordinates(timeoutMs = 5000): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ latitude: roundCoord(pos.coords.latitude), longitude: roundCoord(pos.coords.longitude) });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 30 * 60_000 },
    );
  });
}
