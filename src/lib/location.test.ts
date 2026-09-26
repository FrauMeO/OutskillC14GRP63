import { describe, expect, it } from 'vitest';
import { chooseLocation, roundCoord } from './location';

const home = { city: 'Philadelphia, Pennsylvania', countryCode: 'US', latitude: 39.95, longitude: -75.16 };
const device = { name: 'Seattle, Washington', latitude: 47.61, longitude: -122.33 };
const existing = { name: 'Boston', latitude: 42.4, longitude: -71.1, source: 'device' as const };

describe('roundCoord', () => {
  it('rounds to 0.1 degree (about 11 km)', () => {
    expect(roundCoord(39.95)).toBe(40);
    expect(roundCoord(-75.16)).toBe(-75.2);
    expect(roundCoord(47.6062)).toBe(47.6);
  });
});

describe('chooseLocation fallback order', () => {
  it('uses the device when logging today and it is available', () => {
    expect(chooseLocation({ isToday: true, device, existing, home })).toEqual({
      name: 'Seattle, Washington',
      latitude: 47.6,
      longitude: -122.3,
      source: 'device',
    });
  });

  it('ignores the device for an earlier day and keeps what that day already had', () => {
    expect(chooseLocation({ isToday: false, device, existing, home })).toEqual(existing);
  });

  it('falls back to home when the device is declined and the day has no location', () => {
    expect(chooseLocation({ isToday: true, device: null, existing: null, home })).toEqual({
      name: 'Philadelphia, Pennsylvania',
      latitude: 40,
      longitude: -75.2,
      source: 'home',
    });
  });

  it('returns null when nothing is known, so saving is never blocked', () => {
    expect(chooseLocation({ isToday: true, device: null, existing: null, home: null })).toBeNull();
  });

  it('control: device and home give different answers, so the order is observable', () => {
    const withDevice = chooseLocation({ isToday: true, device, existing: null, home });
    const withoutDevice = chooseLocation({ isToday: true, device: null, existing: null, home });
    expect(withDevice).not.toEqual(withoutDevice);
  });
});
