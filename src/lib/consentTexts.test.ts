import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HASH_PATTERN } from './consent';
import { COLLECT_USE, consentHash, consentTextFor, CURRENT_VERSION, EMAIL_MARKETING, LINK_TEXT, sha256Hex, shareConsentCopy } from './consentTexts';

describe('sha256Hex', () => {
  it('matches Node own SHA-256 for every consent text', async () => {
    for (const p of ['collect_use', 'email_marketing', 'share_caregiver'] as const) {
      const text = consentTextFor(p);
      expect(await sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });
  it('control: one changed character changes the hash', async () => {
    const text = consentTextFor('collect_use');
    expect(await sha256Hex(text)).not.toBe(await sha256Hex(text.replace('We do not sell it.', 'We do not sell it!')));
  });
  it('control: the empty string gives its known value', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('gives the 64 lower-case hex digits the database accepts, and different hashes per purpose', async () => {
    const hashes = await Promise.all((['collect_use', 'email_marketing', 'share_caregiver'] as const).map(consentHash));
    for (const h of hashes) expect(h).toMatch(HASH_PATTERN);
    expect(new Set(hashes).size).toBe(3);
    expect(HASH_PATTERN.test(hashes[0].toUpperCase())).toBe(false); // control: the database refuses upper case
  });
});

describe('the words', () => {
  it('collect_use is the spec wording, with the policy link text inside the body', () => {
    expect(COLLECT_USE.heading).toBe('Keeping what you enter');
    expect(COLLECT_USE.body).toContain(`Read the ${LINK_TEXT}.`);
    expect(COLLECT_USE.body).toContain('We do not sell it. We do not use it for ads.');
    expect(COLLECT_USE.label).toMatch(/^I agree that Build Your Pillars may keep and use the health information I enter/);
  });
  it('marketing says it can be turned off any time and is never mixed with health data', () => {
    expect(EMAIL_MARKETING.label).toContain('turn this off any time in Settings');
    expect(EMAIL_MARKETING.note).toContain('never mix this with your health information');
  });
  it('every purpose starts at version 1', () => {
    expect(CURRENT_VERSION).toEqual({ collect_use: 1, email_marketing: 1, share_caregiver: 1 });
  });
});

describe('shareConsentCopy', () => {
  it('names the person, the pillars, the level, the purpose and how to stop', () => {
    const c = shareConsentCopy('sam@example.com', 'Sleep and Move', 'summary', false);
    expect(c.title).toBe('Share with sam@example.com?');
    expect(c.intro).toContain('sam@example.com will be able to look');
    expect(c.see).toBe('Sleep and Move. They will see a weekly summary in words, with no numbers.');
    expect(c.why).toContain('That is the only reason');
    expect(c.inCharge).toContain('pause or stop sharing any time in Settings');
    expect(c.label).toBe('I agree to share this with sam@example.com.');
    expect(c.balanceNote).toBeNull();
  });
  it('adds the Balance sentence only when Balance is ticked (control: absent otherwise)', () => {
    expect(shareConsentCopy('a@b.co', 'Balance', 'presence', true).balanceNote).toBe('Balance means your mood, energy, and stress scores.');
    expect(shareConsentCopy('a@b.co', 'Sleep', 'presence', false).balanceNote).toBeNull();
  });
  it('control: the three levels say three different things', () => {
    const l = (['presence', 'summary', 'detail'] as const).map((x) => shareConsentCopy('a@b.co', 'Sleep', x, false).see);
    expect(new Set(l).size).toBe(3);
  });
  it('leaves no placeholder behind', () => {
    const c = shareConsentCopy('a@b.co', 'Sleep', 'detail', true);
    expect(JSON.stringify(c)).not.toContain('{email}');
  });
});
