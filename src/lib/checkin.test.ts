import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, FEELINGS, RATING_SCALES, buildLogFields, formFromRow, hasAnyValue, isDirty, parseOptionalNumber } from './checkin';

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
      feelings: ['calm', 'grateful'],
    });
    expect(fields).toMatchObject({ exercise_minutes: 30, notes: 'walked', mood: 4, feelings: ['calm', 'grateful'] });
    expect(hasAnyValue(fields!)).toBe(true);
  });

  it('removes repeated feelings and ignores out-of-range ratings', () => {
    const { fields } = buildLogFields({ ...EMPTY_FORM, feelings: ['grateful', 'grateful'], energy: 7 });
    expect(fields!.feelings).toEqual(['grateful']);
    expect(fields!.energy).toBeNull();
  });

  it('returns every problem at once and no row', () => {
    const { fields, errors } = buildLogFields({ ...EMPTY_FORM, sleep: '30', water: 'x' });
    expect(fields).toBeNull();
    expect(errors).toHaveLength(2);
  });
});

describe('labels', () => {
  it('no feeling word repeats a rating level word', () => {
    const levelWords = new Set(RATING_SCALES.flatMap((s) => s.levels.map((l) => l.toLowerCase())));
    const clashes = FEELINGS.filter((f) => levelWords.has(f.label.toLowerCase()));
    expect(clashes).toEqual([]);
    // Control: the check does catch a clash when one exists.
    expect(levelWords.has('happy')).toBe(true);
  });
});

describe('formFromRow', () => {
  it('round-trips a saved row back into the form, keeping 0 as "0"', () => {
    const form = formFromRow({ exercise_minutes: 0, sleep_hours: 7.5, water_liters: null, notes: null, mood: 3, feelings: ['overwhelmed', 'joyful'] });
    // 'joyful' is not an allowed feeling, so it is dropped rather than shown.
    expect(form).toMatchObject({ exercise: '0', sleep: '7.5', water: '', notes: '', mood: 3, feelings: ['overwhelmed'] });
    expect(buildLogFields(form).fields).toMatchObject({ exercise_minutes: 0, sleep_hours: 7.5, water_liters: null });
  });
});

describe('unsaved changes', () => {
  const loaded = formFromRow({ mood: 4, energy: 3, stress: 2, sleep_hours: 7, feelings: ['calm', 'grateful'] });

  it('notices a changed rating, number, feeling or note', () => {
    expect(isDirty({ ...loaded, mood: 2 }, loaded)).toBe(true);
    expect(isDirty({ ...loaded, stress: null }, loaded)).toBe(true);
    expect(isDirty({ ...loaded, sleep: '6.5' }, loaded)).toBe(true);
    expect(isDirty({ ...loaded, feelings: ['calm'] }, loaded)).toBe(true);
    expect(isDirty({ ...loaded, notes: 'walked' }, loaded)).toBe(true);
    expect(isDirty({ ...EMPTY_FORM, energy: 3 }, { ...EMPTY_FORM })).toBe(true);
  });

  it('control: an untouched form, reordered feelings or extra spaces are not changes', () => {
    expect(isDirty(loaded, loaded)).toBe(false);
    expect(isDirty({ ...loaded, feelings: ['grateful', 'calm'] }, loaded)).toBe(false);
    expect(isDirty({ ...loaded, sleep: ' 7 ' }, loaded)).toBe(false);
    expect(isDirty({ ...EMPTY_FORM }, { ...EMPTY_FORM })).toBe(false);
  });
});
