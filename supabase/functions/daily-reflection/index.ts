// Supabase Edge Function: a short AI reflection on the signed-in person's day.
// TEMPORARY, for the hackathon; see the removal note in logic.ts.
// Uses Claude through the official Anthropic SDK. Secrets, set in Supabase (never in the app or repo):
//   ANTHROPIC_API_KEY  (required)
//   ANTHROPIC_MODEL    (optional, default claude-opus-5-5)
//   ANTHROPIC_WORKSPACE_ID (optional; defaults to the project workspace)
// Nothing is stored. Only logged values are sent (never notes or location); hard days and hard
// weeks get a fixed message instead. mode "week" is the gentle weekly coach, with the person's goals.
//
// Order of checks (docs/ai-safety-plan.md, section 4): 1 login, 2 consent on record for this wording
// AND under the hourly limit (one database call, ai_consume_call, migration 0019; 403 or 429 with the
// fixed message when not), 3 load the person's own rows (Row Level Security), 4 hard day or hard week
// gets a fixed caring message with a crisis pointer, 5 implausible numbers or unsafe goals get the fixed
// message with no model call, 6 the model, 7 the reply checker (replySafety.ts). Every failure at every
// step ends in a fixed kind message; nothing here can show an error screen to a person in a hard moment.
// Deploy only AFTER migration 0019 is applied: until then step 2 cannot run and the function fails closed.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  COACH_PROMPT,
  FALLBACK_MESSAGE,
  REQUIRED_CONSENT_VERSION,
  HARD_DAY_MESSAGE,
  HARD_WEEK_MESSAGE,
  SYSTEM_PROMPT,
  addDaysIso,
  checkDayInputs,
  checkGoalInputs,
  checkReply,
  describeDay,
  isHardDay,
  isHardWeek,
  tidyReply,
  userMessage,
  weekMessage,
  type Day,
  type Goal,
} from './logic.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const COLUMNS =
  'log_date, exercise_minutes, steps, stand_hours, active_calories, sleep_hours, time_in_bed_hours, awake_minutes, water_liters, calories_consumed, mood, energy, stress, feelings';

