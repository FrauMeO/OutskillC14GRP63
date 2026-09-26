import { describe, expect, it } from 'vitest';
import { aqiLabel, pollenLabel, weatherParts } from './todayWeather';

describe("today's weather in words", () => {
  it('describes a dry day from the database row (numbers arrive as strings)', () => {
    expect(
      weatherParts({ temp_min_c: '14.8', temp_max_c: '27.5', rain_mm: '0', precipitation_mm: '0', daylight_hours: '12.01', us_aqi_max: 76, pollen_max: null, moon_phase: 'Full moon' }),
    ).toEqual(['15–28°C', 'dry', '12 hours of daylight', 'air quality 76 (moderate)', 'full moon']);
  });

  it('says rainy, a little rain, or snow (control: snow wins over rain)', () => {
    expect(weatherParts({ rain_mm: '10.7', precipitation_mm: '10.7' })).toEqual(['rainy (11 mm)']);
    expect(weatherParts({ rain_mm: '0.8', precipitation_mm: '0.8' })).toEqual(['a little rain']);
    expect(weatherParts({ rain_mm: '5', snowfall_cm: '2', precipitation_mm: '7' })).toEqual(['snow (2.0 cm)']);
  });

  it('shows pollen only where it exists, and leaves out anything missing (control: empty row)', () => {
    expect(weatherParts({ pollen_max: '0.3' })).toEqual(['pollen low']);
    expect(weatherParts({})).toEqual([]);
    expect(weatherParts(null)).toEqual([]);
  });

  it('uses the standard air-quality bands', () => {
    expect([36, 76, 149, 180, 250, 400].map(aqiLabel)).toEqual([
      'good', 'moderate', 'unhealthy for sensitive groups', 'unhealthy', 'very unhealthy', 'hazardous',
    ]);
    expect([5, 20, 80].map(pollenLabel)).toEqual(['low', 'moderate', 'high']);
  });
});
