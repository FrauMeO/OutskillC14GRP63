import { describe, expect, it } from 'vitest';
import { FEELINGS } from '../../../src/lib/checkin';
import { SYSTEM_PROMPT, cleanReply, describeDay, isHardDay, userMessage } from './logic';

const day = { log_date: '2026-09-26', sleep_hours: '7.5', steps: 6200, water_liters: '2', mood: 4, energy: 3, stress: 2, feelings: ['calm', 'grateful'] };

describe('what is sent', () => {
  it('describes only logged values, grouped by pillar, with no identity or location', () => {
    const lines = describeDay(day);
    expect(lines).toEqual([
      'Eat: drank 2 liters of water',
      'Sleep: slept 7.5 hours',
      'Move: 6200 steps',
      'Balance: mood happy',
      'Balance: energy moderate',
      'Balance: stress low',
      'Balance: felt calm, grateful',
    ]);
    const sent = SYSTEM_PROMPT + userMessage({ ...day, location_name: 'Philadelphia', email: 'x@y.z' } as never);
    expect(sent).not.toMatch(/Philadelphia|@/);
  });

  it('knows every feeling in the app (control: an unknown one is dropped)', () => {
    for (const f of FEELINGS) expect(describeDay({ log_date: 'd', feelings: [f.value] })).toEqual([`Balance: felt ${f.value}`]);
    expect(describeDay({ log_date: 'd', feelings: ['joyful'] })).toEqual([]);
  });

  it('carries the principles into the instructions', () => {
    expect(SYSTEM_PROMPT).toMatch(/never judge/i);
    expect(SYSTEM_PROMPT).toMatch(/never give medical advice/i);
    expect(SYSTEM_PROMPT).toMatch(/weight/i);
  });
});

describe('hard days never go to AI', () => {
  it('catches very sad mood, low mood with high stress, and low mood with overwhelmed or lonely', () => {
    expect(isHardDay({ log_date: 'd', mood: 1 })).toBe(true);
    expect(isHardDay({ log_date: 'd', mood: 2, stress: 4 })).toBe(true);
    expect(isHardDay({ log_date: 'd', mood: 2, feelings: ['lonely'] })).toBe(true);
  });
  it('control: an ordinary or mixed day is not a hard day', () => {
    expect(isHardDay({ log_date: 'd', mood: 2, stress: 3 })).toBe(false);
    expect(isHardDay({ log_date: 'd', mood: 4, stress: 5 })).toBe(false);
    expect(isHardDay(day)).toBe(false);
  });
});

describe('reply filter', () => {
  it('keeps a kind reply and tidies it', () => {
    expect(cleanReply('  "A calm day with good rest and a steady walk. What helped you feel grateful today?" ')).toBe(
      'A calm day with good rest and a steady walk. What helped you feel grateful today?',
    );
  });
  it('rejects judging, diagnosing or diet talk (control: the kind reply above passes)', () => {
    for (const bad of ['You should drink more water.', 'This could be depression.', 'Great for weight loss!', 'That was a bad day.', 'Aim for the ideal 10,000 steps.']) {
      expect(cleanReply(bad), bad).toBeNull();
    }
    expect(cleanReply('')).toBeNull();
    expect(cleanReply('x'.repeat(701))).toBeNull();
  });
});
