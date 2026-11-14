// Browser side of health-topic sources: asks the edge function (supabase/functions/health-topic-sources)
// for short, sourced explanations of a pillar topic. The server checks the topic, holds the Tavily key
// and keeps only sources from its public-health list. This sends the pillar key and the topic, nothing
// else: no entries, check-ins, notes or ids. No screen uses it yet (Miah decides where it goes).
import { supabase } from './supabase';
import type { Category } from './dashboard';

export type HealthSource = { title: string; url: string; snippet: string; source_domain: string };

export type HealthSourcesResult =
  | { ok: true; topic: string; sources: HealthSource[] }
  | { ok: false; message: string };

export const SOURCES_FALLBACK = 'Sources are not available right now. Please try again in a moment.';

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

// Checks the reply again (defence in depth): only well-formed https sources are kept.
export function parseSourcesResponse(data: unknown): { topic: string; sources: HealthSource[] } | null {
  const d = data as { topic?: unknown; sources?: unknown } | null;
  if (!d || typeof d.topic !== 'string' || !Array.isArray(d.sources)) return null;
  const sources: HealthSource[] = [];
  for (const s of d.sources.slice(0, 5)) {
    const { title, url, snippet, source_domain } = (s ?? {}) as Record<string, unknown>;
    if (isText(title, 200) && isHttpsUrl(url) && isText(snippet, 400) && isText(source_domain, 100)) {
      sources.push({ title, url, snippet, source_domain });
    }
  }
  return { topic: d.topic, sources };
}

async function messageFrom(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (typeof body?.error === 'string') return body.error;
    }
  } catch { /* use the fallback */ }
  return SOURCES_FALLBACK;
}

export async function fetchHealthTopicSources(pillar: Category, topic: string): Promise<HealthSourcesResult> {
  const { data, error } = await supabase.functions.invoke('health-topic-sources', { body: { pillar, topic } });
  if (error) return { ok: false, message: await messageFrom(error) };
  const parsed = parseSourcesResponse(data);
  return parsed ? { ok: true, ...parsed } : { ok: false, message: SOURCES_FALLBACK };
}
