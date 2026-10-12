import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, validateWaitlist, WAITLIST_PRIVACY } from './waitlist';

describe('validateWaitlist', () => {
  it('trims and lowercases a good address', () => {
    expect(validateWaitlist({ email: '  Pat@Example.COM ', ios: true, android: false, consent: true })).toEqual({
      ok: true,
      email: 'pat@example.com',
      ios: true,
      android: false,
    });
  });
  it('accepts either store or both', () => {
    expect(validateWaitlist({ email: 'a@b.co', ios: false, android: true, consent: true }).ok).toBe(true);
    expect(validateWaitlist({ email: 'a@b.co', ios: true, android: true, consent: true }).ok).toBe(true);
  });
  it('requires a store, with the exact wording', () => {
    const r = validateWaitlist({ email: 'a@b.co', ios: false, android: false, consent: true });
    expect(r).toEqual({ ok: false, field: 'stores', message: 'Choose the App Store, Google Play, or both' });
  });
  it('rejects bad addresses', () => {
    for (const email of ['', 'nope', 'a@b', 'a@@b.co', 'a@b@c.co', '@b.co', 'a@.co', 'a@b.', 'a b@c.co']) {
      expect(validateWaitlist({ email, ios: true, android: false, consent: true }).ok, email).toBe(false);
    }
  });
  it('enforces the 254 limit', () => {
    const tail = '@example.com';
    expect(validateWaitlist({ email: 'a'.repeat(254 - tail.length) + tail, ios: true, android: false, consent: true }).ok).toBe(true);
    expect(validateWaitlist({ email: 'a'.repeat(255 - tail.length) + tail, ios: true, android: false, consent: true }).ok).toBe(false);
  });
  it('control: a clearly valid input must NOT be rejected (guards against an over-strict validator)', () => {
    expect(validateWaitlist({ email: 'ok@example.com', ios: true, android: true, consent: true }).ok).toBe(true);
    expect(validateWaitlist({ email: 'bad', ios: true, android: true, consent: true }).ok).toBe(false);
  });
});

describe('waitlist privacy line', () => {
  it('tells people how to be removed', () => {
    expect(WAITLIST_PRIVACY).toContain(CONTACT_EMAIL);
    expect('We keep only your email address.').not.toContain(CONTACT_EMAIL);
  });
});

describe('waitlist consent', () => {
  it('refuses without the tick, and accepts with it', () => {
    const base = { email: 'pat@example.com', ios: true, android: false };
    expect(validateWaitlist({ ...base, consent: false })).toMatchObject({ ok: false, field: 'consent' });
    expect(validateWaitlist({ ...base, consent: true })).toMatchObject({ ok: true });
  });
});
