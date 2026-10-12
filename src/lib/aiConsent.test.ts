import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION, clearConsent, consentKey, isSnoozed, mayCallAi, parseConsent, readConsent,
  resetSessionState, snoozeAsk, writeConsent,
} from './aiConsent';

function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}
const throwing = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

beforeEach(() => resetSessionState());

describe('parseConsent', () => {
  it('reads a current yes and a current no', () => {
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION, at: 'x', granted: true }))).toBe('granted');
    expect(parseConsent(JSON.stringify({ v: CONSENT_VERSION, at: 'x', granted: false }))).toBe('declined');
  });
  it('asks again when the consent text version changed', () => {
    const old = JSON.stringify({ v: CONSENT_VERSION, at: 'x', granted: true });
    expect(parseConsent(old, CONSENT_VERSION + 1)).toBe('unset');
  });
  it('control: nothing, junk, wrong shapes and truthy non-booleans are never a yes', () => {
    for (const raw of [null, undefined, '', 'not json', 'null', '7', '"yes"', '{}', '{"v":1}',
      '{"v":1,"granted":"true"}', '{"v":1,"granted":1}', '{"granted":true}', '[]']) {
      expect(parseConsent(raw)).toBe('unset');
    }
  });
});

describe('read and write', () => {
  it('has no consent by default (nothing pre-ticked)', () => {
    expect(readConsent('u1', fakeStore())).toBe('unset');
    expect(readConsent(null, fakeStore())).toBe('unset');
  });
  it('stores per user under the documented key, with a timestamp', () => {
    const s = fakeStore();
    writeConsent('u1', true, s, new Date('2026-10-12T10:00:00Z'));
    expect(JSON.parse(s.raw.get('byp.aiConsent.u1') as string)).toEqual({ v: 1, at: '2026-10-12T10:00:00.000Z', granted: true });
    expect(readConsent('u1', s)).toBe('granted');
    expect(readConsent('u2', s)).toBe('unset'); // control: another person is unaffected
    expect(consentKey('u1')).toBe('byp.aiConsent.u1');
  });
  it('withdrawing replaces yes with no immediately', () => {
    const s = fakeStore();
    writeConsent('u1', true, s);
    writeConsent('u1', false, s);
    expect(mayCallAi(readConsent('u1', s))).toBe(false);
  });
  it('clear removes the choice', () => {
    const s = fakeStore();
    writeConsent('u1', true, s);
    clearConsent('u1', s);
    expect(readConsent('u1', s)).toBe('unset');
  });
  it('survives storage that throws, keeping the choice for this tab only', () => {
    expect(readConsent('u1', throwing)).toBe('unset');
    expect(() => writeConsent('u1', true, throwing)).not.toThrow();
    expect(readConsent('u1', throwing)).toBe('granted');
    expect(() => clearConsent('u1', throwing)).not.toThrow();
    expect(readConsent('u1', throwing)).toBe('unset');
  });
  it('an old-version record in storage means ask again', () => {
    const s = fakeStore({ 'byp.aiConsent.u1': JSON.stringify({ v: 0, at: 'x', granted: true }) });
    expect(readConsent('u1', s)).toBe('unset');
  });
});

describe('gate and snooze', () => {
  it('only an explicit granted passes the gate', () => {
    expect(mayCallAi('granted')).toBe(true);
    expect(mayCallAi('declined')).toBe(false);
    expect(mayCallAi('unset')).toBe(false);
  });
  it('"Not now" is remembered for the session only and is per person', () => {
    expect(isSnoozed('u1')).toBe(false);
    snoozeAsk('u1');
    expect(isSnoozed('u1')).toBe(true);
    expect(isSnoozed('u2')).toBe(false);
    expect(isSnoozed(null)).toBe(false);
  });
});
