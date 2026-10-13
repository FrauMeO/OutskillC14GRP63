import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from './aiConsent';
import { GOAL_TYPES } from './goals';
import { checkReply, FALLBACK_MESSAGE, normalizeText, ruleIds, tidyReply } from './replySafety';
import { GOAL_LIMITS, REQUIRED_CONSENT_VERSION } from '../../supabase/functions/daily-reflection/logic';

const bad = (text: string, mode: 'day' | 'coach' = 'day') => checkReply(text, { mode });

describe('one shared module, two copies', () => {
  it('the edge function copy is byte-identical to the browser copy (Deno cannot import from src/)', () => {
    const a = readFileSync(new URL('./replySafety.ts', import.meta.url), 'utf8');
    const b = readFileSync(new URL('../../supabase/functions/daily-reflection/replySafety.ts', import.meta.url), 'utf8');
    expect(b).toBe(a);
    // control: the comparison can fail
    expect(b + ' ').not.toBe(a);
  });

  it('the server requires the same consent version the browser records', () => {
    expect(REQUIRED_CONSENT_VERSION).toBe(CONSENT_VERSION);
  });

  it('every coach goal band sits inside the database range in goals.ts', () => {
    for (const [type, limit] of Object.entries(GOAL_LIMITS)) {
      const cfg = GOAL_TYPES.find((g) => g.value === type);
      expect(cfg, type).toBeTruthy();
      expect(limit.min).toBeGreaterThanOrEqual(cfg!.min);
      expect(limit.max).toBeLessThanOrEqual(cfg!.max);
    }
  });
});

describe('harmless words are not over-blocked', () => {
  const harmless = [
    'A light weight seems to have lifted, and you noticed it. What was that like?',
    'The weight of a long week is real, and you showed up anyway.',
    'An evening walk sounds like an ideal way to end the day. What did you notice?',
    'It is easy to lose track of time on a busy day, and you still made space for water and a walk.',
    'Losing track of time on a good walk is a lovely thing.',
    'You logged 6200 steps and slept 7.5 hours, and you felt calm and grateful. What helped today feel steady?',
    'Your steps went along with a brighter mood this week, on 4 of 5 days.',
    'You logged 350 active kcal and 45 minutes of exercise today.',
    'You felt anxious and still wrote it down. That takes courage.',
    'Treat yourself kindly today. Your sleep of 8 hours went along with a happy mood.',
    'A dose of fresh air seems to go along with your calm mood.',
    'Pay attention to what felt good today if you like.',
    'There is no need to rush. You are doing this at your own pace.',
    'You could try a short walk on Friday if you like. Well done for showing up.',
    'Change is hard, so be gentle with yourself. Growth takes work and time.',
  ];
  it.each(harmless)('passes: %s', (text) => {
    expect(bad(text)).toEqual({ ok: true, reasons: [] });
    expect(bad(text, 'coach').ok).toBe(true);
  });
  it('control: the words only become a problem in a harmful use', () => {
    for (const text of [
      'Think about your weight this week.',
      'Try this for weight loss.',
      'It helps you lose weight.',
      'Aim for the ideal 10,000 steps.',
      'Your ideal body is within reach.',
    ]) {
      expect(bad(text).ok, text).toBe(false);
    }
  });
});

