import { describe, expect, it } from 'vitest';
import { maxOrNull, meanOrNull, moonFor, needsFetch, splitByDate, toConditionValues } from './conditionsCore';

describe('moonFor', () => {
  it('matches known 2024 moon phases', () => {
    // Full moon 2024-01-25 17:54 UTC, new moon 2024-01-11 11:57 UTC, first quarter 2024-01-18 03:53 UTC.
    expect(moonFor('2024-01-25').illumination).toBeGreaterThan(0.97);
    expect(moonFor('2024-01-25').phase).toBe('Full moon');
    expect(moonFor('2024-01-11').illumination).toBeLessThan(0.03);
    expect(moonFor('2024-01-11').phase).toBe('New moon');
    expect(moonFor('2024-01-18').illumination).toBeGreaterThan(0.4);
    expect(moonFor('2024-01-18').illumination).toBeLessThan(0.6);
  });

  it('control: a week apart gives clearly different illumination', () => {
    expect(Math.abs(moonFor('2024-01-11').illumination - moonFor('2024-01-18').illumination)).toBeGreaterThan(0.3);
  });
});

describe('hourly to daily', () => {
  it('ignores missing hours and returns null when nothing is present', () => {
    expect(meanOrNull([10, null, 20])).toBe(15);
    expect(maxOrNull([null, 3, 9, undefined])).toBe(9);
    expect(meanOrNull([null, null])).toBeNull();
    expect(maxOrNull([])).toBeNull();
  });
});

describe('toConditionValues', () => {
  const place = { name: 'Philadelphia', latitude: 40, longitude: -75.2 };
  const weather = {
    daily: {
      precipitation_sum: [3.2],
      rain_sum: [3.2],
      snowfall_sum: [0],
      temperature_2m_min: [15],
      temperature_2m_max: [27],
      apparent_temperature_max: [29],
      uv_index_max: [6.1],
      daylight_duration: [48600],
      sunshine_duration: [36000],
    },
    hourly: { relative_humidity_2m: [60, 70, null], surface_pressure: [1010, 1012] },
  };

  it('maps one day and converts seconds to hours', () => {
    const row = toConditionValues(place, '2026-08-01', weather, { hourly: { us_aqi: [40, 55], pm2_5: [8, 10] } }, true);
    expect(row).toMatchObject({
      date: '2026-08-01',
      rain_mm: 3.2,
      humidity_mean_pct: 65,
      pressure_mean_hpa: 1011,
      daylight_hours: 13.5,
      sunshine_hours: 10,
      us_aqi_max: 55,
      pm2_5_mean: 9,
      is_final: true,
    });
  });

  it('stores null pollen outside Europe, and a value where pollen exists (control)', () => {
    const us = toConditionValues(place, '2026-08-01', weather, { hourly: { birch_pollen: [null, null] } }, true);
    const eu = toConditionValues(place, '2026-08-01', weather, { hourly: { grass_pollen: [0.7, 2.1] } }, true);
    expect(us.pollen_max).toBeNull();
    expect(eu.pollen_max).toBe(2.1);
  });

  it('keeps weather when air quality failed', () => {
    const row = toConditionValues(place, '2026-08-01', weather, null, false);
    expect(row.rain_mm).toBe(3.2);
    expect(row.us_aqi_max).toBeNull();
  });
});

describe('needsFetch cache rules', () => {
  const place = { latitude: 40, longitude: -75.2 };
  const today = '2026-09-25';

  it('fetches when there is no row', () => {
    expect(needsFetch(null, place, today, today)).toBe(true);
  });

  it('keeps a final row and keeps today\'s forecast while it is still today', () => {
    expect(needsFetch({ ...place, is_final: true }, place, '2026-09-20', today)).toBe(false);
    expect(needsFetch({ ...place, is_final: false }, place, today, today)).toBe(false);
  });

  it('replaces a forecast once its date has passed (control for the rule above)', () => {
    expect(needsFetch({ ...place, is_final: false }, place, '2026-09-24', today)).toBe(true);
  });

  it('refetches when the place changed', () => {
    expect(needsFetch({ latitude: 47.6, longitude: -122.3, is_final: true }, place, '2026-09-20', today)).toBe(true);
  });
});

describe('splitByDate', () => {
  it('splits a two-day response into one entry per local date', () => {
    const body = {
      daily: { time: ['2026-08-01', '2026-08-02'], rain_sum: [0, 4.5] },
      hourly: { time: ['2026-08-01T00:00', '2026-08-01T01:00', '2026-08-02T00:00'], surface_pressure: [1010, 1012, 1000] },
    };
    const days = splitByDate(body as never);
    expect([...days.keys()]).toEqual(['2026-08-01', '2026-08-02']);
    expect(days.get('2026-08-02')).toEqual({ daily: { rain_sum: [4.5] }, hourly: { surface_pressure: [1000] } });
    // Control: the first day keeps its own two hours, not the second day's.
    expect(days.get('2026-08-01')!.hourly!.surface_pressure).toEqual([1010, 1012]);
  });
});
