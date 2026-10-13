// Pure logic for the optional daily reminder. No native calls here, so it is fully unit tested.
//
// Principles (CLAUDE.md, Product principles):
//  - Off by default. Only the person turns it on.
//  - The wording is a gentle invitation. It never names health data, a number, a streak or a
//    missed day, because a notification can be read by anyone looking at the lock screen.
//  - The only thing stored is the reminder itself, inside the phone's own notification system.
//    There is no copy in our database and none in browser storage.

export const REMINDER_ID = 4001;
export const REMINDER_TITLE = 'Build Your Pillars';
export const REMINDER_BODY = 'A gentle nudge to notice your day';
export const DEFAULT_REMINDER_TIME = '19:00';

export type ReminderTime = { hour: number; minute: number };

/** "19:30" or "7:05" to a time, or null when it is not a real time of day. */
export function parseTime(text: string): ReminderTime | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** A time to the "HH:MM" form an <input type="time"> uses. */
export function formatTime({ hour, minute }: ReminderTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** A time in plain words for a sentence, for example "7:30 pm". */
export function describeTime({ hour, minute }: ReminderTime): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Shape the local-notifications plugin accepts. Declared here so this file imports nothing native. */
export type ReminderNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { on: { hour: number; minute: number }; allowWhileIdle: boolean };
  // Inexact on purpose. Google Play restricts exact alarms to alarm and calendar apps, and a
  // nudge that arrives a few minutes late is just as kind.
  isExactNotification: boolean;
};

export function buildReminder(time: ReminderTime): ReminderNotification {
  return {
    id: REMINDER_ID,
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: false },
    isExactNotification: false,
  };
}

/** Permission values the plugin can report. */
export type PermissionValue = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

/**
 * What the screen should offer, given the phone's permission and whether a reminder is set.
 *  - 'off'      : no reminder, we may ask (after our own explanation first).
 *  - 'on'       : a reminder is set and allowed.
 *  - 'blocked'  : the person said no to notifications; only the phone's Settings can change that.
 *  - 'needs-permission': a reminder was set earlier but permission was later withdrawn.
 */
export type ReminderState = 'off' | 'on' | 'blocked' | 'needs-permission';

export function resolveState(permission: PermissionValue, scheduled: boolean): ReminderState {
  if (permission === 'denied') return scheduled ? 'needs-permission' : 'blocked';
  if (permission === 'granted') return scheduled ? 'on' : 'off';
  // 'prompt' and 'prompt-with-rationale': never asked yet, or asked and dismissed.
  return 'off';
}

/**
 * After the person asks to turn the reminder on and we have requested permission, what happened.
 * Anything other than 'granted' means we schedule nothing.
 */
export function afterPermissionRequest(permission: PermissionValue): 'schedule' | 'denied' {
  return permission === 'granted' ? 'schedule' : 'denied';
}

/** Does the notification text stay free of anything about health data? Used by tests. */
export const FORBIDDEN_WORDS = [
  'sleep', 'steps', 'water', 'mood', 'stress', 'exercise', 'anxious', 'streak', 'missed', 'goal',
  'health', 'score', 'log', 'check-in', 'reflect',
];
