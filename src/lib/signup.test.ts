import { describe, expect, it } from 'vitest';
import { ageFrom, birthYearOptions, planForAge, validateBirth, validateDisplayName } from './signup';

const TODAY = new Date(2026, 9, 12); // 12 October 2026, local

describe('validateDisplayName', () => {
  it('accepts one name and trims it', () => {
    expect(validateDisplayName('  Sam ')).toEqual({ ok: true, name: 'Sam' });
  });
  it('refuses empty, two names and very long names', () => {
    expect(validateDisplayName('   ')).toMatchObject({ ok: false });
    expect(validateDisplayName('Sam Jones')).toMatchObject({ ok: false });
    expect(validateDisplayName('a'.repeat(41))).toMatchObject({ ok: false });
    expect(validateDisplayName('a'.repeat(40))).toMatchObject({ ok: true });
  });
});

describe('validateBirth', () => {
  it('is free at 60 and standard at 59, by month and year only', () => {
    expect(validateBirth(10, 1966, TODAY)).toMatchObject({ ok: true, age: 60, plan: 'free_60_plus' });
    expect(validateBirth(11, 1966, TODAY)).toMatchObject({ ok: true, age: 59, plan: 'standard' });
    expect(validateBirth(1, 1950, TODAY)).toMatchObject({ ok: true, plan: 'free_60_plus' });
  });
  it('refuses under 18, missing, impossible and future values', () => {
    // Boundary by month and year: 18 years 0 months is in, 17 years 11 months is out.
    expect(validateBirth(10, 2008, TODAY)).toMatchObject({ ok: true, age: 18 });
    expect(validateBirth(11, 2008, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(1, 2008, TODAY)).toMatchObject({ ok: true, age: 18 });
    // Controls: the old limit of 16 is now refused, and so is 17.
    expect(validateBirth(10, 2010, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(1, 2009, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(null, 1960, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(5, null, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(13, 1960, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(5, 2027, TODAY)).toMatchObject({ ok: false });
    expect(validateBirth(5, 1890, TODAY)).toMatchObject({ ok: false });
  });
  it('control: the plan really changes with age', () => {
    expect(planForAge(59)).not.toBe(planForAge(60));
    expect(ageFrom(12, 1966, TODAY)).toBe(59);
  });
});

describe('birthYearOptions', () => {
  it('runs from the youngest allowed year down 110 years', () => {
    const years = birthYearOptions(TODAY);
    expect(years[0]).toBe(2008); // this year minus 18
    expect(years.at(-1)).toBe(1916);
    expect(years).not.toContain(2009); // control: someone aged 17 is not offered
  });
});
