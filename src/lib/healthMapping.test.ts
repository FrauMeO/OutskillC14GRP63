import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORY_FIELDS } from './dashboard';
import { FEELINGS } from './checkin';
import { MAPPINGS, valenceToMood } from './healthMapping';
import { PILLARS, PILLAR_ORDER } from './pillars';

describe('pillars', () => {
  it('are Eat, Sleep, Move, Balance, in that order, each with a subtitle', () => {
    expect(PILLAR_ORDER.map((k) => PILLARS[k].name)).toEqual(['Eat', 'Sleep', 'Move', 'Balance']);
    expect(PILLARS.nutrition.subtitle).toMatch(/water/i);
  });
});

describe('health mapping', () => {
  it('maps every dashboard measure exactly once, under its pillar', () => {
    for (const [pillar, fields] of Object.entries(CATEGORY_FIELDS)) {
      for (const f of fields) {
        const hits = MAPPINGS.filter((m) => m.column === f);
        expect(hits, f).toHaveLength(1);
        expect(hits[0].pillar, f).toBe(pillar);
      }
    }
    // Control: a column that does not exist is not mapped.
    expect(MAPPINGS.filter((m) => m.column === 'weight_kg')).toHaveLength(0);
  });

  it('uses the same Apple types the importer reads (control: a made-up type is absent)', () => {
    const importer = readFileSync(new URL('../../scripts/import-apple-health.mjs', import.meta.url), 'utf8');
    const appleTypes = new Set(MAPPINGS.flatMap((m) => (m.apple && m.apple.type.startsWith('HK') && m.apple.type !== 'HKStateOfMind' ? [m.apple.type] : [])));
    for (const t of appleTypes) expect(importer, t).toContain(t);
    expect(importer).not.toContain('HKQuantityTypeIdentifierBodyMass');
  });

  it('every feeling maps to a real Apple State of Mind label, and no two share one', () => {
    // The 38 HKStateOfMind.Label cases (iOS 18 SDK header).
    const APPLE = ['amazed', 'amused', 'angry', 'anxious', 'ashamed', 'brave', 'calm', 'content', 'disappointed',
      'discouraged', 'disgusted', 'embarrassed', 'excited', 'frustrated', 'grateful', 'guilty', 'happy', 'hopeless',
      'irritated', 'jealous', 'joyful', 'lonely', 'passionate', 'peaceful', 'proud', 'relieved', 'sad', 'scared',
      'stressed', 'surprised', 'worried', 'annoyed', 'confident', 'drained', 'hopeful', 'indifferent', 'overwhelmed', 'satisfied'];
    expect(APPLE).toHaveLength(38);
    const labels = FEELINGS.map((f) => f.apple as string);
    for (const l of labels) expect(APPLE, l).toContain(l);
    expect(new Set(labels).size).toBe(labels.length);
    expect(MAPPINGS.find((m) => m.column === 'feelings')!.apple!.values).toEqual(labels);
    // Control: a word Apple does not have is caught.
    expect(APPLE).not.toContain('meh');
  });

  it('has 13 feelings: 6 pleasant, 2 neutral, 5 unpleasant', () => {
    const count = (t: string) => FEELINGS.filter((f) => f.tone === t).length;
    expect([FEELINGS.length, count('pleasant'), count('neutral'), count('unpleasant')]).toEqual([13, 6, 2, 5]);
  });

  it('marks app-only measures honestly: energy and stress exist nowhere else', () => {
    for (const col of ['energy', 'stress']) {
      const m = MAPPINGS.find((x) => x.column === col)!;
      expect([m.apple, m.healthConnect, m.googleHealthApi]).toEqual([null, null, null]);
    }
    expect(MAPPINGS.find((m) => m.column === 'mood')!.healthConnect).toBeNull();
  });
});

describe('valenceToMood', () => {
  it('splits -1 to 1 into five equal bands', () => {
    expect([-1, -0.61, -0.59, -0.21, 0, 0.19, 0.21, 0.59, 0.61, 1].map(valenceToMood)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(valenceToMood(5)).toBe(5); // out of range is clamped
    expect(valenceToMood(-5)).toBe(1);
  });
});
