import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAGIC_LINK_SENT_MESSAGE, interpretOtpError, looksLikeEmail, messageFor } from './magicLink';
import { nudgeBlock, nudgeReasonText } from './nudgeState';

describe('magic link answers never reveal whether an account exists', () => {
  it('success and the unknown-address error give the same words', () => {
    const unknown = { message: 'Signups not allowed for otp', status: 422, code: 'otp_disabled' };
    expect(interpretOtpError(null)).toBe('sent');
    expect(interpretOtpError(unknown)).toBe('sent');
    expect(messageFor(interpretOtpError(unknown))).toBe(messageFor(interpretOtpError(null)));
    expect(messageFor('sent')).toBe(MAGIC_LINK_SENT_MESSAGE);
  });

  it('control: other failures are told apart, and none says who has an account', () => {
    expect(interpretOtpError({ status: 429, code: 'over_email_send_rate_limit' })).toBe('wait');
    expect(interpretOtpError({ message: 'For security purposes, you can only request this after 56 seconds', status: 429 })).toBe('wait');
    expect(interpretOtpError({ message: 'boom', status: 500 })).toBe('failed');
    for (const o of ['sent', 'wait', 'failed'] as const) expect(messageFor(o)).not.toMatch(/no account|not registered|does not exist|not found/i);
    expect(MAGIC_LINK_SENT_MESSAGE).toMatch(/^If that address has an account/);
  });

  it('checks the address shape', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail(' a@b.co ')).toBe(true);
    expect(looksLikeEmail('nope')).toBe(false);
    expect(looksLikeEmail('a@b')).toBe(false);
  });

  it('the component asks for sign-in only, never for sign-up', () => {
    const src = readFileSync(new URL('../../components/MagicLinkLogin.tsx', import.meta.url), 'utf8');
    expect(src).toContain('shouldCreateUser: false');
    expect(src).not.toContain('shouldCreateUser: true');
  });
});

describe('nudge buttons', () => {
  const now = new Date('2026-10-12T15:00:00Z');
  it('are open only when allowed and nothing was sent in 24 hours (control)', () => {
    expect(nudgeBlock({ allowed: true, lastNudgeAt: null, now })).toBeNull();
  });
  it('are closed when the owner has not allowed notes', () => {
    expect(nudgeBlock({ allowed: false, lastNudgeAt: null, now })).toBe('not_allowed');
  });
  it('are closed after a note was sent today, open again after 24 hours', () => {
    expect(nudgeBlock({ allowed: true, lastNudgeAt: new Date('2026-10-12T10:00:00Z'), now })).toBe('sent_recently');
    expect(nudgeBlock({ allowed: true, lastNudgeAt: new Date('2026-10-11T14:59:00Z'), now })).toBeNull();
  });
  it('give a plain reason, and the same one whether notes were never on or were turned off', () => {
    expect(nudgeReasonText('not_allowed', 'Anna')).toBe('Anna has not turned on gentle notes, so they are not available.');
    expect(nudgeReasonText(null, 'Anna')).toBeNull();
    expect(nudgeReasonText('sent_recently', 'Anna')).toMatch(/tomorrow/);
  });
});

describe('Deno copies stay identical to the source files', () => {
  for (const f of ['tokens', 'rules', 'templates', 'webhookSignature']) {
    it(`${f}.ts`, () => {
      const a = readFileSync(new URL(`./${f}.ts`, import.meta.url), 'utf8');
      const b = readFileSync(new URL(`../../../supabase/functions/_shared/email/${f}.ts`, import.meta.url), 'utf8');
      expect(b).toBe(a);
    });
  }

  it('control: the check does detect a difference', () => {
    const a = readFileSync(new URL('./rules.ts', import.meta.url), 'utf8');
    expect(a + ' ').not.toBe(a);
  });

  it('the shared modules import nothing (so they run in Deno and Node alike)', () => {
    for (const f of ['tokens', 'rules', 'templates', 'webhookSignature']) {
      const a = readFileSync(new URL(`./${f}.ts`, import.meta.url), 'utf8');
      expect(a).not.toMatch(/^import /m);
    }
  });

  it('no provider key is ever read anywhere but Deno.env in the functions', () => {
    for (const f of ['send-email', 'email-webhook']) {
      const src = readFileSync(new URL(`../../../supabase/functions/${f}/index.ts`, import.meta.url), 'utf8');
      expect(src).not.toMatch(/re_[A-Za-z0-9]{20,}/);
      expect(src).not.toMatch(/service_role['"]?\s*:\s*['"]ey/);
    }
    const send = readFileSync(new URL('../../../supabase/functions/send-email/index.ts', import.meta.url), 'utf8');
    expect(send).toContain("env('RESEND_API_KEY')");
    const client = readFileSync(new URL('./client.ts', import.meta.url), 'utf8');
    expect(client).not.toMatch(/RESEND|api\.resend\.com/);
  });
});
