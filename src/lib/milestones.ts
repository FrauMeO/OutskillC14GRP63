// Gentle feedback for showing up (Miah, 2026-09-26). Celebrates arrivals only: nothing here ever
// marks a missed day, resets, or says a run was broken. An "entry" is any saved day (a
// habit_logs row); editing an existing day is not a new entry.
import { ENCOURAGEMENTS } from './encouragement';

// ---------- Encouragement: at random, never more than once every 5 entries ----------

export const MIN_GAP = 5;
export const MAX_GAP = 8;

function seedFrom(text: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The entry numbers that bring an encouragement for this person: a fixed random sequence with gaps
// of 5 to 8 entries, the same on every device and never closer than 5 apart.
export function encouragementEntries(userId: string, upTo: number): number[] {
  const next = rng(seedFrom(userId));
  const out: number[] = [];
  let at = 0;
  for (;;) {
    at += MIN_GAP + Math.floor(next() * (MAX_GAP - MIN_GAP + 1));
    if (at > upTo) return out;
    out.push(at);
  }
}

export function isEncouragementEntry(userId: string, entryNumber: number): boolean {
  return entryNumber > 0 && encouragementEntries(userId, entryNumber).includes(entryNumber);
}

// Which line to show on that entry: random per person and entry, stable if the page reloads.
export function encouragementLine(userId: string, entryNumber: number): string {
  const r = rng(seedFrom(`${userId}:${entryNumber}`))();
  return ENCOURAGEMENTS[Math.floor(r * ENCOURAGEMENTS.length)];
}

// ---------- Every 14th entry: a small celebration ----------

export const CELEBRATE_EVERY = 14;

export function isCelebrationEntry(entryNumber: number): boolean {
  return entryNumber > 0 && entryNumber % CELEBRATE_EVERY === 0;
}

export function celebrationText(entryNumber: number): string {
  return `${entryNumber} days of showing up for yourself.`;
}

// ---------- Every 5th completed day: a mark on the calendar ----------

export const MARK_EVERY = 5;

// Each logged date's place in the person's history (1st, 2nd, ...), in date order. Days do not
// need to be sequential.
export function dayNumbers(dates: string[]): Map<string, number> {
  return new Map([...new Set(dates)].sort().map((d, i) => [d, i + 1]));
}

export function isMarkedDay(dayNumber: number | undefined): boolean {
  return dayNumber !== undefined && dayNumber % MARK_EVERY === 0;
}
