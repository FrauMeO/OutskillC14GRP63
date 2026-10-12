import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECIPIENTS } from './dataRecipients';
import { daysLeft, DETAILS_MAX, formatDay, REQUEST_TYPES, requestStatusText, RESPONSE_DAYS, typeLabel, validateRequest, type RequestRow } from './privacyRequests';

const NOW = new Date('2026-10-12T12:00:00Z');
const base: RequestRow = {
  id: 'r1',
  request_type: 'access',
  details: null,
  status: 'open',
  created_at: '2026-10-12T12:00:00Z',
  due_at: '2026-11-11T12:00:00Z',
  extended_due_at: null,
  answered_at: null,
  outcome: null,
};

describe('validateRequest', () => {
  it('accepts every type and needs a few words where we cannot guess', () => {
    for (const t of REQUEST_TYPES) {
      expect(validateRequest(t.value, t.needsDetails ? 'Please fix my name' : '')).toBeNull();
    }
    expect(validateRequest('correct', '  ')).toMatch(/tell us a little/);
    expect(validateRequest('appeal', 'x')).toMatch(/tell us a little/);
    expect(validateRequest('access', '')).toBeNull(); // control: access needs no words
  });
  it('refuses unknown types and very long text, accepts the limit', () => {
    expect(validateRequest('sell', '')).toMatch(/choose/);
    expect(validateRequest('access', 'x'.repeat(DETAILS_MAX + 1))).toMatch(/characters/);
    expect(validateRequest('access', 'x'.repeat(DETAILS_MAX))).toBeNull();
  });
  it('lists the eight types the database accepts', () => {
    expect(REQUEST_TYPES.map((t) => t.value).sort()).toEqual(['access', 'appeal', 'correct', 'delete', 'list_third_parties', 'object', 'restrict', 'withdraw']);
    expect(typeLabel('delete')).toBe('Delete my information');
  });
});

describe('the 30-day clock', () => {
  it('promises 30 days, not the 45 the law allows', () => {
    expect(RESPONSE_DAYS).toBe(30);
    expect(RESPONSE_DAYS).not.toBe(45);
  });
  it('counts days left from the due date and never goes below 0', () => {
    expect(daysLeft(base.due_at, NOW)).toBe(30);
    expect(daysLeft('2026-10-12T13:00:00Z', NOW)).toBe(1);
    expect(daysLeft('2026-10-01T00:00:00Z', NOW)).toBe(0);
  });
  it('says when we will answer, and uses the extended date when there is one', () => {
    expect(requestStatusText(base, NOW, 'en-CA')).toMatch(/^Open\. We will answer by November 11, 2026 \(30 days left\)\.$/);
    const ext = { ...base, extended_due_at: '2026-12-01T12:00:00Z' };
    expect(requestStatusText(ext, NOW, 'en-CA')).toMatch(/December 1, 2026/);
    expect(requestStatusText(ext, NOW, 'en-CA')).toMatch(/asked for more time/);
    expect(requestStatusText({ ...base, status: 'answered', answered_at: '2026-10-20T12:00:00Z' }, NOW, 'en-CA')).toMatch(/^Answered on October 20, 2026\.$/);
    expect(requestStatusText({ ...base, status: 'declined' }, NOW)).toMatch(/appeal/);
  });
  it('formatDay copes with a bad date', () => {
    expect(formatDay('nonsense')).toBe('');
  });
});

describe('who has my data', () => {
  const page = readFileSync(new URL('../pages/HealthDataPrivacy.tsx', import.meta.url), 'utf8');
  it('every company named here is also named in the Consumer Health Data Privacy Policy page', () => {
    for (const r of RECIPIENTS.filter((x) => x.name !== 'People you invited')) {
      expect(page, r.name).toContain(r.name);
    }
  });
  it('control: a name that is not on the page is caught', () => {
    expect(page).not.toContain('SomeOtherCompany');
  });
  it('lists six recipients, each with what, why and how to stop', () => {
    expect(RECIPIENTS).toHaveLength(6);
    for (const r of RECIPIENTS) expect(r.what && r.why && r.choice).toBeTruthy();
  });
});
