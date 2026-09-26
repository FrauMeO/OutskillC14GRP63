// Gentle encouragement shown around the app: after saving a day, under the streak, and on
// reflection results. The voice of the whole product (CLAUDE.md, Product principles): kind,
// patient, never judging, never comparing. The first three lines are Miah's own words
// (2026-09-26); the rest follow them. Never shown in place of crisis resources.

export const ENCOURAGEMENTS = [
  'Change is hard. Be gentle with yourself.',
  'Growth takes work and time, and can be painful at times, but you are worth it.',
  'Your future self is grateful for the self-care you are putting in today.',
  'Noticing how you feel is already a kind act toward yourself.',
  'There is no perfect day to aim for. There is only your day, and it counts.',
  'Rest is part of the work, not a break from it.',
  'Small, steady steps still move you forward.',
  'You are more than any number on this page.',
] as const;

// One line per calendar day, so it stays the same all day and changes tomorrow.
export function encouragementFor(isoDate: string, offset = 0): string {
  const n = isoDate.split('-').reduce((sum, part) => sum + Number(part), 0);
  return ENCOURAGEMENTS[(n + offset) % ENCOURAGEMENTS.length];
}
