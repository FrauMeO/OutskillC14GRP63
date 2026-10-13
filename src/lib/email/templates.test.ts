import { describe, expect, it } from 'vitest';
import { NUDGE_PRESETS } from './rules';
import {
  FORBIDDEN_WORDING,
  PRESET_TEXT,
  checkAppUrl,
  escapeHtml,
  firstName,
  oneLine,
  renderEmail,
  type TemplateData,
} from './templates';

const APP = 'https://buildyourpillars.com';
const TOKEN = 'A'.repeat(43);
const EVIL = '<script>alert(1)</script>';

const samples: TemplateData[] = [
  { kind: 'care_invite', ownerName: 'Anna Smith' },
  { kind: 'care_nudge', supporterName: 'Ben Jones', preset: 'Thinking of you', muteToken: TOKEN },
  { kind: 'care_nudge', supporterName: 'Ben Jones', preset: 'Want to take a walk?', muteToken: TOKEN },
  { kind: 'weekly_digest', ownerName: 'Anna Smith', level: 'presence', daysLogged: 5, unsubscribeToken: TOKEN },
  {
    kind: 'weekly_digest',
    ownerName: 'Anna Smith',
    level: 'summary',
    daysLogged: 6,
    unsubscribeToken: TOKEN,
    pillars: [
      { pillar: 'sleep', trend: 'a_little_lower' },
      { pillar: 'move', trend: 'about_usual' },
      { pillar: 'eat', trend: 'not_enough_days' },
    ],
  },
  { kind: 'waitlist_confirm', confirmToken: TOKEN },
];

describe('escaping', () => {
  it('escapes the five dangerous characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  it('control: unescaped text WOULD contain the tag, escaped text cannot', () => {
    expect(EVIL).toContain('<script>');
    expect(escapeHtml(EVIL)).not.toContain('<script>');
  });

  it('a hostile name never reaches the HTML unescaped, in any email that shows a name', () => {
    const hostile: TemplateData[] = [
      { kind: 'care_invite', ownerName: EVIL },
      { kind: 'care_nudge', supporterName: EVIL, preset: 'Thinking of you', muteToken: TOKEN },
      { kind: 'weekly_digest', ownerName: EVIL, level: 'presence', daysLogged: 3, unsubscribeToken: TOKEN },
      { kind: 'weekly_digest', ownerName: '"><img src=x onerror=alert(1)>', level: 'presence', daysLogged: 3, unsubscribeToken: TOKEN },
    ];
    for (const d of hostile) {
      const { html } = renderEmail(d, APP);
      expect(html).not.toContain('<script');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('onerror=alert(1)>');
    }
    expect(renderEmail({ kind: 'care_invite', ownerName: EVIL }, APP).html).toContain('&lt;script&gt;');
  });

  it('strips line breaks from subjects (no header injection)', () => {
    expect(oneLine('Hi\r\nBcc: attacker@example.com')).toBe('Hi Bcc: attacker@example.com');
    const { subject } = renderEmail({ kind: 'care_invite', ownerName: 'Ann\r\nBcc: x@y.z' }, APP);
    expect(subject).not.toMatch(/[\r\n]/);
  });
});

describe('names', () => {
  it('uses the first name only; the last name never appears', () => {
    expect(firstName('Anna Smith', 'Someone')).toBe('Anna');
    for (const d of samples) {
      const r = renderEmail(d, APP);
      for (const part of [r.subject, r.html, r.text]) {
        expect(part).not.toContain('Smith');
        expect(part).not.toContain('Jones');
      }
    }
  });

  it('caps a very long name and falls back when empty', () => {
    expect(firstName('x'.repeat(500), 'Someone').length).toBe(30);
    expect(firstName('   ', 'Someone')).toBe('Someone');
    expect(firstName(null, 'Someone')).toBe('Someone');
  });
});

