// Daily AI reflection: TEMPORARY, for the hackathon (Miah, 2026-09-26). Remove after judging:
// delete supabase/functions/daily-reflection, src/features/aiReflection, the VITE_AI_REFLECTION
// setting, the two lines that render it in src/pages/Dashboard.tsx, the "Daily reflection" section
// in src/pages/Settings.tsx, and (with a new migration) the profiles.auto_reflection column (0009).
//
// Pure logic, shared by the Edge Function and the unit tests (no Deno or browser APIs here).
// Rules come from CLAUDE.md, Product principles: reflect, don't judge; association, not cause;
// personal, not comparative; never diagnosis; crisis situations never go to AI.

import { FALLBACK_MESSAGE, checkReply, tidyReply, type ReplyCheck } from './replySafety.ts';

// The reply checker lives in replySafety.ts (a byte-identical copy of src/lib/replySafety.ts, guarded
// by a test), so the browser and this function apply exactly the same rules.
export { FALLBACK_MESSAGE, checkReply, tidyReply };
export type { ReplyCheck };

// The consent text version the server requires. Must equal CONSENT_VERSION in src/lib/aiConsent.ts
// (a test in src/lib/replySafety.test.ts checks). The per-user rate limit (20 calls an hour) lives in
// the database function ai_consume_call (migration 0019), so it cannot be bypassed from here.
export const REQUIRED_CONSENT_VERSION = 1;

export type Day = {
  log_date: string;
  exercise_minutes?: number | string | null;
  steps?: number | string | null;
  stand_hours?: number | string | null;
  active_calories?: number | string | null;
  sleep_hours?: number | string | null;
  time_in_bed_hours?: number | string | null;
  awake_minutes?: number | string | null;
  water_liters?: number | string | null;
  calories_consumed?: number | string | null;
  mood?: number | null;
  energy?: number | null;
  stress?: number | null;
  feelings?: string[] | null;
};

const LEVELS = {
  mood: ['very sad', 'sad', 'okay', 'happy', 'very happy'],
  energy: ['very low', 'low', 'moderate', 'high', 'very high'],
  stress: ['very low', 'low', 'moderate', 'high', 'very high'],
} as const;

const FEELING_WORDS: Record<string, string> = {
  calm: 'calm', peaceful: 'peaceful', confident: 'confident', grateful: 'grateful', hopeful: 'hopeful',
  proud: 'proud', steady: 'steady', meh: 'meh', frustrated: 'frustrated', overwhelmed: 'overwhelmed',
  anxious: 'anxious', lonely: 'lonely', tired: 'tired',
};

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// ---------- Input sanity ----------
// Implausible numbers never reach the model: describeDay drops them, and checkDayInputs tells the
// function to skip the model altogether and show the fixed message.
type Limit = { min: number; max: number; minExclusive?: boolean; maxExclusive?: boolean };
type NumericKey =
  | 'exercise_minutes' | 'steps' | 'stand_hours' | 'active_calories' | 'sleep_hours'
  | 'time_in_bed_hours' | 'awake_minutes' | 'water_liters' | 'calories_consumed';

// POLICY: Miah to confirm these bands. They are deliberately tighter than the database checks.
export const DAY_LIMITS: Record<NumericKey, Limit> = {
  exercise_minutes: { min: 0, max: 720 },
  steps: { min: 0, max: 100000 },
  stand_hours: { min: 0, max: 24 },
  active_calories: { min: 0, max: 10000 },
  sleep_hours: { min: 0, max: 24, minExclusive: true, maxExclusive: true }, // 0 and 24 hours are not a night's sleep
  time_in_bed_hours: { min: 0, max: 24, minExclusive: true, maxExclusive: true },
  awake_minutes: { min: 0, max: 1440 },
  water_liters: { min: 0, max: 8 },
  // POLICY: Miah to confirm. Calories eaten are never sent to the model. A day logged under 500 kcal
  // (or over 10000) gets the fixed message instead, because very low intake should not be met with
  // cheerful AI text. A part-day log under 500 therefore also gets the fixed message.
  calories_consumed: { min: 500, max: 10000 },
};
const NUMERIC_KEYS = Object.keys(DAY_LIMITS) as NumericKey[];