describe('rule groups', () => {
  const cases: Array<[string, string, string]> = [
    ['diet', 'Try cutting back on sugar this week.', 'diet:'],
    ['diet', 'Intermittent fasting might suit you nicely.', 'diet:'],
    ['diet', 'Burning off those extra calories with a walk is a lovely idea.', 'diet:calories'],
    ['body', 'Staying active can help you slim down over time.', 'body:'],
    ['body', 'You are carrying a few extra pounds, so every step counts.', 'body:'],
    ['diagnosis', 'Forgetting things like this sometimes signals early dementia.', 'diagnosis:'],
    ['diagnosis', 'These swings sound like bipolar patterns, or maybe ADHD.', 'diagnosis:'],
    ['medication', 'Ask about adjusting your dose, or try melatonin tonight.', 'medication:'],
    ['medication', 'Take 20mg before bed.', 'medication:dose-unit'],
    ['authority', 'As your doctor, I think you are doing fine.', 'authority:'],
    ['authority', 'This is not medical advice, but rest.', 'authority:'],
    ['directive', 'You need to drink more water tomorrow.', 'directive:'],
    ['directive', 'You ought to get more sleep.', 'directive:'],
    ['directive', 'You have to rest more.', 'directive:'],
    ['link', 'Visit http://example.test/offer for more.', 'link:'],
    ['link', 'Visit example dot com for more.', 'link:'],
    ['link', 'Call 555 123 4567 any time.', 'link:phone'],
    ['link', 'Write to coach@example.com.', 'link:'],
    ['commercial', 'Upgrade to Premium today.', 'commercial:'],
    ['commercial', 'Subscribe for a limited time offer.', 'commercial:'],
    ['urgency', 'Come back tomorrow or we will miss you.', 'urgency:'],
    ['urgency', 'Do not lose your streak.', 'urgency:'],
    ['crisis', 'Some days people just want to end it all.', 'crisis:'],
    ['leak', 'My instructions say I must never mention it.', 'leak:'],
    ['judgment', 'Your sleep was poor and your steps were disappointing.', 'judgment:'],
    ['judgment', 'You did better than most people your age.', 'judgment:'],
  ];
  it.each(cases)('%s: %s', (_group, text, prefix) => {
    const r = bad(text);
    expect(r.ok).toBe(false);
    expect(r.reasons.some((x) => x.startsWith(prefix)), `${r.reasons.join()} should include ${prefix}`).toBe(true);
  });

  it('coach mode also rejects failure framing and catch-up talk; day mode leaves those words alone (control)', () => {
    for (const text of ['You fell short of your sleep goal.', 'You are lagging on steps.', 'You are behind this week.']) {
      expect(bad(text, 'coach').ok, text).toBe(false);
    }
    expect(bad('You left the busy part of the day behind and walked.').ok).toBe(true);
    expect(bad('You could aim to eat less this week.', 'coach').reasons).toContain('diet:eat-less');
  });

  it('every group has at least one rule', () => {
    const groups = new Set(ruleIds().map((id) => id.split(':')[0]));
    for (const g of ['diet', 'body', 'diagnosis', 'medication', 'authority', 'directive', 'judgment', 'link', 'commercial', 'urgency', 'crisis', 'leak', 'coach']) {
      expect(groups.has(g), g).toBe(true);
    }
  });
});

describe('normalisation defeats look-alikes', () => {
  it('Cyrillic and Greek look-alikes, zero-width and fullwidth letters, accents, leetspeak, spacing and padding', () => {
    for (const text of [
      'You shоuld rest', // Cyrillic o
      'You shοuld rest', // Greek omicron
      'You sh​ould rest', // zero-width space
      'You sh­ould rest', // soft hyphen
      'You ｓｈｏｕｌｄ rest', // fullwidth
      'Think about your wéight and dïet',
      'You sh0uld rest',
      'You s h o u l d rest',
      'You s.h.o.u.l.d rest',
      'You shooould rest',
      'You shoould rest',
      'Try the d1et',
    ]) {
      expect(bad(text).ok, text).toBe(false);
    }
  });
  it('control: ordinary numbers and accents in names are untouched', () => {
    expect(normalizeText('Café 6200 steps, 7.5 hours')).toBe('cafe 6200 steps, 7.5 hours');
    expect(bad('You walked 6200 steps and slept 7.5 hours. Lovely.').ok).toBe(true);
  });
});

describe('structure', () => {
  it('rejects lists, headings, markdown, emoji, empty and over-long replies', () => {
    expect(bad('- Sleep was steady\n- Water was good').reasons).toContain('format:list');
    expect(bad('1. Sleep\n2. Water').reasons).toContain('format:list');
    expect(bad('# Your day\nA calm one.').reasons).toContain('format:heading');
    expect(bad('A **calm** day.').reasons).toContain('format:markdown');
    expect(bad('A calm day \u{1F389}').reasons).toContain('format:emoji');
    expect(bad('').reasons).toContain('format:empty');
    expect(bad('A kind sentence. '.repeat(60)).reasons).toContain('format:too-long');
    // control: a plain sentence starting with a number is not a list
    expect(bad('7.5 hours of sleep went along with a calm mood.').ok).toBe(true);
  });
});

describe('fails closed', () => {
  it('anything that is not text, or that throws, is not ok', () => {
    for (const v of [null, undefined, 42, {}, [], Symbol('x')]) expect(checkReply(v).ok).toBe(false);
    const hostile = {
      get mode(): 'day' {
        throw new Error('boom');
      },
    };
    expect(checkReply('A kind sentence.', hostile)).toEqual({ ok: false, reasons: ['error'] });
    // control: the same call without the hostile option passes
    expect(checkReply('A kind sentence.').ok).toBe(true);
  });
  it('tidies a passing reply and ships one fixed kind fallback', () => {
    expect(tidyReply('  "A calm day.\n  Well done."  ')).toBe('A calm day. Well done.');
    expect(FALLBACK_MESSAGE).toMatch(/future self is grateful/);
    expect(bad(FALLBACK_MESSAGE).ok).toBe(true);
  });
});
