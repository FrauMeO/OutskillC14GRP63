// CI gate for the AI safety cases (docs/ai-safety-plan.md, section 4.1). Runs tests-safety/cases.json
// through the real checks and fails the build when:
//   - fewer cases pass than baseline.json records (passCount), or
//   - a case outside baseline.json's knownFailures fails (a regression), or
//   - cases were deleted to make the numbers look better (total below baseline.json's total).
// Raise passCount in baseline.json when you fix more cases. Never lower it to hide a regression.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs helper shared with the report script
import { runCase } from './run-case.mjs';

type Case = { id: string; kind: string; category: string; expect: unknown; input: unknown; why?: string; repeat?: number };
const here = (f: string) => new URL(f, import.meta.url);
const { cases } = JSON.parse(readFileSync(here('./cases.json'), 'utf8')) as { cases: Case[] };
const baseline = JSON.parse(readFileSync(here('./baseline.json'), 'utf8')) as {
  knownFailures: Array<string | { id: string; reason: string }>;
  passCount: number;
  total: number;
};
const known = new Set(baseline.knownFailures.map((k) => (typeof k === 'string' ? k : k.id)));

const results = cases.map((c) => ({ c, ...(runCase(c) as { ok: boolean; got: string; want: string }) }));
const passes = results.filter((r) => r.ok).length;

describe('AI safety cases', () => {
  it('has not lost any cases', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length); // ids are unique
    expect(cases.length).toBeGreaterThanOrEqual(baseline.total);
  });

  it('passes at least as many cases as the baseline', () => {
    const failing = results.filter((r) => !r.ok).map((r) => `${r.c.id}: got ${r.got}, want ${r.want}`);
    expect(passes, `failing:\n${failing.join('\n')}`).toBeGreaterThanOrEqual(baseline.passCount);
  });

  it('no case fails unless baseline.json lists it with a reason', () => {
    const regressions = results.filter((r) => !r.ok && !known.has(r.c.id)).map((r) => `${r.c.id}: got ${r.got}, want ${r.want}`);
    expect(regressions).toEqual([]);
  });

  it('every known failure still fails, so the list never goes stale', () => {
    const stale = [...known].filter((id) => results.find((r) => r.c.id === id)?.ok);
    expect(stale, `now passing: remove from baseline.json and raise passCount`).toEqual([]);
  });

  it('control: the gate can fail (a wrong expectation is caught)', () => {
    const wrong = runCase({ id: 'X', kind: 'reply', category: 'control', input: 'You should drink water.', expect: { reply: 'pass' } });
    expect(wrong.ok).toBe(false);
  });
});
