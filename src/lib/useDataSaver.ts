import { useSyncExternalStore } from 'react';
import {
  DATA_SAVER_EVENT,
  currentConnection,
  readSetting,
  shouldSaveData,
  type DataSaverSetting,
} from './dataSaver';

function subscribe(onChange: () => void) {
  window.addEventListener(DATA_SAVER_EVENT, onChange);
  window.addEventListener('storage', onChange);
  const conn = currentConnection() as EventTarget | null;
  conn?.addEventListener?.('change', onChange);
  return () => {
    window.removeEventListener(DATA_SAVER_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    conn?.removeEventListener?.('change', onChange);
  };
}

// One string, so useSyncExternalStore sees a stable value between changes.
function snapshot(): string {
  const setting = readSetting();
  return `${setting}|${shouldSaveData(currentConnection(), setting) ? 1 : 0}`;
}

export function useDataSaver(): { setting: DataSaverSetting; saveData: boolean } {
  const [setting, flag] = useSyncExternalStore(subscribe, snapshot, () => 'auto|0').split('|');
  return { setting: setting as DataSaverSetting, saveData: flag === '1' };
}
