import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { copyrightLine, postalAddress } from '../lib/company';
import { foundersLine } from '../lib/about';
import { CANONICAL_DESCRIPTION, SIGNATURE } from '../lib/brandCopy';

const linkClass =
  'inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-spruce underline-offset-4 hover:underline';

// Frame for the signed-out pages (landing, why we built it). Base text is 18px for older eyes.
export default function PublicLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session } = useAuth();

  useEffect(() => {
    document.title = title;
    // Keep the description tag in step when a person moves between public pages without a reload.
    document.querySelector('meta[name="description"]')?.setAttribute('content', CANONICAL_DESCRIPTION);
  }, [title]);

  return (
    <div className="flex min-h-screen flex-col bg-mist text-lg leading-relaxed text-spruce">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-md focus:bg-spruce focus:px-4 focus:py-3 focus:text-mist"
      >
        Skip to the main content
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
          <Link to="/" className="inline-flex min-h-11 items-center gap-3 rounded-md font-display text-xl font-bold tracking-tight">
            <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-lg" />
            Build Your Pillars
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center">
            <Link to="/#pillars" className={linkClass}>
              The four pillars
            </Link>
            <NavLink to="/why" className={linkClass}>
              Why we built it
            </NavLink>
            {session ? (
              <Link to="/dashboard" className={linkClass}>
                Open your dashboard
              </Link>
            ) : (
              <Link to="/login" className={linkClass}>
                Log in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {/* Washington My Health My Data Act (RCW 19.373.020): a prominent, separate link to the
              Consumer Health Data Privacy Policy on the homepage. This footer renders on the landing page. */}
          <p className="mb-5 max-w-2xl rounded-lg border border-line bg-mist px-5 py-4 text-base">
            <span className="font-semibold">Your health information is private to you.</span> Read how we handle it in our{' '}
            <Link to="/health-data-privacy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Consumer Health Data Privacy Policy
            </Link>
            .
          </p>
          <p className="max-w-2xl text-base text-moss">
            Build Your Pillars is for reflection. It is not medical advice and it does not diagnose anything.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-2 text-base">
            <Link to="/sharing" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              How sharing works
            </Link>
            <Link to="/why" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Why we built it
            </Link>
            <Link to="/signup" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Create your account
            </Link>
            <Link to="/login" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Log in
            </Link>
            <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Privacy
            </Link>
            <Link to="/health-data-privacy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Health data privacy
            </Link>
            <Link to="/terms" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Terms
            </Link>
          </p>
          <p className="mt-4 text-base text-moss">Made by {foundersLine()}.</p>
          <p className="text-base text-moss">{postalAddress()}</p>
          <p className="text-base text-moss">{copyrightLine()}</p>
          {/* The fixed signature: always last, never a heading. */}
          <p className="mt-4 text-base italic text-moss">{SIGNATURE}</p>
        </div>
      </footer>
    </div>
  );
}
