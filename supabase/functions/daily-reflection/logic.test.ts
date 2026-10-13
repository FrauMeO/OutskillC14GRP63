import { describe, expect, it } from 'vitest';
import { FEELINGS } from '../../../src/lib/checkin';
import { COACH_PROMPT, SYSTEM_PROMPT, addDaysIso, cleanCoachReply, cleanReply, describeDay, isHardDay, isHardWeek, userMessage, weekMessage } from './logic';

const day = { log_date: '2026-09-26', sleep_hours: '7.5', steps: 6200, water_liters: '2', mood: 4, energy: 3, stress: 2, feelings: ['calm', 'grateful'] };

describe('what is sent', () => {
  it('describes only logged values, grouped by pillar, with no identity or location', () => {
    const lines = describeDay(day);
    expect(lines).toEqual([
      'Drink: drank 2 liters of water',
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

describe('weekly coach', () => {
  const week = [
    { log_date: '2026-09-20', steps: 6000, sleep_hours: 7, mood: 4 },
    { log_date: '2026-09-22', steps: 7500, sleep_hours: 6.5, mood: 3, feelings: ['tired'] },
    { log_date: '2026-09-26', steps: 5200, water_liters: 2, mood: 4, energy: 3 },
  ];
  const goals = [
    { goal_type: 'steps', target_value: 8000 },
    { goal_type: 'sleep', target_value: '8' },
    { goal_type: 'calories_consumed', target_value: 1800 },
  ];

  it('sends the days and the person’s own goals, but never a calories-eaten goal (control)', () => {
    const msg = weekMessage(week, goals);
    expect(msg).toContain('2026-09-22:\n- Sleep: slept 6.5 hours');
    expect(msg).toContain('- steps: 8000 steps a day');
    expect(msg).toContain('- sleep: 8 hours a night');
    expect(msg).not.toMatch(/1800|calories eaten/);
    expect(weekMessage(week, [])).toContain('- none set');
  });

  it('coaches without judging', () => {
    expect(COACH_PROMPT).toMatch(/coach, never a judge/);
    expect(COACH_PROMPT).toMatch(/information, not failure/);
    expect(COACH_PROMPT).toMatch(/never "should" or "must"/);
  });

  it('keeps hard weeks away from AI: a hard latest day, or two hard days (control: one early hard day is not)', () => {
    expect(isHardWeek([...week, { log_date: '2026-09-27', mood: 1 }])).toBe(true);
    expect(isHardWeek([...week, { log_date: '2026-09-18', mood: 1 }, { log_date: '2026-09-19', mood: 2, stress: 5 }])).toBe(true);
    expect(isHardWeek([{ log_date: '2026-09-18', mood: 1 }, ...week])).toBe(false);
    expect(isHardWeek([])).toBe(false);
  });

  it('filters failure framing, and lets a kind coaching reply through (control)', () => {
    const kind =
      'You logged three days this week and kept moving, with 7500 steps on Tuesday. Your steps are building toward the 8000 you chose. If you like, you could try a short walk after lunch this week.';
    expect(cleanCoachReply(kind)).toBe(kind);
    for (const bad of ['You missed your step goal twice.', 'You fell short on sleep.', 'You are behind on steps.', 'You should walk more.']) {
      expect(cleanCoachReply(bad), bad).toBeNull();
    }
  });

  it('counts back seven days on the calendar', () => {
    expect(addDaysIso('2026-09-26', -6)).toBe('2026-09-20');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });
});
