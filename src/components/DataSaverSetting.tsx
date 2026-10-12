import { useId } from 'react';
import { writeSetting, type DataSaverSetting as Setting } from '../lib/dataSaver';
import { useDataSaver } from '../lib/useDataSaver';

const OPTIONS: { value: Setting; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Saves data when your phone asks for it or the connection is slow.' },
  { value: 'on', label: 'On', hint: 'Always saves data.' },
  { value: 'off', label: 'Off', hint: 'Never limits what the app loads.' },
];

// Mount in Settings (see docs/low-data-report.md). The choice is stored on this device only.
export default function DataSaverSetting() {
  const { setting, saveData } = useDataSaver();
  const name = useId();
  return (
    <fieldset className="max-w-2xl">
      <legend className="font-display text-xl font-bold">Data saver</legend>
      <p className="mt-1 text-sm text-spruce/75">
        When on, the app does not load weather or write an AI reflection by itself. You can still tap to get
        them. {saveData ? 'Data saver is on right now.' : 'Data saver is off right now.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={[
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-current',
              setting === o.value ? 'border-spruce bg-spruce text-mist' : 'border-line bg-white text-spruce',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={setting === o.value}
              onChange={() => writeSetting(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-spruce/65">{OPTIONS.find((o) => o.value === setting)?.hint}</p>
    </fieldset>
  );
}