const within = (v: number, l: Limit) =>
  (l.minExclusive ? v > l.min : v >= l.min) && (l.maxExclusive ? v < l.max : v <= l.max);

function validNumber(key: NumericKey, raw: unknown): number | null {
  const v = n(raw);
  return v !== null && within(v, DAY_LIMITS[key]) ? v : null;
}

const MAX_FEELINGS = 20;
const MAX_FEELING_LENGTH = 40;
const safeDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== v ? null : v;
};

export type InputCheck = { ok: boolean; reasons: string[] };

// Is this day safe to describe to the model? Any implausible value means "no": the caller shows the
// fixed message and does not call the model.
export function checkDayInputs(d: Day): InputCheck {
  const reasons: string[] = [];
  if (!d || typeof d !== 'object') return { ok: false, reasons: ['not-a-day'] };
  if (safeDate(d.log_date) === null) reasons.push('bad-date');
  for (const key of NUMERIC_KEYS) {
    const raw = d[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const v = n(raw);
    if (v === null) reasons.push(`not-a-number:${key}`);
    else if (!within(v, DAY_LIMITS[key])) reasons.push(`out-of-range:${key}`);
  }
  for (const key of ['mood', 'energy', 'stress'] as const) {
    const raw = d[key];
    if (raw === null || raw === undefined) continue;
    const v = n(raw);
    if (v === null || !Number.isInteger(v) || v < 1 || v > 5) reasons.push(`rating:${key}`);
  }
  const f = d.feelings;
  if (f !== null && f !== undefined) {
    if (!Array.isArray(f) || f.length > MAX_FEELINGS || f.some((x) => typeof x !== 'string' || x.length > MAX_FEELING_LENGTH)) {
      reasons.push('feelings');
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------- Hard days ----------
// A hard day never goes to AI: the person sees a fixed, approved message instead.
// Thresholds are named so Miah can change them in one place. Rules marked POLICY are the
// conservative reading of the three gaps in docs/ai-safety-plan.md (section 2); the original three
// rules are unchanged.
export const MOOD_ALWAYS_HARD = 1; // mood at or below this: always hard (original rule)
export const LOW_MOOD_MAX = 2; // "low mood" means mood at or below this (original rule)
export const STRESS_HARD_WITH_LOW_MOOD = 4; // low mood and stress at or above this (original rule)
// POLICY: Miah to confirm. Gap 1: stress at the top of the scale together with "overwhelmed" or
// "lonely" is a hard day at ANY mood (including no mood logged).
export const STRESS_HARD_WITH_OVERWHELMED = 5;
// POLICY: Miah to confirm. Gap 2: low mood together with "anxious" is a hard day.
export const ANXIOUS_COUNTS_WITH_LOW_MOOD = true;
// POLICY: Miah to confirm. Very low energy and very little sleep, with low mood, is a hard day.
export const LOW_ENERGY_MAX = 1;
export const VERY_LITTLE_SLEEP_HOURS = 3; // at or below
// POLICY: Miah to confirm. Gap 3: this many logged days of low mood in the week make a hard week,
// even when no single day was hard.
export const LOW_MOOD_DAYS_FOR_HARD_WEEK = 3;

const feelingsOf = (d: Day): string[] => (Array.isArray(d.feelings) ? d.feelings.filter((f): f is string => typeof f === 'string') : []);

export function isHardDay(d: Day): boolean {
  const mood = n(d.mood);
  const stress = n(d.stress);
  const energy = n(d.energy);
  const sleep = n(d.sleep_hours);
  const feelings = feelingsOf(d);
  const lowMood = mood !== null && mood <= LOW_MOOD_MAX;
  const distressed = feelings.some((f) => f === 'overwhelmed' || f === 'lonely');
  if (mood !== null && mood <= MOOD_ALWAYS_HARD) return true;
  if (lowMood && stress !== null && stress >= STRESS_HARD_WITH_LOW_MOOD) return true;
  if (lowMood && distressed) return true;
  // POLICY: Miah to confirm (the rules below)
  if (stress !== null && stress >= STRESS_HARD_WITH_OVERWHELMED && distressed) return true;
  if (ANXIOUS_COUNTS_WITH_LOW_MOOD && lowMood && feelings.includes('anxious')) return true;
  if (lowMood && energy !== null && energy <= LOW_ENERGY_MAX && sleep !== null && sleep <= VERY_LITTLE_SLEEP_HOURS) return true;
  return false;
}

// A short, direct pointer to crisis help. The app adds the person's country lines under it
// (src/lib/reflection.ts resourcesFor); findahelpline.com is the fallback for every country.
export const CRISIS_POINTER =
  'If you ever feel unsafe, or think about hurting yourself, please contact a crisis line or your local emergency number now. Free, confidential help in your country is listed at findahelpline.com.';

export const HARD_DAY_MESSAGE = `It sounds like today was a hard one. Thank you for logging it anyway; that is an act of care. Change is hard, so be gentle with yourself. If you'd like, talking with someone you trust can help, and the Reflect page has a few quiet questions whenever you want them. ${CRISIS_POINTER}`;

// Only what the person logged today, in plain words. No name, email, location or reflection answers.
export function describeDay(d: Day): string[] {
  const lines: string[] = [];
  const add = (pillar: string, text: string) => lines.push(`${pillar}: ${text}`);
  // Calories eaten are never sent (eating-disorder risk; docs/ai-safety-plan.md, section 2).
  const water = validNumber('water_liters', d.water_liters);
  if (water !== null) add('Drink', `drank ${water} liters of water`);
  const sleep = validNumber('sleep_hours', d.sleep_hours);
  const bed = validNumber('time_in_bed_hours', d.time_in_bed_hours);
  const awake = validNumber('awake_minutes', d.awake_minutes);
  if (sleep !== null) add('Sleep', `slept ${sleep} hours`);
  if (bed !== null) add('Sleep', `${bed} hours in bed`);
  if (awake !== null) add('Sleep', `${awake} minutes awake in bed`);
  const ex = validNumber('exercise_minutes', d.exercise_minutes);
  const steps = validNumber('steps', d.steps);
  const stand = validNumber('stand_hours', d.stand_hours);
  const active = validNumber('active_calories', d.active_calories);
  if (ex !== null) add('Move', `${ex} minutes of exercise`);
  if (steps !== null) add('Move', `${steps} steps`);
  if (stand !== null) add('Move', `stood during ${stand} hours`);
  if (active !== null) add('Move', `${active} active kcal`);
  for (const key of ['mood', 'energy', 'stress'] as const) {
    const v = n(d[key]);
    if (v !== null && Number.isInteger(v) && v >= 1 && v <= 5) add('Balance', `${key} ${LEVELS[key][v - 1]}`);
  }
  // Only words on the allowlist, looked up as own properties (never the prototype chain).
  const feelings = feelingsOf(d)
    .slice(0, MAX_FEELINGS)
    .map((f) => (Object.hasOwn(FEELING_WORDS, f) ? FEELING_WORDS[f] : undefined))
    .filter((w): w is string => !!w);
  if (feelings.length) add('Balance', `felt ${feelings.join(', ')}`);
  return lines;
}

export const SYSTEM_PROMPT = `You write a short daily reflection for "Build Your Pillars", a gentle self-tracking app with four pillars: Drink, Sleep, Move and Balance. Its purpose is to help people notice their own day with kindness, as a counter to social-media ideals of health, wellness and beauty. Its motto: "Build your pillars of health. Live Well. p.s. judge yourself a lot less."

Write 2 to 4 short sentences, under 80 words, in plain, warm English that translates well.
- Notice what the person logged today and reflect it back with curiosity and kindness.
- Celebrate showing up and effort, never outcomes or targets.
- Never judge, grade or say "should". Never compare with other people, averages, norms or ideals.
- Never mention weight, body shape, appearance, dieting, or calories as something to cut.
- Never give medical advice, diagnose, or name any condition.
- Do not comment on pillars that were not logged, and do not invent numbers.
- You may describe what went together today ("a good night's sleep and a calm mood"), never what caused what.
- End with one gentle encouragement or a small, curious question.
- No emojis, no lists, no headings.`;

// The user turn sent to Claude (the system prompt goes in the separate `system` field).
export function userMessage(d: Day): string {
  return `Today (${safeDate(d.log_date) ?? 'date not shown'}), the person logged:\n${describeDay(d).map((l) => `- ${l}`).join('\n')}`;
}

// Replies that break the principles are replaced with the fallback message. The rules live in
// replySafety.ts (rule groups, Unicode normalisation, fail closed); this is the thin wrapper.
export function cleanReply(raw: string | null | undefined, maxLength = 700): string | null {
  if (!raw) return null;
  try {
    return checkReply(raw, { mode: 'day', maxLength }).ok ? tidyReply(raw) : null;
  } catch {
    return null; // fail closed
  }
}

// ---------- Weekly coach (Michael's idea, reworked with Miah, 2026-09-26) ----------
// A coach, not a judge: the person's own goals are welcome, but a goal not reached is
// information, never failure. Same safeguards as the daily reflection.

export type Goal = { goal_type: string; target_value: number | string | null };

// Goals sent to the coach, in plain words. Calories-eaten goals are never sent: the coach
// never talks about eating less.
const GOAL_WORDS: Record<string, { label: string; unit: string }> = {
  exercise: { label: 'exercise', unit: 'minutes a day' },
  steps: { label: 'steps', unit: 'steps a day' },
  stand_hours: { label: 'standing', unit: 'hours a day' },
  active_calories: { label: 'active calories', unit: 'kcal a day' },
  sleep: { label: 'sleep', unit: 'hours a night' },
  water: { label: 'water', unit: 'liters a day' },
};

// POLICY: Miah to confirm. Sensible bands for a goal the coach may talk about. Tighter than the
// database (src/lib/goals.ts); a goal outside its band is not sent, and the coach is not used.
export const GOAL_LIMITS: Record<string, Limit> = {
  exercise: { min: 1, max: 300 },
  steps: { min: 100, max: 40000 },
  stand_hours: { min: 1, max: 16 },
  active_calories: { min: 10, max: 3000 },
  sleep: { min: 4, max: 12 },
  water: { min: 0.5, max: 5 },
};
// POLICY: Miah to confirm. A calories-eaten goal under this, or any weight-loss-like goal, is unsafe:
// the coach is not used and the person sees the fixed message.
export const CALORIE_GOAL_FLOOR = 1200;
const WEIGHT_GOAL_RE = /weight|fat|bmi|slim|lean|lose|shed|burn|diet|thin|waist/i;
const MAX_GOALS = 20;
const MAX_GOAL_TYPE_LENGTH = 40;

export function describeGoals(goals: Goal[]): string[] {
  if (!Array.isArray(goals)) return [];
  return goals.slice(0, MAX_GOALS).flatMap((g) => {
    if (!g || typeof g.goal_type !== 'string' || g.goal_type.length > MAX_GOAL_TYPE_LENGTH) return [];
    if (!Object.hasOwn(GOAL_WORDS, g.goal_type)) return [];
    const v = n(g.target_value);
    if (v === null || !within(v, GOAL_LIMITS[g.goal_type])) return [];
    const w = GOAL_WORDS[g.goal_type];
    return [`${w.label}: ${v} ${w.unit}`];
  });
}

// Is every goal safe to describe? Any unsafe or implausible goal means no coach call.
export function checkGoalInputs(goals: Goal[]): InputCheck {
  const reasons: string[] = [];
  if (!Array.isArray(goals) || goals.length > MAX_GOALS) return { ok: false, reasons: ['goals'] };
  for (const g of goals) {
    if (!g || typeof g.goal_type !== 'string' || g.goal_type.length > MAX_GOAL_TYPE_LENGTH) {
      reasons.push('goal-type');
      continue;
    }
    const v = n(g.target_value);
    if (g.goal_type === 'calories_consumed') {
      if (v !== null && v < CALORIE_GOAL_FLOOR) reasons.push('calorie-goal-low');
      continue; // never sent, whatever the value
    }
    if (WEIGHT_GOAL_RE.test(g.goal_type)) reasons.push('weight-goal');
    else if (!Object.hasOwn(GOAL_WORDS, g.goal_type)) reasons.push('unknown-goal');
    else if (g.target_value !== null && g.target_value !== undefined && g.target_value !== '' && (v === null || !within(v, GOAL_LIMITS[g.goal_type]))) {
      reasons.push(`goal-out-of-range:${g.goal_type}`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// A hard week never goes to AI: the most recent logged day was hard, two or more days were, or
// (POLICY: Miah to confirm) the week had LOW_MOOD_DAYS_FOR_HARD_WEEK or more days of low mood.
export function isHardWeek(days: Day[]): boolean {
  if (!Array.isArray(days) || !days.length) return false;
  const sorted = [...days].sort((a, b) => String(a.log_date).localeCompare(String(b.log_date)));
  if (isHardDay(sorted[sorted.length - 1]) || sorted.filter(isHardDay).length >= 2) return true;
  const lowMoodDays = sorted.filter((d) => {
    const m = n(d.mood);
    return m !== null && m >= 1 && m <= LOW_MOOD_MAX;
  }).length;
  return lowMoodDays >= LOW_MOOD_DAYS_FOR_HARD_WEEK;
}

export const HARD_WEEK_MESSAGE =
  `This week sounds like it has asked a lot of you. Thank you for logging through it; that takes care. Goals can wait while you look after yourself, so be gentle with yourself. If you'd like, talking with someone you trust can help, and the Reflect page has a few quiet questions whenever you want them. ${CRISIS_POINTER}`;

export const COACH_PROMPT = `You are a gentle, encouraging coach in "Build Your Pillars", a self-tracking app with four pillars: Drink, Sleep, Move and Balance. Its motto: "Build your pillars of health. Live Well. p.s. judge yourself a lot less." You are a coach, never a judge.

Write 3 to 5 short sentences, under 110 words, in plain, warm English that translates well.
- Start with what the person did this week: notice showing up and effort, using their own numbers.
- Name one strength from the week.
- The goals are the person's own. If a goal was not reached, treat it as information, not failure: weeks vary and change is hard. Notice any progress toward it. Never use words like failed, missed, fell short, behind or only.
- Offer one small, doable next step toward a goal they chose, as an invitation ("you could try", "if you like"), never "should" or "must".
- Compare only with their own goals and their own days, never with other people, averages, norms or ideals.
- Never mention weight, body shape, appearance, dieting, or calories as something to cut. Never give medical advice, diagnose, or name any condition.
- You may describe what went together ("on nights with more sleep, your mood was higher"), never what caused what.
- Do not invent numbers, and do not comment on pillars that were not logged.
- End on encouragement. No emojis, no lists, no headings.`;

export function weekMessage(days: Day[], goals: Goal[]): string {
  const sorted = [...days].sort((a, b) => a.log_date.localeCompare(b.log_date));
  const dayBlocks = sorted
    .map((d) => {
      const lines = describeDay(d);
      return lines.length ? `${d.log_date}:\n${lines.map((l) => `- ${l}`).join('\n')}` : null;
    })
    .filter(Boolean)
    .join('\n');
  const goalLines = describeGoals(goals);
  const goalText = goalLines.length ? goalLines.map((g) => `- ${g}`).join('\n') : '- none set';
  return `The person's last ${sorted.length} logged days:\n${dayBlocks}\n\nGoals the person set for themselves:\n${goalText}`;
}

// The coach may name goals, but never frames them as a failure (the "coach" rule group).
export function cleanCoachReply(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return checkReply(raw, { mode: 'coach', maxLength: 900 }).ok ? tidyReply(raw) : null;
  } catch {
    return null; // fail closed
  }
}

// Local calendar arithmetic on YYYY-MM-DD (noon avoids daylight-saving edges).
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
