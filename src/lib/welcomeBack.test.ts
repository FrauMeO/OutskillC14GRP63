import { describe, expect, it } from 'vitest';
import { LONG_GAP_DAYS, WELCOME_BACK_AFTER_LONG_GAP, WELCOME_BACK_LINES, welcomeBackLine } from './welcomeBack';

describe('welcomeBackLine', () => {
  it('rotates through the four approved lines as the seed changes', () => {
    const seen = [0, 1, 2, 3].map((n) => welcomeBackLine(n, 3));
    expect(new Set(seen).size).toBe(4);
    expect(seen).toEqual([...WELCOME_BACK_LINES]);
    expect(welcomeBackLine(4, 3)).toBe(welcomeBackLine(0, 3));
  });

  it('uses the plain line after a long gap', () => {
    expect(welcomeBackLine(0, LONG_GAP_DAYS)).toBe('Welcome back. Pick up wherever you like.');
    expect(welcomeBackLine(2, 90)).toBe(WELCOME_BACK_AFTER_LONG_GAP);
    expect(welcomeBackLine(0, LONG_GAP_DAYS - 1)).not.toBe(WELCOME_BACK_AFTER_LONG_GAP);
  });

  it('never counts days away, and uses no exclamation mark', () => {
    for (const line of [...WELCOME_BACK_LINES, WELCOME_BACK_AFTER_LONG_GAP]) {
      expect(line).not.toMatch(/\d/);
      expect(line).not.toMatch(/\bdays?\b/i);
      expect(line).not.toContain('!');
    }
    expect('You were away 12 days!').toMatch(/\d|!/);
  });

  it('copes with a negative, fractional or missing seed', () => {
    expect(WELCOME_BACK_LINES).toContain(welcomeBackLine(-7, 1));
    expect(WELCOME_BACK_LINES).toContain(welcomeBackLine(2.9, 1));
    expect(WELCOME_BACK_LINES).toContain(welcomeBackLine(NaN, 1));
  });
});
