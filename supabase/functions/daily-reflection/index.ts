// Supabase Edge Function: a short AI reflection on the signed-in person's day.
// TEMPORARY, for the hackathon; see the removal note in logic.ts.
// Uses Claude through the official Anthropic SDK. Secrets, set in Supabase (never in the app or repo):
//   ANTHROPIC_API_KEY  (required)
//   ANTHROPIC_MODEL    (optional, default claude-opus-5-5)
//   ANTHROPIC_WORKSPACE_ID (optional; defaults to the project workspace)
// Nothing is stored. Only logged values are sent (never notes or location); hard days and hard
// weeks get a fixed message instead. mode "week" is the gentle weekly coach, with the person's goals.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  COACH_PROMPT,
  FALLBACK_MESSAGE,
  HARD_DAY_MESSAGE,
  HARD_WEEK_MESSAGE,
  SYSTEM_PROMPT,
  addDaysIso,
  cleanCoachReply,
  cleanReply,
  describeDay,
  isHardDay,
  isHardWeek,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
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
      return json({ text: HARD_WEEK_MESSAGE, source: 'fixed' });
    }
    return askClaude(COACH_PROMPT, weekMessage(days, (goals.data ?? []) as Goal[]), cleanCoachReply);
  }

  const { data: day, error } = await supabase.from('habit_logs').select(COLUMNS).eq('log_date', date).maybeSingle();
  if (error) return json({ error: 'Could not read your entry.' }, 500);
  if (!day) return json({ error: 'There is no entry for that day yet.' }, 404);

  if (isHardDay(day as Day)) {
    console.log('daily-reflection: hard day, fixed message');
    return json({ text: HARD_DAY_MESSAGE, source: 'fixed' });
  }
  if (describeDay(day as Day).length === 0) return json({ text: FALLBACK_MESSAGE, source: 'fixed' });
  return askClaude(SYSTEM_PROMPT, userMessage(day as Day), (raw) => cleanReply(raw));
});

// One call to Claude, shared by the daily reflection and the weekly coach. Replies that break the
// principles, refusals and errors all fall back to a fixed, kind message.
async function askClaude(system: string, content: string, clean: (raw: string) => string | null): Promise<Response> {
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
    if (response.stop_reason === 'refusal') return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: 'declined' });
    const raw = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ');
    const text = clean(raw);
    if (!text) console.log('daily-reflection: reply filtered by the principles check');
    return json(text ? { text, source: 'ai', model: response.model } : { text: FALLBACK_MESSAGE, source: 'fixed', note: 'filtered' });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : 'network';
    // Logs only the error, never the person's data.
    console.error('daily-reflection: Claude call failed', status, err instanceof Error ? err.message : String(err));
    return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: `ai-unavailable-${status}` });
  }
}
