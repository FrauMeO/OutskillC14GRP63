import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PILLAR_ORDER } from './pillars';
import { PILLAR_CONTEXT } from '../../supabase/functions/health-topic-sources/logic';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const { SOURCES_FALLBACK, fetchHealthTopicSources, parseSourcesResponse } = await import('./healthTopicSources');

const SOURCE = { title: 'Caffeine and sleep', url: 'https://www.cdc.gov/sleep/caffeine.html', snippet: 'Caffeine can stay in the body.', source_domain: 'cdc.gov' };

beforeEach(() => invoke.mockReset());

describe('pillar keys stay in step with the edge function', () => {
  it('the function knows exactly the app pillars', () => {
    expect(Object.keys(PILLAR_CONTEXT).sort()).toEqual([...PILLAR_ORDER].sort());
  });
});

describe('parseSourcesResponse', () => {
  it('keeps well-formed https sources (control) and drops the rest', () => {
    const out = parseSourcesResponse({
      topic: 'caffeine',
      sources: [SOURCE, { ...SOURCE, url: 'javascript:alert(1)' }, { ...SOURCE, url: 'http://www.cdc.gov' }, { ...SOURCE, title: '' }, null],
    });
    expect(out).toEqual({ topic: 'caffeine', sources: [SOURCE] });
  });
  it('returns null for a reply of the wrong shape', () => {
    for (const bad of [null, 'x', {}, { topic: 'x' }, { sources: [] }]) expect(parseSourcesResponse(bad)).toBeNull();
  });
});

describe('fetchHealthTopicSources', () => {
  it('sends only the pillar and the topic', async () => {
    invoke.mockResolvedValue({ data: { pillar: 'sleep', topic: 'caffeine', sources: [SOURCE] }, error: null });
    expect(await fetchHealthTopicSources('sleep', 'caffeine')).toEqual({ ok: true, topic: 'caffeine', sources: [SOURCE] });
    expect(invoke).toHaveBeenCalledWith('health-topic-sources', { body: { pillar: 'sleep', topic: 'caffeine' } });
  });
  it("shows the server's plain message, or the fallback", async () => {
    const context = new Response(JSON.stringify({ error: 'Please type a general topic, without details about yourself.' }), { status: 400 });
    invoke.mockResolvedValueOnce({ data: null, error: { context } });
    expect(await fetchHealthTopicSources('wellbeing', 'my day')).toEqual({ ok: false, message: 'Please type a general topic, without details about yourself.' });
    invoke.mockResolvedValueOnce({ data: null, error: new Error('network') });
    expect(await fetchHealthTopicSources('sleep', 'caffeine')).toEqual({ ok: false, message: SOURCES_FALLBACK });
    invoke.mockResolvedValueOnce({ data: '<html>', error: null });
    expect(await fetchHealthTopicSources('sleep', 'caffeine')).toEqual({ ok: false, message: SOURCES_FALLBACK });
  });
});
