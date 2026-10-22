import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { COMPANY, copyrightLine } from '../lib/company';
import { CONTACT_EMAIL } from '../lib/waitlist';
import { FOOTER_FOUNDERS } from '../lib/about';
import { CANONICAL_DESCRIPTION, FOOTER_SIGNATURE } from '../lib/brandCopy';

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
            <span className="font-semibold">Your health information is private to you.</span> Read how we handle it in our
            <Link to="/health-data-privacy" className="mt-1 block w-fit py-1 font-semibold leading-snug underline underline-offset-4">
              Consumer Health &amp; Data
              <br />
              Privacy Policy
            </Link>
          </p>
          <p className="max-w-2xl text-base text-moss">
            Build Your Pillars is for reflection. It is not medical advice and it does not diagnose anything.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
            <Link to="/sharing" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              How sharing works
            </Link>
            {/* Sharing is set up in Settings; a signed-out visitor is sent to log in first. */}
            <Link
              to="/settings#sharing"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-spruce px-5 py-2 font-semibold text-mist transition-colors hover:bg-spruce-soft"
            >
              Ok, let&rsquo;s share
            </Link>
          </div>
          <p className="text-base">
            <Link to="/why" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Why build another new app?
            </Link>
          </p>
          {/* Credits: names at 14px, the legal entity and address in very small print, the feedback button beside them. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-10 gap-y-3">
            <div className="text-left text-moss">
              <p className="text-xs">Made by {FOOTER_FOUNDERS}.</p>
              <address className="mt-1 text-[0.75rem] not-italic leading-snug">
                {COMPANY.legalName}
                <br />
                {COMPANY.street}
                <br />
                {COMPANY.city}, {COMPANY.region} {COMPANY.postalCode}, {COMPANY.country}
              </address>
              <p className="mt-1 text-[0.75rem] leading-snug">{copyrightLine()}</p>
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              aria-label="We'd love your feedback"
              className="inline-flex min-h-11 flex-col items-center justify-center rounded-md border-2 border-spruce bg-white px-5 py-2 text-center text-sm font-semibold leading-tight hover:bg-mist"
            >
              <span aria-hidden="true" className="inline-flex items-center gap-1">
                We&rsquo;d
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#E0242F">
                  <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.7 0 5.7 4 4.2 7.3C19.5 16.4 12 21 12 21z" />
                </svg>
              </span>
              <span aria-hidden="true">your feedback</span>
            </a>
          </div>
          {/* The footer signature, then, after a wide gap, the small two-line link to privacy and how we work. */}
          <p className="mt-6 text-left text-sm italic text-moss">{FOOTER_SIGNATURE}</p>
          <p className="mt-10 text-left text-xs">
            <Link to="/privacy" className="inline-block py-2 font-semibold leading-snug underline underline-offset-4">
              Privacy in this app.
              <br />
              How we work
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
