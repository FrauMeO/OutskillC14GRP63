// Data saver: lets people on small data plans or weak signal use the app without automatic
// extras (weather, AI reflection, pre-fetching, auto-refresh). Miah, 2026-10-12.
//
// shouldSaveData() is a pure function of the connection hints and the person's own setting,
// so it is unit tested. The setting lives in localStorage under 'byp.dataSaver'.

export type DataSaverSetting = 'on' | 'off' | 'auto';

export const DATA_SAVER_KEY = 'byp.dataSaver';
export const DATA_SAVER_EVENT = 'byp-datasaver-change';

/** The parts of navigator.connection (Network Information API) that we read. */
export type ConnectionHints = { saveData?: boolean; effectiveType?: string } | null | undefined;

const SLOW_TYPES = new Set(['slow-2g', '2g', '3g']);

export function parseSetting(raw: unknown): DataSaverSetting {
  return raw === 'on' || raw === 'off' || raw === 'auto' ? raw : 'auto';
}

/**
 * On when the person chose On. Off when they chose Off. On "auto": follow the browser's Data
 * Saver flag, or a slow connection (slow-2g, 2g, 3g). Unknown connection info means "not slow".
 */
export function shouldSaveData(connection: ConnectionHints, setting: DataSaverSetting = readSetting()): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  if (!connection) return false;
  if (connection.saveData === true) return true;
  return typeof connection.effectiveType === 'string' && SLOW_TYPES.has(connection.effectiveType);
}

export function currentConnection(): ConnectionHints {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { connection?: ConnectionHints }).connection ?? null;
}

export function readSetting(): DataSaverSetting {
  try {
    return parseSetting(localStorage.getItem(DATA_SAVER_KEY));
  } catch {
    return 'auto';
  }
}

export function writeSetting(setting: DataSaverSetting): void {
  try {
    if (setting === 'auto') localStorage.removeItem(DATA_SAVER_KEY);
    else localStorage.setItem(DATA_SAVER_KEY, setting);
  } catch {
    // Storage blocked: the choice lasts only until the page closes.
  }
  window.dispatchEvent(new Event(DATA_SAVER_EVENT));
}

export const WEATHER_SKIPPED_TEXT = 'Weather skipped to save data. Tap to load it.';
export const REFLECTION_DATA_NOTE = 'Writing a reflection uses a little data.';
