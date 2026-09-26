// Supabase Edge Function: a short AI reflection on the signed-in person's day.
// TEMPORARY, for the hackathon; see the removal note in logic.ts.
// Uses OpenAI (hackathon requirement). Secrets, set in Supabase (never in the app or the repo):
//   OPENAI_API_KEY  (required)
//   OPENAI_MODEL    (optional, default gpt-4o-mini)
// Nothing is stored. Only today's logged values are sent; hard days get a fixed message instead.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { FALLBACK_MESSAGE, HARD_DAY_MESSAGE, buildMessages, cleanReply, describeDay, isHardDay, type Day } from './logic.ts';

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

  if (isHardDay(day as Day)) return json({ text: HARD_DAY_MESSAGE, source: 'fixed' });
  if (describeDay(day as Day).length === 0) return json({ text: FALLBACK_MESSAGE, source: 'fixed' });

  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'The reflection service is not set up yet.' }, 503);
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: buildMessages(day as Day), max_tokens: 200, temperature: 0.7 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: `ai-unavailable-${res.status}` });
    const body = await res.json();
    const text = cleanReply(body?.choices?.[0]?.message?.content);
    return json(text ? { text, source: 'ai', model } : { text: FALLBACK_MESSAGE, source: 'fixed', note: 'filtered' });
  } catch {
    return json({ text: FALLBACK_MESSAGE, source: 'fixed', note: 'ai-timeout' });
  }
});
