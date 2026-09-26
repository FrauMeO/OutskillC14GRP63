// Supabase Edge Function: a short AI reflection on the signed-in person's day.
// TEMPORARY, for the hackathon; see the removal note in logic.ts.
// Uses Claude through the official Anthropic SDK. Secrets, set in Supabase (never in the app or repo):
//   ANTHROPIC_API_KEY  (required)
//   ANTHROPIC_MODEL    (optional, default claude-opus-5-5)
// Nothing is stored. Only today's logged values are sent; hard days get a fixed message instead.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { FALLBACK_MESSAGE, HARD_DAY_MESSAGE, SYSTEM_PROMPT, cleanReply, describeDay, isHardDay, userMessage, type Day } from './logic.ts';

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
  try {
    date = String((await req.json())?.date ?? '');
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Bad date.' }, 400);

  // Reads with the person's own session, so Row Level Security limits it to their row.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: day, error } = await supabase.from('habit_logs').select(COLUMNS).eq('log_date', date).maybeSingle();
  if (error) return json({ error: 'Could not read your entry.' }, 500);
  if (!day) return json({ error: 'There is no entry for that day yet.' }, 404);

  if (isHardDay(day as Day)) console.log('daily-reflection: hard day, fixed message');
  if (isHardDay(day as Day)) return json({ text: HARD_DAY_MESSAGE, source: 'fixed' });
  if (describeDay(day as Day).length === 0) return json({ text: FALLBACK_MESSAGE, source: 'fixed' });

  // The secret was saved in the dashboard as Anthropic_API_Key; accept either spelling.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('Anthropic_API_Key');
  if (!apiKey) return json({ error: 'The reflection service is not set up yet.' }, 503);
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';

  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000, // a few sentences of reply plus room for thinking (always on; counts toward the limit)
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage(day as Day) }],
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
    const text = cleanReply(raw);
    if (!text) console.log('daily-reflection: reply filtered by the principles check');
    return json(text ? { text, source: 'ai', model: response.model } : { text: FALLBACK_MESSAGE, source: 'fixed', note: 'filtered' });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : 'network';
    // Logs only the error, never the person's data.
    console.error('daily-reflection: Claude call failed', status, err instanceof Error ? err.message : String(err));
    return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: `ai-unavailable-${status}` });
  }
});
