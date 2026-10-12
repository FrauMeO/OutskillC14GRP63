// Sign-up rules (Miah, 2026-10-12): one name that cannot be traced to a person, and only the
// month and year of birth (never a day). Free from age 60. Pure so it can be tested without a browser.

export type Plan = 'free_60_plus' | 'standard';

export const MIN_AGE = 16;
export const FREE_AGE = 60;
export const NAME_MAX = 40;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type NameResult = { ok: true; name: string } | { ok: false; message: string };

export function validateDisplayName(raw: string): NameResult {
  const name = raw.trim();
  if (!name) return { ok: false, message: 'Please tell us what to call you.' };
  if (/\s/.test(name)) return { ok: false, message: 'Please use just one name, like Sam. It does not need to be your real name.' };
  if (name.length > NAME_MAX) return { ok: false, message: `Please use ${NAME_MAX} letters or fewer.` };
  return { ok: true, name };
}

export type BirthResult =
  | { ok: true; month: number; year: number; age: number; plan: Plan }
  | { ok: false; message: string };

// Whole years completed by the start of the birth month this year; month-and-year only, so this is
// an estimate by up to a month. We count a person as 60 from the start of their 60th birth month.
export function ageFrom(month: number, year: number, today: Date): number {
  const thisMonth = today.getMonth() + 1;
  return today.getFullYear() - year - (thisMonth < month ? 1 : 0);
}

export function planForAge(age: number): Plan {
  return age >= FREE_AGE ? 'free_60_plus' : 'standard';
}

export function validateBirth(month: number | null, year: number | null, today: Date): BirthResult {
  if (month === null || year === null || !Number.isInteger(month) || !Number.isInteger(year)) {
    return { ok: false, message: 'Please choose your birth month and year. We never ask for the day.' };
  }
  if (month < 1 || month > 12) return { ok: false, message: 'Please choose a birth month.' };
  const thisYear = today.getFullYear();
  if (year < thisYear - 120 || year > thisYear) return { ok: false, message: 'Please choose your birth year.' };
  const age = ageFrom(month, year, today);
  if (age < MIN_AGE) return { ok: false, message: `Build Your Pillars is for people ${MIN_AGE} and older.` };
  return { ok: true, month, year, age, plan: planForAge(age) };
}

// Newest first would put 2010 above 1950; people over 60 scroll less when the older years come first
// is not true either, so list from youngest allowed down to 110 years ago.
export function birthYearOptions(today: Date): number[] {
  const newest = today.getFullYear() - MIN_AGE;
  const years: number[] = [];
  for (let y = newest; y >= today.getFullYear() - 110; y--) years.push(y);
  return years;
}
