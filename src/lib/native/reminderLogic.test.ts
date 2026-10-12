import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_WORDS,
  REMINDER_BODY,
  REMINDER_ID,
  REMINDER_TITLE,
  afterPermissionRequest,
  buildReminder,
  describeTime,
  formatTime,
  parseTime,
  resolveState,
} from './reminderLogic';

describe('parseTime / formatTime / describeTime', () => {
  it('parses normal times', () => {
    expect(parseTime('19:30')).toEqual({ hour: 19, minute: 30 });
    expect(parseTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseTime(' 23:59 ')).toEqual({ hour: 23, minute: 59 });
  });
  it('rejects things that are not a time of day', () => {
    for (const bad of ['', '24:00', '12:60', '12', 'ab:cd', '-1:30', '12:5', '1:2:3']) {
      expect(parseTime(bad)).toBeNull();
    }
  });
  it('formats for a time input and for a sentence', () => {
    expect(formatTime({ hour: 7, minute: 5 })).toBe('07:05');
    expect(describeTime({ hour: 19, minute: 30 })).toBe('7:30 pm');
    expect(describeTime({ hour: 0, minute: 0 })).toBe('12:00 am');
    expect(describeTime({ hour: 12, minute: 15 })).toBe('12:15 pm');
  });
  it('round-trips every minute of the day', () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        expect(parseTime(formatTime({ hour: h, minute: m }))).toEqual({ hour: h, minute: m });
      }
    }
  });
});

describe('buildReminder', () => {
  it('uses the plain words, a fixed id, and an inexact daily schedule', () => {
    const n = buildReminder({ hour: 18, minute: 45 });
    expect(n.id).toBe(REMINDER_ID);
    expect(n.body).toBe('A gentle nudge to notice your day');
    expect(n.schedule.on).toEqual({ hour: 18, minute: 45 });
    expect(n.isExactNotification).toBe(false);
  });
  it('never mentions health data, numbers or streaks in the notification text', () => {
    const text = `${REMINDER_TITLE} ${REMINDER_BODY}`.toLowerCase();
    for (const w of FORBIDDEN_WORDS) expect(text).not.toContain(w);
    expect(text).not.toMatch(/\d/);
  });
});

describe('resolveState', () => {
  it('is off when granted or never asked and nothing is scheduled', () => {
    expect(resolveState('granted', false)).toBe('off');
    expect(resolveState('prompt', false)).toBe('off');
    expect(resolveState('prompt-with-rationale', false)).toBe('off');
  });
  it('is on only when granted and scheduled', () => {
    expect(resolveState('granted', true)).toBe('on');
  });
  it('is blocked when denied, and asks to re-allow if one was already set', () => {
    expect(resolveState('denied', false)).toBe('blocked');
    expect(resolveState('denied', true)).toBe('needs-permission');
  });
  it('treats a stale schedule without permission as off, not on (prompt case)', () => {
    expect(resolveState('prompt', true)).toBe('off');
  });
});

describe('afterPermissionRequest', () => {
  it('schedules only when granted', () => {
    expect(afterPermissionRequest('granted')).toBe('schedule');
    expect(afterPermissionRequest('denied')).toBe('denied');
    expect(afterPermissionRequest('prompt')).toBe('denied');
    expect(afterPermissionRequest('prompt-with-rationale')).toBe('denied');
  });
});
