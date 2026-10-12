import { describe, expect, it } from 'vitest';
import { parseSetting, shouldSaveData } from './dataSaver';

describe('shouldSaveData', () => {
  it('on means on, whatever the connection', () => {
    expect(shouldSaveData({ effectiveType: '4g' }, 'on')).toBe(true);
    expect(shouldSaveData(null, 'on')).toBe(true);
  });

  it('off means off, even when the browser asks for data saving (control)', () => {
    expect(shouldSaveData({ saveData: true, effectiveType: '2g' }, 'off')).toBe(false);
  });

  it('auto follows the browser Data Saver flag', () => {
    expect(shouldSaveData({ saveData: true, effectiveType: '4g' }, 'auto')).toBe(true);
  });

  it.each(['slow-2g', '2g', '3g'])('auto saves data on %s', (t) => {
    expect(shouldSaveData({ effectiveType: t }, 'auto')).toBe(true);
  });

  it('auto does not save data on a fast connection (control)', () => {
    expect(shouldSaveData({ saveData: false, effectiveType: '4g' }, 'auto')).toBe(false);
  });

  it('auto with no connection information (Safari, Firefox) does not save data', () => {
    expect(shouldSaveData(undefined, 'auto')).toBe(false);
    expect(shouldSaveData(null, 'auto')).toBe(false);
    expect(shouldSaveData({}, 'auto')).toBe(false);
  });
});

describe('parseSetting', () => {
  it('defaults to auto for missing or unknown values', () => {
    expect(parseSetting(null)).toBe('auto');
    expect(parseSetting('maybe')).toBe('auto');
    expect(parseSetting('on')).toBe('on');
    expect(parseSetting('off')).toBe('off');
  });
});
