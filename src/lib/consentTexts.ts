// The exact words people agree to, by purpose and version (docs/privacy-consent-spec.md, section 2).
// What is hashed is what is shown. If a word changes, bump that purpose's version, and everyone is
// asked again before the new use starts. Never pre-tick, never bundle. Pure; nothing here touches the network.
//
// `ai_processing` is not here: its wording lives with the AI dialog (src/features/aiReflection).

export type TextPurpose = 'collect_use' | 'email_marketing' | 'share_caregiver';

export const LINK_TEXT = 'Consumer Health Data Privacy Policy';

export const COLLECT_USE = {
  version: 1,
  heading: 'Keeping what you enter',
  body:
    'To work, this app has to keep the health information you choose to enter. That means things like sleep, water, steps, mood, feelings, and notes. ' +
    'We use it to show you your own days, goals, and trends. We do not sell it. We do not use it for ads. ' +
    `You can see it, download it, or delete it any time in Settings. Read the ${LINK_TEXT}.`,
  label: 'I agree that Build Your Pillars may keep and use the health information I enter, to run the app for me.',
} as const;

export const EMAIL_MARKETING = {
  version: 1,
  label: 'Email me occasional news about Build Your Pillars. I can turn this off any time in Settings, or with the link in each email.',
  note: 'We never mix this with your health information, and we never send your email address to anyone else.',
} as const;

// The caregiver dialog changes with the person, the pillars and the level. What is hashed is this
// TEMPLATE (every sentence the dialog can show, with {email} left in), so one hash covers one wording.
export const SHARE_CAREGIVER = {
  version: 1,
  title: 'Share with {email}?',
  intro: 'If you say yes, {email} will be able to look at some of your health information.',
  seeLabel: 'What they will see:',
  levels: {
    presence: 'They will only see which days you logged.',
    summary: 'They will see a weekly summary in words, with no numbers.',
    detail: 'They will see your day-by-day numbers for those pillars.',
  },
  balanceNote: 'Balance means your mood, energy, and stress scores.',
  never: 'What they will never see: your notes, your feelings list, your places, or your check-in answers.',
  why: 'Why: so someone you trust can follow along. That is the only reason.',
  onlyLook: 'They can only look. They cannot change anything. They will see your first name.',
  inCharge: 'You are in charge. You can pause or stop sharing any time in Settings. It stops at once. You can also see on which days they looked.',
  expiry: 'The invitation ends by itself after 14 days if they do not accept. We do not send them an email, so please tell them yourself.',
  label: 'I agree to share this with {email}.',
} as const;

/** The single string that is hashed for a purpose: every shown piece, joined by a newline, no HTML. */
export function consentTextFor(purpose: TextPurpose): string {
  switch (purpose) {
    case 'collect_use':
      return [COLLECT_USE.heading, COLLECT_USE.body, COLLECT_USE.label].join('\n');
    case 'email_marketing':
      return [EMAIL_MARKETING.label, EMAIL_MARKETING.note].join('\n');
    case 'share_caregiver': {
      const s = SHARE_CAREGIVER;
      return [s.title, s.intro, s.seeLabel, s.levels.presence, s.levels.summary, s.levels.detail, s.balanceNote, s.never, s.why, s.onlyLook, s.inCharge, s.expiry, s.label].join('\n');
    }
  }
}

export const CURRENT_VERSION: Record<TextPurpose, number> = {
  collect_use: COLLECT_USE.version,
  email_marketing: EMAIL_MARKETING.version,
  share_caregiver: SHARE_CAREGIVER.version,
};

/** Lower-case hex SHA-256 of a string (UTF-8). Uses the browser's (and Node's) built-in crypto. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const cache = new Map<TextPurpose, string>();

/** Hash of the current wording for a purpose (computed once per page load). */
export async function consentHash(purpose: TextPurpose): Promise<string> {
  const hit = cache.get(purpose);
  if (hit) return hit;
  const h = await sha256Hex(consentTextFor(purpose));
  cache.set(purpose, h);
  return h;
}

/** The caregiver dialog's sentences for one invitation. Variable parts only; wording comes from SHARE_CAREGIVER. */
export function shareConsentCopy(email: string, pillars: string, level: keyof typeof SHARE_CAREGIVER.levels, balance: boolean) {
  const s = SHARE_CAREGIVER;
  const fill = (t: string) => t.replaceAll('{email}', email);
  return {
    title: fill(s.title),
    intro: fill(s.intro),
    seeLabel: s.seeLabel,
    see: `${pillars}. ${s.levels[level]}`,
    balanceNote: balance ? s.balanceNote : null,
    never: s.never,
    why: s.why,
    onlyLook: s.onlyLook,
    inCharge: s.inCharge,
    expiry: s.expiry,
    label: fill(s.label),
  };
}
