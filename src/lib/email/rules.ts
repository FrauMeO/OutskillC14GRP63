// Pure send rules for the email layer: who may be emailed, when, and how often.
// No network, no clock reads (the caller passes `now`), no imports: this file is copied
// byte-for-byte to supabase/functions/_shared/email/ (a test checks they are identical).

export type EmailKind = 'care_invite' | 'care_nudge' | 'weekly_digest' | 'waitlist_confirm';

export const EMAIL_KINDS: readonly EmailKind[] = ['care_invite', 'care_nudge', 'weekly_digest', 'waitlist_confirm'];

export function isEmailKind(x: unknown): x is EmailKind {
  return typeof x === 'string' && (EMAIL_KINDS as readonly string[]).includes(x);
}

/** Transactional = the person just asked for it (an invite they sent, a form they filled in).
 *  Everything else needs the recipient's own opt-in, quiet hours and an unsubscribe route. */
export const TRANSACTIONAL: Record<EmailKind, boolean> = {
  care_invite: true,
  waitlist_confirm: true,
  care_nudge: false,
  weekly_digest: false,
};

// ---------- nudge presets: the only words a supporter can send ----------
export const NUDGE_PRESETS = ['Thinking of you', 'Want to take a walk?'] as const;
export type NudgePreset = (typeof NUDGE_PRESETS)[number];

export function isNudgePreset(x: unknown): x is NudgePreset {
  return typeof x === 'string' && (NUDGE_PRESETS as readonly string[]).includes(x);
}

// ---------- limits ----------
export const INVITE_TTL_DAYS = 14;
export const WAITLIST_CONFIRM_TTL_HOURS = 48;
export const NUDGE_WINDOW_MS = 24 * 60 * 60 * 1000; // one nudge per share per rolling 24 hours
/** Most emails (any kind) one address may get in 24 hours from us, auth emails not counted. */
export const RECIPIENT_MAX_PER_24H = 5;
/** Resend's free plan stops at 100 a day; stay under it so account emails still get through. */
export const DEFAULT_DAILY_CAP = 90;
/** A waitlist confirmation goes to one address at most once in 24 hours. */
export const WAITLIST_CONFIRM_PER_ADDRESS_24H = 1;
/** Waiting-list confirmations to ALL addresses in an hour: stops anyone using the form to spray strangers. */
export const WAITLIST_CONFIRM_HOURLY_CAP = 30;

// ---------- quiet hours ----------
/** Local quiet window when the recipient's time zone is known: no sends 21:00 to 08:00. */
export const QUIET_LOCAL = { startHour: 21, endHour: 8 } as const;
/** When the time zone is unknown we use UTC 02:00 to 13:00. That is night in the Americas
 *  (22:00-09:00 in New York, 19:00-06:00 in Vancouver) and morning or evening elsewhere, so a
 *  digest or nudge goes out between 13:00 and 02:00 UTC. It is a compromise, not a promise:
 *  record each person's time zone (see set_nudge_pref / set_digest_pref) to do better. */
export const QUIET_UTC_FALLBACK = { startHour: 2, endHour: 13 } as const;

/** True when `hour` (0-23) falls in [start, end), wrapping over midnight when start > end. */
export function hourInWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

/** The hour (0-23) at `now` in an IANA time zone, or null if the zone is unknown or invalid. */
export function localHour(now: Date, timeZone: string | null | undefined): number | null {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(now);
    const h = parts.find((p) => p.type === 'hour')?.value;
    const n = h === undefined ? NaN : Number(h);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
  } catch {
    return null;
  }
}

