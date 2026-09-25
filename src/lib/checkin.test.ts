import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, buildLogFields, formFromRow, hasAnyValue, parseOptionalNumber } from './checkin';

describe('parseOptionalNumber', () => {
  it('treats blank as not logged (null)', () => {
    expect(parseOptionalNumber('exercise', '')).toEqual({ value: null, error: null });
    expect(parseOptionalNumber('water', '   ')).toEqual({ value: null, error: null });
  });

  it('keeps a logged zero as 0 (control: the null rule does not swallow real zeros)', () => {
    expect(parseOptionalNumber('exercise', '0')).toEqual({ value: 0, error: null });
  });

  it('rejects out-of-range, fractional minutes and non-numbers', () => {
    expect(parseOptionalNumber('sleep', '25').error).toMatch(/between 0 and 24/);
    expect(parseOptionalNumber('exercise', '12.5').error).toMatch(/whole minutes/);
    expect(parseOptionalNumber('water', 'lots').error).toMatch(/number/);
    expect(parseOptionalNumber('water', '-1').error).toMatch(/between/);
  });

  it('accepts decimals where allowed', () => {
    expect(parseOptionalNumber('sleep', '7.25').value).toBe(7.25);
  });
});

describe('buildLogFields', () => {
  it('turns an empty form into all nulls, which counts as "no value"', () => {
    const { fields, errors } = buildLogFields(EMPTY_FORM);
    expect(errors).toEqual([]);
    expect(fields).not.toBeNull();
    expect(Object.values(fields!).every((v) => v === null)).toBe(true);
    expect(hasAnyValue(fields!)).toBe(false);
  });

  it('builds a full row and detects a value (control for the empty case)', () => {
    const { fields } = buildLogFields({
      ...EMPTY_FORM,
      exercise: '30',
      notes: '  walked  ',
      mood: 4,
      feelings: ['happy', 'stable'],
    });
    expect(fields).toMatchObject({ exercise_minutes: 30, notes: 'walked', mood: 4, feelings: ['happy', 'stable'] });
    expect(hasAnyValue(fields!)).toBe(true);
  });

  it('removes repeated feelings and ignores out-of-range ratings', () => {
    const { fields } = buildLogFields({ ...EMPTY_FORM, feelings: ['happy', 'happy'], energy: 7 });
    expect(fields!.feelings).toEqual(['happy']);
    expect(fields!.energy).toBeNull();
  });

  it('returns every problem at once and no row', () => {
    const { fields, errors } = buildLogFields({ ...EMPTY_FORM, sleep: '30', water: 'x' });
    expect(fields).toBeNull();
    expect(errors).toHaveLength(2);
  });
});

describe('formFromRow', () => {
  it('round-trips a saved row back into the form, keeping 0 as "0"', () => {
    const form = formFromRow({ exercise_minutes: 0, sleep_hours: 7.5, water_liters: null, notes: null, mood: 3, feelings: ['sad'] });
    expect(form).toMatchObject({ exercise: '0', sleep: '7.5', water: '', notes: '', mood: 3, feelings: ['sad'] });
    expect(buildLogFields(form).fields).toMatchObject({ exercise_minutes: 0, sleep_hours: 7.5, water_liters: null });
  });
});
