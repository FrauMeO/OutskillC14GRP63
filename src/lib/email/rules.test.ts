import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DAILY_CAP,
  RECIPIENT_MAX_PER_24H,
  dedupeKey,
  evaluateSend,
  hourInWindow,
  isNudgePreset,
  isQuietHour,
  localDate,
  localHour,
  nudgeAvailableAt,
  utcDay,
  type SendContext,
} from './rules';

// 2026-10-12 is a Monday. 15:00 UTC = 11:00 in New York (not quiet), 08:00 in Vancouver (not quiet).
const NOON_ISH = new Date('2026-10-12T15:00:00Z');

const base = (over: Partial<SendContext> = {}): SendContext => ({
  kind: 'care_nudge',
  now: NOON_ISH,
  recipientTz: 'America/New_York',
  suppressed: false,
  share: { status: 'active', paused: false },
  optedIn: true,
  duplicate: false,
  recipientSent24h: 0,
  recipientKindSent24h: 0,
  sentToday: 0,
  ...over,
});

describe('quiet hours', () => {
  it('wraps over midnight', () => {
    expect(hourInWindow(22, 21, 8)).toBe(true);
    expect(hourInWindow(3, 21, 8)).toBe(true);
    expect(hourInWindow(8, 21, 8)).toBe(false);
    expect(hourInWindow(12, 21, 8)).toBe(false); // control
    expect(hourInWindow(21, 21, 8)).toBe(true);
  });

  it('uses the recipient time zone when known', () => {
    // 02:00 UTC is 22:00 the evening before in New York (quiet)
    const t = new Date('2026-10-12T02:00:00Z');
    expect(localHour(t, 'America/New_York')).toBe(22);
    expect(isQuietHour(t, 'America/New_York')).toBe(true);
    // control: 06:00 UTC is 10:00 in Dubai, outside the quiet window
    expect(localHour(t, 'Asia/Dubai')).toBe(6);
    expect(isQuietHour(new Date('2026-10-12T06:00:00Z'), 'Asia/Dubai')).toBe(false); // 10:00 in Dubai
  });

  it('falls back to a documented UTC window when the zone is unknown or invalid', () => {
    expect(isQuietHour(new Date('2026-10-12T05:00:00Z'), null)).toBe(true);
    expect(isQuietHour(new Date('2026-10-12T15:00:00Z'), null)).toBe(false); // control
    expect(localHour(NOON_ISH, 'Not/AZone')).toBeNull();
    expect(isQuietHour(new Date('2026-10-12T05:00:00Z'), 'Not/AZone')).toBe(true);
  });

  it('reads the local calendar date and weekday', () => {
    // Monday 02:00 UTC is still Sunday evening in Vancouver
    const t = new Date('2026-10-12T02:00:00Z');
    expect(localDate(t, 'America/Vancouver')).toEqual({ date: '2026-10-11', weekday: 0 });
    expect(localDate(t, null)).toEqual({ date: '2026-10-12', weekday: 1 });
  });
});

