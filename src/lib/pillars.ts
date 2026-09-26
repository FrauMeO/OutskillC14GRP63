// The four pillars: the names people see. Chosen by Miah on 2026-09-26 (docs/development-log.md,
// section 13). The database and code keep plain, descriptive keys (exercise, sleep, nutrition,
// wellbeing), so renaming or translating a pillar is a change to this file only.
import type { Category } from './dashboard';

export type Pillar = {
  key: Category;
  name: string;
  about: string; // one line for headings, help text and translators
  color: string; // CSS colour token
};

export const PILLARS: Record<Category, Pillar> = {
  sleep: { key: 'sleep', name: 'Sleep Well', about: 'Sleep and rest', color: 'var(--color-dusk)' },
  exercise: { key: 'exercise', name: 'Move More', about: 'Movement, in whatever way suits you', color: 'var(--color-ember)' },
  nutrition: { key: 'nutrition', name: 'Eat Real', about: 'Food and water, clear and credible', color: 'var(--color-sprout)' },
  wellbeing: { key: 'wellbeing', name: 'Steady On', about: 'Stress, resilience and how you feel', color: 'var(--color-bloom)' },
};

// Display order used on the sign-in page and the dashboard.
export const PILLAR_ORDER: Category[] = ['sleep', 'exercise', 'nutrition', 'wellbeing'];

export const PILLAR_TAGLINE = 'Four gentle pillars for noticing how you live, without judging yourself.';
