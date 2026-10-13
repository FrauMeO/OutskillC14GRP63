// Validation for the App Store / Google Play waiting list. Pure, so it can be tested without a browser.

export type WaitlistInput = { email: string; ios: boolean; android: boolean; consent: boolean };

export type WaitlistResult =
  | { ok: true; email: string; ios: boolean; android: boolean }
  | { ok: false; field: 'email' | 'stores' | 'consent'; message: string };

export const WAITLIST_SUCCESS = 'Thank you. We will email you once, when the app is ready.';
export const CONTACT_EMAIL = 'hello@buildyourpillars.com';

export const WAITLIST_PRIVACY = `We keep only your email address and which store you chose, and use them only to tell you when the app is ready. To be removed, email ${CONTACT_EMAIL}.`;

export function validateWaitlist(input: WaitlistInput): WaitlistResult {
  const email = input.email.trim().toLowerCase();
  const at = email.indexOf('@');
  const validEmail =
    email.length > 0 &&
    email.length <= 254 &&
    at > 0 &&
    at === email.lastIndexOf('@') && // exactly one @
    !/\s/.test(email) &&
    email.slice(at + 1).indexOf('.') > 0 && // a dot after the @, not first
    !email.endsWith('.');
  if (!validEmail) return { ok: false, field: 'email', message: 'Please enter a valid email address, like name@example.com.' };
  if (!input.ios && !input.android) return { ok: false, field: 'stores', message: 'Choose the App Store, Google Play, or both' };
  if (!input.consent) return { ok: false, field: 'consent', message: 'Please tick the box to agree to be emailed.' };
  return { ok: true, email, ios: input.ios, android: input.android };
}
