// Daily AI reflection: TEMPORARY, for the hackathon (Miah, 2026-09-26). Remove after judging:
// delete supabase/functions/daily-reflection, src/features/aiReflection, the VITE_AI_REFLECTION
// setting, and the two lines that render it in src/pages/Dashboard.tsx.
//
// Pure logic, shared by the Edge Function and the unit tests (no Deno or browser APIs here).
// Rules come from CLAUDE.md, Product principles: reflect, don't judge; association, not cause;
// personal, not comparative; never diagnosis; crisis situations never go to AI.

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
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

// A hard day never goes to AI: the person sees a fixed, approved message instead.
export function isHardDay(d: Day): boolean {
  const mood = n(d.mood);
  const stress = n(d.stress);
  const feelings = d.feelings ?? [];
  if (mood === 1) return true;
  if (mood !== null && mood <= 2 && stress !== null && stress >= 4) return true;
  if (mood !== null && mood <= 2 && feelings.some((f) => f === 'overwhelmed' || f === 'lonely')) return true;
  return false;
}

export const HARD_DAY_MESSAGE =
  "It sounds like today was a hard one. Thank you for logging it anyway; that is an act of care. Change is hard, so be gentle with yourself. If you'd like, talking with someone you trust can help, and the Reflect page has a few quiet questions whenever you want them.";

export const FALLBACK_MESSAGE =
  'Thank you for logging today. Every entry is a small act of care for yourself, and your future self is grateful for it.';

// Only what the person logged today, in plain words. No name, email, location or reflection answers.
export function describeDay(d: Day): string[] {
  const lines: string[] = [];
  const add = (pillar: string, text: string) => lines.push(`${pillar}: ${text}`);
  const water = n(d.water_liters), eaten = n(d.calories_consumed);
  if (water !== null) add('Eat', `drank ${water} liters of water`);
  if (eaten !== null) add('Eat', `logged ${eaten} kcal eaten`);
  const sleep = n(d.sleep_hours), bed = n(d.time_in_bed_hours), awake = n(d.awake_minutes);
  if (sleep !== null) add('Sleep', `slept ${sleep} hours`);
  if (bed !== null) add('Sleep', `${bed} hours in bed`);
  if (awake !== null) add('Sleep', `${awake} minutes awake in bed`);
  const ex = n(d.exercise_minutes), steps = n(d.steps), stand = n(d.stand_hours), active = n(d.active_calories);
  if (ex !== null) add('Move', `${ex} minutes of exercise`);
  if (steps !== null) add('Move', `${steps} steps`);
  if (stand !== null) add('Move', `stood during ${stand} hours`);
  if (active !== null) add('Move', `${active} active kcal`);
  for (const key of ['mood', 'energy', 'stress'] as const) {
    const v = n(d[key]);
    if (v !== null && v >= 1 && v <= 5) add('Balance', `${key} ${LEVELS[key][v - 1]}`);
  }
  const feelings = (d.feelings ?? []).map((f) => FEELING_WORDS[f]).filter(Boolean);
  if (feelings.length) add('Balance', `felt ${feelings.join(', ')}`);
  return lines;
}

export const SYSTEM_PROMPT = `You write a short daily reflection for "Build Your Pillars", a gentle self-tracking app with four pillars: Eat, Sleep, Move and Balance. Its purpose is to help people notice their own day with kindness, as a counter to social-media ideals of health, wellness and beauty. Its motto: "Build your pillars of health. Live Well. p.s. judge yourself a lot less."

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
  return `Today (${d.log_date}), the person logged:\n${describeDay(d).map((l) => `- ${l}`).join('\n')}`;
}

// Replies that break the principles are replaced with the fallback message.
const BLOCKED = /\b(diagnos\w*|disorder|depress\w*|anxiety disorder|bmi|weight|lose|losing|diet\w*|deficit|should|must|lazy|fail\w*|bad day|good day|normal range|recommended amount|ideal)\b/i;

export function cleanReply(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 700) return null;
  if (BLOCKED.test(text)) return null;
  return text;
}