describe('evaluateSend', () => {
  it('lets a normal, opted-in nudge through (control for every block below)', () => {
    expect(evaluateSend(base())).toEqual({ send: true, reason: 'ok' });
  });

  it('blocks a suppressed address first', () => {
    expect(evaluateSend(base({ suppressed: true }))).toMatchObject({ send: false, reason: 'suppressed' });
    expect(evaluateSend(base({ kind: 'care_invite', share: { status: 'pending', paused: false, createdAt: NOON_ISH }, suppressed: true }))).toMatchObject({ send: false });
  });

  it('sends nothing for a paused, revoked or still-pending share (no email on pause or revoke)', () => {
    expect(evaluateSend(base({ share: { status: 'active', paused: true } }))).toMatchObject({ send: false, reason: 'share_not_active' });
    expect(evaluateSend(base({ share: { status: 'revoked', paused: false } }))).toMatchObject({ send: false, reason: 'share_not_active' });
    expect(evaluateSend(base({ share: { status: 'pending', paused: false } }))).toMatchObject({ send: false });
    expect(evaluateSend(base({ kind: 'weekly_digest', share: { status: 'active', paused: true } }))).toMatchObject({ send: false });
  });

  it('needs the opt-in for nudges and digests', () => {
    expect(evaluateSend(base({ optedIn: false }))).toMatchObject({ send: false, reason: 'not_opted_in' });
    expect(evaluateSend(base({ kind: 'weekly_digest', optedIn: false }))).toMatchObject({ send: false, reason: 'not_opted_in' });
    expect(evaluateSend(base({ kind: 'weekly_digest', optedIn: true }))).toMatchObject({ send: true });
  });

  it('holds back during quiet hours (deferred), but not an invite or a confirmation', () => {
    const night = new Date('2026-10-12T04:00:00Z'); // 00:00 in New York
    expect(evaluateSend(base({ now: night }))).toEqual({ send: false, defer: true, reason: 'quiet_hours' });
    const invite = base({ kind: 'care_invite', now: night, share: { status: 'pending', paused: false, createdAt: new Date('2026-10-10T00:00:00Z') } });
    expect(evaluateSend(invite)).toMatchObject({ send: true });
    expect(evaluateSend({ ...base({ kind: 'waitlist_confirm', now: night }), share: undefined })).toMatchObject({ send: true });
  });

  it('stops a second email with the same dedupe key', () => {
    expect(evaluateSend(base({ duplicate: true }))).toMatchObject({ send: false, reason: 'duplicate' });
  });

  it('caps one address, and the whole day, at the limits', () => {
    expect(evaluateSend(base({ recipientSent24h: RECIPIENT_MAX_PER_24H - 1 }))).toMatchObject({ send: true }); // control
    expect(evaluateSend(base({ recipientSent24h: RECIPIENT_MAX_PER_24H }))).toMatchObject({ send: false, reason: 'recipient_cap' });
    expect(evaluateSend(base({ sentToday: DEFAULT_DAILY_CAP - 1 }))).toMatchObject({ send: true }); // control
    expect(evaluateSend(base({ sentToday: DEFAULT_DAILY_CAP }))).toMatchObject({ send: false, defer: true, reason: 'daily_cap' });
    expect(evaluateSend(base({ sentToday: 5, dailyCap: 5 }))).toMatchObject({ send: false, reason: 'daily_cap' });
  });

  it('invites: pending only, and not after 14 days', () => {
    const inv = (createdAt: string, status: 'pending' | 'active' = 'pending') =>
      evaluateSend(base({ kind: 'care_invite', share: { status, paused: false, createdAt: new Date(createdAt) } }));
    expect(inv('2026-10-01T15:00:00Z')).toMatchObject({ send: true }); // 11 days: control
    expect(inv('2026-09-27T15:00:00Z')).toMatchObject({ send: false, reason: 'invite_expired' }); // 15 days
    expect(inv('2026-10-10T15:00:00Z', 'active')).toMatchObject({ send: false, reason: 'share_not_pending' });
  });

  it('waiting list: once a day per address, and a cap across all addresses', () => {
    const wl = (over: Partial<SendContext>) => evaluateSend({ ...base({ kind: 'waitlist_confirm' }), share: undefined, ...over });
    expect(wl({})).toMatchObject({ send: true });
    expect(wl({ recipientKindSent24h: 1 })).toMatchObject({ send: false, reason: 'waitlist_recently_sent' });
    expect(wl({ waitlistSentLastHour: 29 })).toMatchObject({ send: true });
    expect(wl({ waitlistSentLastHour: 30 })).toMatchObject({ send: false, reason: 'waitlist_hourly_cap' });
  });
});

describe('presets, nudge window and dedupe', () => {
  it('accepts only the two presets, exactly', () => {
    expect(isNudgePreset('Thinking of you')).toBe(true);
    expect(isNudgePreset('Want to take a walk?')).toBe(true);
    expect(isNudgePreset('thinking of you')).toBe(false);
    expect(isNudgePreset('Call me now')).toBe(false);
    expect(isNudgePreset('')).toBe(false);
    expect(isNudgePreset(undefined)).toBe(false);
    expect(isNudgePreset('Thinking of you <script>')).toBe(false);
  });

  it('allows one nudge per rolling 24 hours', () => {
    const last = new Date('2026-10-11T16:00:00Z');
    expect(nudgeAvailableAt(null, NOON_ISH).allowed).toBe(true);
    expect(nudgeAvailableAt(last, NOON_ISH).allowed).toBe(false); // 23 hours ago
    expect(nudgeAvailableAt(last, new Date('2026-10-12T16:00:00Z')).allowed).toBe(true); // control: exactly 24 hours
    expect(nudgeAvailableAt(last, NOON_ISH).retryAt?.toISOString()).toBe('2026-10-12T16:00:00.000Z');
  });

  it('builds a dedupe key per kind, share and day', () => {
    expect(dedupeKey('care_nudge', 'abc', utcDay(NOON_ISH))).toBe('care_nudge:abc:2026-10-12');
    expect(dedupeKey('care_nudge', 'abc', '2026-10-13')).not.toBe(dedupeKey('care_nudge', 'abc', '2026-10-12'));
    expect(dedupeKey('weekly_digest', 'abc', '2026-10-12')).not.toBe(dedupeKey('care_nudge', 'abc', '2026-10-12'));
    expect(dedupeKey('care_invite', 'abc', 'once')).toBe('care_invite:abc:once');
  });
});
