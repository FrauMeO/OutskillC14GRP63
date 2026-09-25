import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CityPicker from '../components/CityPicker';
import type { HomeCity } from '../lib/location';

type Mode = 'login' | 'signup';

const COPY: Record<Mode, { title: string; action: string; busy: string }> = {
  login: { title: 'Log in', action: 'Log in', busy: 'Logging in…' },
  signup: { title: 'Create your account', action: 'Create account', busy: 'Creating account…' },
};

const inputClass =
  'mt-1.5 block w-full rounded-md border border-line bg-white px-3 py-2.5 text-spruce placeholder:text-sage focus:border-current focus:outline-none';

export default function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [fullName, setFullName] = useState('');
  const [home, setHome] = useState<(HomeCity & { label: string }) | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);
      if (err) return setError(err.message);
      navigate(from, { replace: true });
      return;
    }

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The sign-up trigger copies these into profiles; the city is optional.
        data: {
          full_name: fullName.trim(),
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
    if (err) return setError(err.message);

    // With email confirmation on (the Supabase default), no session is returned yet.
    if (!data.session) {
      setNotice(`We sent a confirmation link to ${email}. Open it, then log in here.`);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  const copy = COPY[mode];

  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.1fr]">
      <section className="hidden flex-col justify-end bg-spruce p-12 text-mist md:flex">
        <p className="font-display text-6xl font-bold leading-[0.95] tracking-tight">
          Sleep.
          <br />
          Water.
          <br />
          Movement.
        </p>
        <p className="mt-6 max-w-sm text-lg text-mist/75">
          Log the three daily habits that shape how you feel, and see your week at a glance.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold tracking-tight">{copy.title}</h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
            {mode === 'signup' && (
              <label className="block text-sm font-medium">
                Full name
                <input
                  className={inputClass}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
            )}

            {mode === 'signup' &&
              (home ? (
                <div className="text-sm">
                  <span className="font-medium">Home city</span>
                  <p className="mt-1.5 flex items-center justify-between rounded-md border border-line bg-white px-3 py-2.5">
                    {home.label}
                    <button type="button" className="text-spruce/70 underline underline-offset-4" onClick={() => setHome(null)}>
                      Change
                    </button>
                  </p>
                </div>
              ) : (
                <div>
                  <CityPicker label="Home city (optional)" onPick={setHome} />
                  <span className="mt-1.5 block text-xs text-spruce/60">
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
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signup' && (
                <span className="mt-1.5 block text-xs text-spruce/60">At least 6 characters.</span>
              )}
            </label>

            {error && (
              <p role="alert" className="rounded-md bg-alert/10 px-3 py-2 text-sm text-alert">
                {error}
              </p>
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

          <p className="mt-6 text-sm text-spruce/75">
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
        </div>
      </section>
    </div>
  );
}
