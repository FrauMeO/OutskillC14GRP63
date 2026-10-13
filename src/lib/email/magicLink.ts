// Pure helpers for the "Email me a sign-in link" option. No imports on purpose.
//
// The screen must never reveal whether an address has an account. With shouldCreateUser: false,
// Supabase answers an unknown address with an error ("Signups not allowed for otp", status 422,
// code otp_disabled). We treat that exactly like success.

export const MAGIC_LINK_SENT_MESSAGE =
  'If that address has an account, a sign-in link is on its way. It works once and expires soon. Check your spam folder too.';
export const MAGIC_LINK_WAIT_MESSAGE = 'Please wait a minute before asking for another link.';
export const MAGIC_LINK_FAILED_MESSAGE = 'We could not send a link just now. Please try again in a little while.';
export const MAGIC_LINK_BAD_ADDRESS_MESSAGE = 'Please enter your email address.';

export type MagicLinkOutcome = 'sent' | 'wait' | 'failed';

export interface OtpError {
  message?: string;
  status?: number;
  code?: string;
}

export function interpretOtpError(error: OtpError | null | undefined): MagicLinkOutcome {
  if (!error) return 'sent';
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  // Unknown address under shouldCreateUser:false: look identical to success.
  if (code === 'otp_disabled' || code === 'signup_disabled' || message.includes('signups not allowed')) return 'sent';
  // Rate limits do not depend on whether the account exists.
  if (error.status === 429 || code.includes('rate_limit') || message.includes('rate limit') || message.includes('security purposes')) return 'wait';
  return 'failed';
}

export function messageFor(outcome: MagicLinkOutcome): string {
  return outcome === 'sent' ? MAGIC_LINK_SENT_MESSAGE : outcome === 'wait' ? MAGIC_LINK_WAIT_MESSAGE : MAGIC_LINK_FAILED_MESSAGE;
}

export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}
