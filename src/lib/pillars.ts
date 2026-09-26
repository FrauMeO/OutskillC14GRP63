// The four pillars: the names people see. Chosen by Miah on 2026-09-26: Eat, Sleep, Move, Balance
// (docs/development-log.md, sections 13 and 14). The database and code keep plain, descriptive
// keys (nutrition, sleep, exercise, wellbeing), so renaming or translating a pillar is a change to
// this file only. How each pillar's measures map to Apple Health and Google is in healthMapping.ts.
import type { Category } from './dashboard';

export type Pillar = {
  key: Category;
  name: string;
  subtitle: string; // shown under the name, so each pillar is clear at a glance
  color: string; // CSS colour token
};

export const PILLARS: Record<Category, Pillar> = {
  nutrition: { key: 'nutrition', name: 'Eat', subtitle: 'Food and water', color: 'var(--color-sprout)' },
  sleep: { key: 'sleep', name: 'Sleep', subtitle: 'Sleep and rest', color: 'var(--color-dusk)' },
  exercise: { key: 'exercise', name: 'Move', subtitle: 'Movement, your way', color: 'var(--color-ember)' },
  wellbeing: { key: 'wellbeing', name: 'Balance', subtitle: 'Stress, mood and how you feel', color: 'var(--color-bloom)' },
};

// Display order everywhere: Eat, Sleep, Move, Balance.
export const PILLAR_ORDER: Category[] = ['nutrition', 'sleep', 'exercise', 'wellbeing'];

// Miah, 2026-09-26 (her final wording): the tagline, then a lighter p.s. line beneath it.
export const PILLAR_TAGLINE = 'Build your pillars of health. Live Well.';
export const PILLAR_PS = 'p.s. judge yourself a lot less';
