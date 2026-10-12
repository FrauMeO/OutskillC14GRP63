import { describe, expect, it } from 'vitest';
import {
  WAITLIST_TOKEN_TTL_MS,
  derivedLinkToken,
  generateToken,
  hashEmail,
  hashToken,
  normalizeEmail,
  safeEqual,
  tokenUsable,
} from './tokens';
import { signWebhook, verifyWebhook } from './webhookSignature';

describe('tokens', () => {
  it('makes 32 random bytes (43 url-safe characters) and never repeats', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('refuses a token that is too short to be safe', () => {
    expect(() => generateToken(8)).toThrow();
  });

  it('hashes to 64 hex characters, deterministically, and not to the token itself', async () => {
    const t = 'abc';
    const h = await hashToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashToken(t)).toBe(h);
    expect(h).not.toContain(t);
    // known SHA-256("abc"): the SQL side (encode(sha256(convert_to(t,'utf8')),'hex')) must agree
    expect(h).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('control: a different token gives a different hash', async () => {
    expect(await hashToken('abc')).not.toBe(await hashToken('abd'));
  });

  it('hashes addresses case-insensitively with a key, and a different key gives a different hash', async () => {
    const h1 = await hashEmail(' Anna@Example.com ', 'k1');
    expect(h1).toBe(await hashEmail('anna@example.com', 'k1'));
    expect(h1).not.toBe(await hashEmail('anna@example.com', 'k2'));
    expect(h1).not.toBe(await hashEmail('ben@example.com', 'k1'));
    expect(h1).not.toContain('anna');
    await expect(hashEmail('a@b.co', '')).rejects.toThrow();
    expect(normalizeEmail(' A@B.CO ')).toBe('a@b.co');
  });

  it('derives stable link tokens that differ by purpose and by share', async () => {
    const a = await derivedLinkToken('s', 'owner-mute', 'share-1');
    expect(a).toBe(await derivedLinkToken('s', 'owner-mute', 'share-1'));
    expect(a).not.toBe(await derivedLinkToken('s', 'supporter-unsub', 'share-1'));
    expect(a).not.toBe(await derivedLinkToken('s', 'owner-mute', 'share-2'));
    expect(a).not.toBe(await derivedLinkToken('other', 'owner-mute', 'share-1'));
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  });

  it('compares in constant time and still gets the answer right', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('expires a waiting-list token after 48 hours and after one use', () => {
    const created = 1_000_000;
    const row = { expiresAt: created + WAITLIST_TOKEN_TTL_MS, usedAt: null as number | null };
    expect(WAITLIST_TOKEN_TTL_MS).toBe(48 * 3600 * 1000);
    expect(tokenUsable(row, created + 1000)).toBe(true); // control: fresh and unused works
    expect(tokenUsable(row, created + WAITLIST_TOKEN_TTL_MS)).toBe(false); // expired
    expect(tokenUsable({ ...row, usedAt: created + 5 }, created + 10)).toBe(false); // used
  });
});

describe('webhook signature', () => {
  const secret = 'whsec_' + btoa('super-secret-signing-key-0123456789');
  const body = '{"type":"email.bounced"}';
  const now = 1_800_000_000_000;
  const ts = String(now / 1000);

  it('accepts a correctly signed, fresh request (control)', async () => {
    const sig = await signWebhook(secret, 'msg_1', ts, body);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v1,${sig}`, now)).toBe(true);
  });

  it('accepts when one of several signatures matches (key rotation)', async () => {
    const sig = await signWebhook(secret, 'msg_1', ts, body);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v1,AAAA v1,${sig}`, now)).toBe(true);
  });

  it('rejects a changed body, id, secret, missing header and a bad version', async () => {
    const sig = await signWebhook(secret, 'msg_1', ts, body);
    expect(await verifyWebhook(secret, 'msg_1', ts, body + ' ', `v1,${sig}`, now)).toBe(false);
    expect(await verifyWebhook(secret, 'msg_2', ts, body, `v1,${sig}`, now)).toBe(false);
    expect(await verifyWebhook('whsec_' + btoa('another-secret-another-secret'), 'msg_1', ts, body, `v1,${sig}`, now)).toBe(false);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, '', now)).toBe(false);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v2,${sig}`, now)).toBe(false);
  });

  it('rejects a replay older than 5 minutes and a timestamp from the future', async () => {
    const sig = await signWebhook(secret, 'msg_1', ts, body);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v1,${sig}`, now + 6 * 60 * 1000)).toBe(false);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v1,${sig}`, now - 6 * 60 * 1000)).toBe(false);
    expect(await verifyWebhook(secret, 'msg_1', ts, body, `v1,${sig}`, now + 4 * 60 * 1000)).toBe(true);
  });
});