describe('tone and safety of every email', () => {
  it('has no alarm wording, no red, no tracking pixels, no remote images or scripts', () => {
    for (const d of samples) {
      const r = renderEmail(d, APP);
      for (const part of [r.subject, r.text, r.html]) expect(part).not.toMatch(FORBIDDEN_WORDING);
      expect(r.html).not.toMatch(/<img|<script|<iframe|<link|@import|url\(/i);
      expect(r.html).not.toMatch(/#(?:f00|ff0000|d00|c00|b00)\b|\bred\b/i);
      expect(r.html).toContain('font-size:18px');
    }
  });

  it('control: the wording check does catch a missed-day sentence', () => {
    expect(FORBIDDEN_WORDING.test('You missed a day')).toBe(true);
    expect(FORBIDDEN_WORDING.test('Anna logged on 5 of the last 7 days')).toBe(false);
  });

  it('every email says why it was sent and how to stop it', () => {
    for (const d of samples) {
      const r = renderEmail(d, APP);
      expect(r.text).toMatch(/Why you got this:/);
      expect(r.html).toMatch(/Why you got this:/);
      expect(r.text).toMatch(/To stop (it|these notes)/);
    }
  });

  it('non-transactional emails carry a working mute or unsubscribe link and the header value', () => {
    const nudge = renderEmail(samples[1], APP);
    expect(nudge.unsubscribeUrl).toBe(`${APP}/email?a=mute&t=${TOKEN}`);
    expect(nudge.html).toContain(`${APP}/email?a=mute&amp;t=${TOKEN}`);
    const digest = renderEmail(samples[3], APP);
    expect(digest.unsubscribeUrl).toBe(`${APP}/email?a=unsub&t=${TOKEN}`);
    expect(digest.text).toContain(digest.unsubscribeUrl as string);
  });

  it('only links we generate appear (https links on the app domain)', () => {
    for (const d of samples) {
      const r = renderEmail(d, APP);
      const urls = (r.html + ' ' + r.text).match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
      for (const u of urls) expect(u.startsWith(APP)).toBe(true);
    }
  });

  it('the invitation says nothing is shared until accept and log in, names the 14 days, and holds no health data', () => {
    const r = renderEmail(samples[0], APP);
    expect(r.text).toContain('If you were not expecting this, ignore it: nothing is shared until you accept and log in');
    expect(r.text).toContain('14 days');
    expect(r.text).not.toMatch(/sleep|steps|mood|water|exercise|pillars they share|eat\b/i);
  });

  it('the digest speaks in days and trend words only: no raw numbers beyond days, never "missed"', () => {
    const presence = renderEmail(samples[3], APP);
    expect(presence.text).toContain('Anna logged on 5 of the last 7 days.');
    const summary = renderEmail(samples[4], APP);
    expect(summary.text).toContain('Sleep: a little lower than their usual.');
    expect(summary.text).toContain('Move: about the usual for them.');
    expect(summary.text).not.toContain('Drink'); // not_enough_days is left out, not reported
    expect(summary.text).not.toMatch(/\d+(\.\d+)?\s*(hours|steps|litres|liters|minutes)/i);
    // presence level must not show pillar lines even if some are passed
    const leak = renderEmail({ kind: 'weekly_digest', ownerName: 'Anna', level: 'presence', daysLogged: 4, unsubscribeToken: TOKEN, pillars: [{ pillar: 'sleep', trend: 'a_little_lower' }] }, APP);
    expect(leak.text).not.toContain('Sleep');
  });

  it('clamps the day count into 0 to 7', () => {
    expect(renderEmail({ kind: 'weekly_digest', ownerName: 'A', level: 'presence', daysLogged: 99, unsubscribeToken: TOKEN }, APP).text).toContain('7 of the last 7');
    expect(renderEmail({ kind: 'weekly_digest', ownerName: 'A', level: 'presence', daysLogged: -3, unsubscribeToken: TOKEN }, APP).text).toContain('0 of the last 7');
  });

  it('a nudge shows only a preset and never free text; unknown text is refused', () => {
    expect(() => renderEmail({ kind: 'care_nudge', supporterName: 'Ben', preset: 'Why are you ignoring me?', muteToken: TOKEN }, APP)).toThrow();
    expect(() => renderEmail({ kind: 'care_nudge', supporterName: 'Ben', preset: EVIL, muteToken: TOKEN }, APP)).toThrow();
  });

  it('the template presets match the rule presets exactly', () => {
    expect(Object.keys(PRESET_TEXT).sort()).toEqual([...NUDGE_PRESETS].sort());
  });

  it('the waiting-list email says it works once for 48 hours and that ignoring it adds nobody', () => {
    const r = renderEmail(samples[5], APP);
    expect(r.text).toContain('48 hours');
    expect(r.text).toContain('you will not be added');
  });
});

describe('links', () => {
  it('rejects a token that could break out of a URL, and a non-https site', () => {
    expect(() => renderEmail({ kind: 'care_nudge', supporterName: 'B', preset: 'Thinking of you', muteToken: 'x"><a href=evil>' + 'a'.repeat(20) }, APP)).toThrow();
    expect(() => renderEmail({ kind: 'care_nudge', supporterName: 'B', preset: 'Thinking of you', muteToken: 'short' }, APP)).toThrow();
    expect(() => checkAppUrl('http://evil.example')).toThrow();
    expect(() => checkAppUrl('javascript:alert(1)')).toThrow();
    expect(checkAppUrl('https://buildyourpillars.com/')).toBe('https://buildyourpillars.com');
    expect(checkAppUrl('http://localhost:5173')).toBe('http://localhost:5173'); // control
  });
});
