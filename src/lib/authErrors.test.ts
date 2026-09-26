import { describe, expect, it } from 'vitest';
import { authProblem } from './authErrors';

describe('sign-in errors in plain words, with the next step', () => {
  it('wrong email or password points to resetting the password', () => {
    const p = authProblem({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 }, 'login')!;
    expect(p.text).toMatch(/do not match/);
    expect(p.actions).toContain('reset');
  });

  it('an email that already has an account points to logging in or resetting', () => {
    expect(authProblem({ code: 'user_already_exists', message: 'User already registered' }, 'signup')).toEqual({
      text: 'There is already an account for this email. Log in instead, or reset your password if you have forgotten it.',
      actions: ['login', 'reset'],
    });
    // Older servers send only the message (control: matched by the words, not the code).
    expect(authProblem({ message: 'User already registered' }, 'signup')!.actions).toEqual(['login', 'reset']);
  });

  it('rate limits, weak passwords, bad emails and lost connections read plainly', () => {
    expect(authProblem({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'signup')!.text).toMatch(/wait a few minutes/);
    expect(authProblem({ code: 'weak_password', message: 'Password should be at least 6 characters' }, 'signup')!.text).toMatch(/at least 6/);
    expect(authProblem({ code: 'email_address_invalid', message: 'Email address is invalid' }, 'signup')!.text).toMatch(/does not look right/);
    expect(authProblem({ message: 'Failed to fetch' }, 'login')!.text).toMatch(/connection/);
  });

  it('never hides an unknown error, and says nothing when there is none (control)', () => {
    expect(authProblem({ message: 'Something new' }, 'login')!.text).toBe('We could not log you in: Something new');
    expect(authProblem(null, 'login')).toBeNull();
  });
});
