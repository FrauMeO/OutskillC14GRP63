import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CityPicker from '../components/CityPicker';
import AuthShell from '../components/AuthShell';
import SignupWelcome from '../components/SignupWelcome';
import WaitlistForm from '../components/WaitlistForm';
import { authProblem, type AuthProblem } from '../lib/authErrors';
import { birthYearOptions, MIN_AGE, MONTHS, validateBirth, validateDisplayName } from '../lib/signup';
import { PENDING_KEY, pendingMetadata, SIGNUP_CONSENT_ERROR, type PendingConsent } from '../lib/consent';
import { COLLECT_USE, consentHash, CURRENT_VERSION, EMAIL_MARKETING, LINK_TEXT } from '../lib/consentTexts';
import type { HomeCity } from '../lib/location';

type Mode = 'login' | 'signup';

const COPY: Record<Mode, { title: string; action: string; busy: string }> = {
  login: { title: 'Log in', action: 'Log in', busy: 'Logging in…' },
  signup: { title: 'Create your account', action: 'Create account', busy: 'Creating account…' },
};

const inputClass =
  'mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce placeholder:text-moss focus:border-current focus:outline-none';

export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [fullName, setFullName] = useState('');
  const [home, setHome] = useState<(HomeCity & { label: string }) | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthProblem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [healthConsent, setHealthConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);
      if (err) return setError(authProblem(err, 'login'));
      navigate(from, { replace: true });
      return;
    }

    const nameCheck = validateDisplayName(fullName);
    if (!nameCheck.ok) {
      setSubmitting(false);
      return setError({ text: nameCheck.message, actions: [] });
    }
    const today = new Date();
    const birth = validateBirth(birthMonth ? Number(birthMonth) : null, birthYear ? Number(birthYear) : null, today);
    if (!birth.ok) {
      setSubmitting(false);
      return setError({ text: birth.message, actions: [] });
    }

    // Two separate, unticked choices (docs/privacy-consent-spec.md). The ledger cannot be written
    // until there is a session, so the choices travel in the sign-up metadata and are recorded
    // once, after the first sign-in (PendingConsentRecorder).
    if (!healthConsent) {
      setSubmitting(false);
      return setError({ text: SIGNUP_CONSENT_ERROR, actions: [] });
    }
    const choices: PendingConsent[] = [{ kind: 'collect_use', version: CURRENT_VERSION.collect_use, hash: await consentHash('collect_use') }];
    if (marketing) choices.push({ kind: 'email_marketing', version: CURRENT_VERSION.email_marketing, hash: await consentHash('email_marketing') });

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The sign-up trigger copies these into profiles; the city is optional.
        data: {
          full_name: nameCheck.name,
          birth_month: String(birth.month),
          birth_year: String(birth.year),
          // Consent is recorded by the sign-up trigger. Both are false unless ticked.
          health_consent: healthConsent ? 'true' : 'false',
          marketing_opt_in: marketing ? 'true' : 'false',
          // What exactly was agreed to (version and wording hash), written to the consent ledger after sign-in.
          [PENDING_KEY]: pendingMetadata(choices),
          ...(home && {
            home_city: home.city,
            home_country_code: home.countryCode,
            home_latitude: home.latitude,
            home_longitude: home.longitude,
          }),
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setSubmitting(false);
    if (err) return setError(authProblem(err, 'signup'));

    // With email confirmation on (the Supabase default), no session is returned yet.
    if (!data.session) {
      setNotice(`We sent a confirmation link to ${email}. Open it, then log in here.`);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  const copy = COPY[mode];

  return (
    <AuthShell title={copy.title} intro={mode === 'signup' ? <SignupWelcome /> : undefined}>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
        {mode === 'signup' && (
          <label className="block text-sm font-medium">
            What should we call you?
            <input
              className={inputClass}
              type="text"
              autoComplete="nickname"
              maxLength={40}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-describedby="name-help"
            />
            <span id="name-help" className="mt-1.5 block text-xs text-moss">
              One name only, like Sam. It does not need to be your real name, and please do not use your full name.
            </span>
          </label>
        )}

        {mode === 'signup' && (
          <fieldset>
            <legend className="text-sm font-medium">Month and year you were born</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <select
                aria-label="Birth month"
                className={inputClass.replace('mt-1.5', 'mt-0')}
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                required
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Birth year"
                className={inputClass.replace('mt-1.5', 'mt-0')}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                required
              >
                <option value="">Year</option>
                {birthYearOptions(new Date()).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <span className="mt-1.5 block text-xs text-moss">
              You must be {MIN_AGE} or older. Only the month and year, never the day. We use it to work out your plan, nothing else.
            </span>
          </fieldset>
        )}

        {mode === 'signup' &&
          (home ? (
            <div className="text-sm">
              <span className="font-medium">Home city</span>
              <p className="mt-1.5 flex items-center justify-between rounded-md border border-line bg-white px-3 py-2.5">
                {home.label}
                <button type="button" className="text-moss underline underline-offset-4" onClick={() => setHome(null)}>
                  Change
                </button>
              </p>
            </div>
          ) : (
            <div>
              <CityPicker label="Home city (optional)" onPick={setHome} />
              <span className="mt-1.5 block text-xs text-moss">
                Used for local weather on days you do not share your location. You can add it later in Settings.
              </span>
            </div>
          ))}

        <label className="block text-sm font-medium">
          Email
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-sm font-medium">
          Password
          <input
            className={inputClass}
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && (
            <span className="mt-1.5 block text-xs text-moss">At least 8 characters.</span>
          )}
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="h-5 w-5 accent-spruce"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
          />
          Show password
        </label>
        {mode === 'signup' && (
          <fieldset className="space-y-4 text-lg">
            <legend className="sr-only">Your choices</legend>
            {/* Two separate choices, both unticked. The words and their hash are recorded in the consent ledger. */}
            <div className="rounded-md border border-line bg-white p-4">
              <h2 className="font-display text-xl font-bold">{COLLECT_USE.heading}</h2>
              <p className="mt-2">
                {COLLECT_USE.body.split(LINK_TEXT)[0]}
                <a href="/health-data-privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                  {LINK_TEXT}
                </a>
                {COLLECT_USE.body.split(LINK_TEXT)[1]}
              </p>
              <label className="mt-3 flex min-h-11 items-start gap-3">
                <input
                  type="checkbox"
                  required
                  checked={healthConsent}
                  onChange={(e) => setHealthConsent(e.target.checked)}
                  className="mt-1 size-6 shrink-0 accent-spruce"
                />
                <span>{COLLECT_USE.label}</span>
              </label>
            </div>
            <div className="rounded-md border border-line bg-white p-4">
              <label className="flex min-h-11 items-start gap-3">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 size-6 shrink-0 accent-spruce"
                />
                <span>
                  <span className="font-semibold">Optional. </span>
                  {EMAIL_MARKETING.label}
                </span>
              </label>
              <p className="mt-1 pl-9 text-base text-moss">{EMAIL_MARKETING.note}</p>
            </div>
          </fieldset>
        )}

        {mode === 'login' && (
          <p className="-mt-2 text-sm">
            <Link to="/forgot-password" state={{ email }} className="font-semibold text-spruce underline underline-offset-4">
              Forgot password?
            </Link>
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-md bg-alert/10 px-3 py-2 text-sm text-alert">
            <p>{error.text}</p>
            {error.actions.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-x-4 font-semibold">
                {error.actions.includes('login') && (
                  <Link to="/login" className="underline underline-offset-4">
                    Log in
                  </Link>
                )}
                {error.actions.includes('reset') && (
                  <Link to="/forgot-password" state={{ email }} className="underline underline-offset-4">
                    Reset your password
                  </Link>
                )}
                {error.actions.includes('signup') && mode === 'login' && (
                  <Link to="/signup" className="underline underline-offset-4">
                    New here? Create an account
                  </Link>
                )}
              </p>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-md bg-current/10 px-3 py-2 text-sm text-current">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-spruce px-4 py-2.5 font-semibold text-mist transition-colors hover:bg-spruce-soft disabled:opacity-60"
        >
          {submitting ? copy.busy : copy.action}
        </button>
      </form>

      <p className="mt-6 text-sm text-moss">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <Link to="/signup" className="font-semibold text-spruce underline underline-offset-4">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-spruce underline underline-offset-4">
              Log in
            </Link>
          </>
        )}
      </p>

      {mode === 'signup' && (
        <div className="mt-10">
          <WaitlistForm />
        </div>
      )}
    </AuthShell>
  );
}