/** Calendar date (YYYY-MM-DD) and weekday (0 = Sunday) at `now` in the zone, falling back to UTC. */
export function localDate(now: Date, timeZone: string | null | undefined): { date: string; weekday: number } {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).formatToParts(now);
      const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
      const date = `${get('year')}-${get('month')}-${get('day')}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { date, weekday: new Date(date + 'T00:00:00Z').getUTCDay() };
      }
    } catch {
      /* fall through to UTC */
    }
  }
  return { date: now.toISOString().slice(0, 10), weekday: now.getUTCDay() };
}

export function isQuietHour(now: Date, timeZone: string | null | undefined): boolean {
  const local = localHour(now, timeZone);
  if (local !== null) return hourInWindow(local, QUIET_LOCAL.startHour, QUIET_LOCAL.endHour);
  return hourInWindow(now.getUTCHours(), QUIET_UTC_FALLBACK.startHour, QUIET_UTC_FALLBACK.endHour);
}

// ---------- dedupe ----------
/** One email per kind, per share (or address), per scope. Scope is a UTC day ("2026-10-12"),
 *  or "once" for something that must only ever go out one time (the invitation). */
export function dedupeKey(kind: EmailKind, subjectId: string, scope: string): string {
  return `${kind}:${subjectId}:${scope}`;
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// ---------- nudge rule (mirrors send_care_nudge in the database) ----------
export function nudgeAvailableAt(lastNudgeAt: Date | null, now: Date): { allowed: boolean; retryAt: Date | null } {
  if (!lastNudgeAt) return { allowed: true, retryAt: null };
  const next = new Date(lastNudgeAt.getTime() + NUDGE_WINDOW_MS);
  return now >= next ? { allowed: true, retryAt: null } : { allowed: false, retryAt: next };
}

// ---------- the one decision function ----------
export type ShareState = { status: 'pending' | 'active' | 'revoked'; paused: boolean; createdAt?: Date };

export interface SendContext {
  kind: EmailKind;
  now: Date;
  /** Recipient's IANA zone if we have it. */
  recipientTz?: string | null;
  /** Address is on email_suppressions (bounce, complaint or unsubscribe). */
  suppressed: boolean;
  /** Required for the three share kinds. */
  share?: ShareState;
  /** Nudge: the owner allows nudges on this share. Digest: the supporter asked for the digest. */
  optedIn?: boolean;
  /** A log row with the same dedupe key already exists. */
  duplicate: boolean;
  /** Emails of any kind to this address in the last 24 hours. */
  recipientSent24h: number;
  /** Emails of THIS kind to this address in the last 24 hours. */
  recipientKindSent24h: number;
  /** Waiting-list confirmations sent to anyone in the last hour. */
  waitlistSentLastHour?: number;
  /** Emails we sent in total today (UTC), all kinds. */
  sentToday: number;
  dailyCap?: number;
}

export type Decision =
  | { send: true; reason: 'ok' }
  | { send: false; defer: boolean; reason: string };

const no = (reason: string, defer = false): Decision => ({ send: false, defer, reason });

/** Order matters: the quiet reasons come first, so the caller can say nothing about why. */
export function evaluateSend(c: SendContext): Decision {
  if (c.suppressed) return no('suppressed');
  if (c.duplicate) return no('duplicate');

  if (c.kind === 'care_invite') {
    if (!c.share || c.share.status !== 'pending') return no('share_not_pending');
    const created = c.share.createdAt;
    if (!created || c.now.getTime() - created.getTime() > INVITE_TTL_DAYS * 86_400_000) return no('invite_expired');
  } else if (c.kind === 'care_nudge' || c.kind === 'weekly_digest') {
    // Revoking or pausing sends nothing at all, and nothing here says why.
    if (!c.share || c.share.status !== 'active' || c.share.paused) return no('share_not_active');
    if (!c.optedIn) return no('not_opted_in');
  }

  if (c.kind === 'waitlist_confirm' && c.recipientKindSent24h >= WAITLIST_CONFIRM_PER_ADDRESS_24H) {
    return no('waitlist_recently_sent');
  }
  if (c.kind === 'waitlist_confirm' && (c.waitlistSentLastHour ?? 0) >= WAITLIST_CONFIRM_HOURLY_CAP) {
    return no('waitlist_hourly_cap');
  }
  if (c.recipientSent24h >= RECIPIENT_MAX_PER_24H) return no('recipient_cap');
  if (c.sentToday >= (c.dailyCap ?? DEFAULT_DAILY_CAP)) return no('daily_cap', true);

  if (!TRANSACTIONAL[c.kind] && isQuietHour(c.now, c.recipientTz)) return no('quiet_hours', true);
  return { send: true, reason: 'ok' };
}
