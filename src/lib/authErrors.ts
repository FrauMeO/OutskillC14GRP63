// Sign-in and sign-up errors in plain words, each with the next step (Miah, 2026-09-26: a
// teammate saw "Invalid login credentials" seven times and "User already registered" twice
// before finding the way back in). Pure, so it is unit tested.

export type AuthAction = 'reset' | 'login' | 'signup';
export type AuthProblem = { text: string; actions: AuthAction[] };

type ErrorLike = { code?: string | null; message?: string | null; status?: number | null } | null | undefined;

export function authProblem(err: ErrorLike, mode: 'login' | 'signup'): AuthProblem | null {
  if (!err) return null;
  const code = err.code ?? '';
  const message = err.message ?? '';
  const is = (c: string, pattern: RegExp) => code === c || pattern.test(message);

  if (is('invalid_credentials', /invalid login credentials/i)) {
    return { text: 'That email and password do not match. Check for a typo, or reset your password.', actions: ['reset', 'signup'] };
  }
  if (is('user_already_exists', /already registered|already exists/i)) {
    return { text: 'There is already an account for this email. Log in instead, or reset your password if you have forgotten it.', actions: ['login', 'reset'] };
  }
  if (is('email_not_confirmed', /email not confirmed/i)) {
    return { text: 'This email has not been confirmed yet. Open the confirmation link we sent, then log in.', actions: [] };
  }
  if (is('over_email_send_rate_limit', /rate limit/i) || code === 'over_request_rate_limit') {
    return { text: 'Too many tries in a short time. Please wait a few minutes and try again.', actions: [] };
  }
  if (is('weak_password', /password should be|weak password/i)) {
    return { text: 'Please choose a longer password: at least 6 characters.', actions: [] };
  }
  if (is('email_address_invalid', /invalid.*email|email.*invalid/i) || code === 'validation_failed') {
    return { text: 'That email address does not look right. Please check it.', actions: [] };
  }
  if (/fetch|network|failed to fetch/i.test(message)) {
    return { text: 'We could not reach the server. Check your connection and try again.', actions: [] };
  }
  return { text: mode === 'login' ? `We could not log you in: ${message}` : `We could not create your account: ${message}`, actions: [] };
}
