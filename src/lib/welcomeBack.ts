// Approved welcome-back lines (Miah, 2026-10-13). They rotate and never count days away.
// Humour is allowed here and in p.s. lines only. Nothing in the app calls this yet.

export const WELCOME_BACK_LINES = [
  'We missed you. Welcome back.',
  "There you are. The kettle's been lonely.",
  'Good to see you again. Your pillars saved your seat.',
  'Look who it is. We kept the light on.',
] as const;

export const WELCOME_BACK_AFTER_LONG_GAP = 'Welcome back. Pick up wherever you like.';

/** A long gap is a fortnight or more. The caller passes the gap; the line never says how long it was. */
export const LONG_GAP_DAYS = 14;

/** Picks a line. `seed` is any whole number (a day number works) so the choice rotates without storing anything. */
export function welcomeBackLine(seed: number, daysAway: number): string {
  if (daysAway >= LONG_GAP_DAYS) return WELCOME_BACK_AFTER_LONG_GAP;
  const n = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return WELCOME_BACK_LINES[n % WELCOME_BACK_LINES.length];
}