// A fixed message with a reason code (a code, never content). `status` defaults to 200.
const fixed = (text: string, reason: string, status = 200) => json({ text, source: 'fixed', reason }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    return await handle(req);
  } catch (err) {
    // Fail closed: any surprise ends in the fixed kind message. Logs the error only, never the person's data.
    console.error('daily-reflection: unexpected error', err instanceof Error ? err.message : String(err));
    return fixed(FALLBACK_MESSAGE, 'error');
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Please log in.' }, 401);

  let date = '';
  let mode = 'day';
  try {
    const body = await req.json();
    date = String(body?.date ?? '');
    mode = body?.mode === 'week' ? 'week' : 'day';
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Bad date.' }, 400);

  // Reads with the person's own session, so Row Level Security limits it to their row.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });

  // Step 2: consent on record for this wording, and under 20 calls in the last hour. One round trip, and
  // it uses the person's own login, so no service key is needed. If the check cannot run (for example the
  // migration is not applied), nothing is sent to the model.
  const { data: gate, error: gateError } = await supabase.rpc('ai_consume_call', { p_version: REQUIRED_CONSENT_VERSION });
  if (gateError) {
    console.error('daily-reflection: consent check failed', gateError.code ?? 'unknown');
    return gateError.code === '28000' ? json({ error: 'Please log in.' }, 401) : fixed(FALLBACK_MESSAGE, 'unavailable', 503);
  }
  if (gate === 'no_consent') {
    console.log('daily-reflection: refused, no consent on record');
    return fixed(FALLBACK_MESSAGE, 'no-consent', 403);
  }
  if (gate === 'rate_limited') {
    console.log('daily-reflection: refused, rate limit');
    return fixed(FALLBACK_MESSAGE, 'rate-limited', 429);
  }
  if (gate !== 'ok') return fixed(FALLBACK_MESSAGE, 'unavailable', 503);

  // Weekly coach: the last seven days (ending on `date`) and the person's own goals.
  if (mode === 'week') {
    const [logs, goals] = await Promise.all([
      supabase.from('habit_logs').select(COLUMNS).gte('log_date', addDaysIso(date, -6)).lte('log_date', date),
      supabase.from('goals').select('goal_type, target_value'),
    ]);
    if (logs.error || goals.error) return json({ error: 'Could not read your week.' }, 500);
    const days = (logs.data ?? []) as Day[];
    if (!days.some((d) => describeDay(d).length)) return json({ error: 'There are no entries this week yet.' }, 404);
    if (isHardWeek(days)) {
      console.log('daily-reflection: hard week, fixed message');
      return fixed(HARD_WEEK_MESSAGE, 'hard-week');
    }
    const goalList = (goals.data ?? []) as Goal[];
    const bad = [...days.flatMap((d) => checkDayInputs(d).reasons), ...checkGoalInputs(goalList).reasons];
    if (bad.length) {
      console.log('daily-reflection: implausible input, fixed message,', [...new Set(bad)].join(' '));
      return fixed(FALLBACK_MESSAGE, 'implausible-input');
    }
    return askClaude(COACH_PROMPT, weekMessage(days, goalList), 'coach');
  }

  const { data: day, error } = await supabase.from('habit_logs').select(COLUMNS).eq('log_date', date).maybeSingle();
  if (error) return json({ error: 'Could not read your entry.' }, 500);
  if (!day) return json({ error: 'There is no entry for that day yet.' }, 404);

  if (isHardDay(day as Day)) {
    console.log('daily-reflection: hard day, fixed message');
    return fixed(HARD_DAY_MESSAGE, 'hard-day');
  }
  const inputs = checkDayInputs(day as Day);
  if (!inputs.ok) {
    console.log('daily-reflection: implausible input, fixed message,', inputs.reasons.join(' '));
    return fixed(FALLBACK_MESSAGE, 'implausible-input');
  }
  if (describeDay(day as Day).length === 0) return fixed(FALLBACK_MESSAGE, 'nothing-to-describe');
  return askClaude(SYSTEM_PROMPT, userMessage(day as Day), 'day');
}

// One call to Claude, shared by the daily reflection and the weekly coach. Replies that break the
// principles, refusals and errors all fall back to a fixed, kind message.
async function askClaude(system: string, content: string, mode: 'day' | 'coach'): Promise<Response> {
  // The secret was saved in the dashboard as Anthropic_API_Key; accept either spelling.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('Anthropic_API_Key');
  if (!apiKey) return json({ error: 'The reflection service is not set up yet.' }, 503);
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';

  // The key is not scoped to a workspace, so each request names one (an ID, not a secret).
  const workspace = Deno.env.get('ANTHROPIC_WORKSPACE_ID') ?? 'wrkspc_01BCPNrrVJvGvupRdSrw17kG';
  const client = new Anthropic({
    apiKey,
    timeout: 25_000,
    maxRetries: 1,
    defaultHeaders: { 'anthropic-workspace-id': workspace },
  });
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000, // a few sentences of reply plus room for thinking (always on; counts toward the limit)
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low' }, // short, simple writing task; keeps thinking brief and replies fast
      // Server-side fallback: if the model declines, the API re-runs the request on a suitable model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

    console.log('daily-reflection: reply from', response.model, 'stop', response.stop_reason);
    if (response.stop_reason === 'refusal') return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: 'declined', reason: 'declined' });
    const raw = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ');
    // Fail closed: checkReply never throws, and anything it does not clearly pass is replaced.
    const check = checkReply(raw, { mode });
    if (!check.ok) console.log('daily-reflection: reply filtered by the principles check,', check.reasons.join(' '));
    return json(check.ok ? { text: tidyReply(raw), source: 'ai', model: response.model } : { text: FALLBACK_MESSAGE, source: 'fixed', note: 'filtered', reason: 'filtered' });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : 'network';
    // Logs only the error, never the person's data.
    console.error('daily-reflection: Claude call failed', status, err instanceof Error ? err.message : String(err));
    return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: `ai-unavailable-${status}`, reason: 'ai-unavailable' });
  }
}
