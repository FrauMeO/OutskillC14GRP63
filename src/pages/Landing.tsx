import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import WaitlistForm from '../components/WaitlistForm';
import InstallButton from '../components/InstallButton';
import { PILLARS, PILLAR_ORDER, PILLAR_PS, PILLAR_TAGLINE } from '../lib/pillars';

const primaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-spruce px-6 py-3 font-semibold text-mist transition-colors hover:bg-spruce-soft';
const secondaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-md px-4 py-3 font-semibold underline underline-offset-4';

const FEATURES = [
  {
    title: 'Log a day, your way',
    body: 'Note movement, steps, sleep, water, how you feel and a few words of your own. Fill in what you want. Leave the rest blank.',
  },
  {
    title: 'Notice your patterns',
    body: 'See today against your own goals, a week of trends, and what tends to go along with what, including the weather where you are. Always with the number of days behind it.',
  },
  {
    title: 'Goals that are yours',
    body: 'Set a goal, change it, or skip goals altogether. Nothing is graded, and a day you did not log is just a gap, never a mark against you.',
  },
];

const PROMISES = [
  'No insurer or medical provider is behind this app.',
  'No ads, ever. Free for everyone 60 and over.',
  'You choose how much to enter. Leave anything blank.',
  'Nothing is all-or-nothing.',
  'Download your data, or delete it, whenever you like.',
  'Any AI help sees your numbers, ratings and chosen feelings, never your notes, name or email.',
];

export default function Landing() {
  return (
    <PublicLayout title="Build Your Pillars: gentle health tracking, no judgment">
      <section className="bg-spruce text-mist">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-5xl font-bold leading-[0.98] tracking-tight sm:text-7xl">
            {PILLAR_ORDER.map((key) => (
              <span key={key} className="block">
                {PILLARS[key].name}.
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-xl text-mist">{PILLAR_TAGLINE}</p>
          <p className="mt-1 max-w-xl italic text-mist/90">{PILLAR_PS}</p>
          <p className="mt-6 max-w-2xl text-mist">
            A gentle place to notice how you are eating, sleeping, moving and feeling, and to share that with the people who care about you.
            No scores, no shame.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              to="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-mist px-6 py-3 font-semibold text-spruce transition-colors hover:bg-white"
            >
              Create your account
            </Link>
            <Link to="/login" className={`${secondaryLink} text-mist`}>
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="who" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="who" className="font-display text-3xl font-bold tracking-tight">
          Who it is for
        </h2>
        <p className="mt-4 max-w-2xl">
          Adults 50 and over, and the people who care about them. And anyone who has found health apps a little shaming. Build Your Pillars
          is a counter to that. It helps you notice your own patterns with curiosity, not measure yourself against someone else&apos;s standard.
        </p>
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <h2 id="pillars" className="font-display text-3xl font-bold tracking-tight">
          Four pillars
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILLAR_ORDER.map((key) => {
            const p = PILLARS[key];
            return (
              <li key={key} className="rounded-lg border border-line bg-white p-5" style={{ borderTopColor: p.color, borderTopWidth: 6 }}>
                <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                <p className="mt-1">{key === 'wellbeing' ? 'Balance is your mental health: stress, mood and how you feel.' : p.subtitle}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="features" className="border-y border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="features" className="font-display text-3xl font-bold tracking-tight">
            What you can do today
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3 className="font-display text-2xl font-bold">{f.title}</h3>
                <p className="mt-2">{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <strong>Share with someone you trust:</strong> invite a partner or caregiver by email. They see only the pillars you tick, as a
            read-only view, and you can end it any time.
          </p>
          <p className="mt-4">
            <strong>Coming soon:</strong> syncing with Apple Health and Google Health Connect.
          </p>
        </div>
      </section>

      <section aria-labelledby="privacy" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="privacy" className="font-display text-3xl font-bold tracking-tight">
          Our promise to you
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {PROMISES.map((text) => (
            <li key={text} className="rounded-lg border border-line bg-white px-5 py-4">
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-6">
          <Link to="/why" className="font-semibold underline underline-offset-4">
            Read why we built it
          </Link>
        </p>
      </section>

      <section aria-labelledby="pricing" className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="pricing" className="font-display text-3xl font-bold tracking-tight">
            What it costs
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            <li className="rounded-lg border border-line px-5 py-4">
              <h3 className="font-display text-2xl font-bold">Free</h3>
              <p className="mt-2">For everyone 60 and over.</p>
            </li>
            <li className="rounded-lg border border-line px-5 py-4">
              <h3 className="font-display text-2xl font-bold">$2.99 a month</h3>
              <p className="mt-2">For everyone under 60. Free while we are in beta.</p>
            </li>
            <li className="rounded-lg border border-line px-5 py-4">
              <h3 className="font-display text-2xl font-bold">$34.99 a year</h3>
              <p className="mt-2">For a caregiver, and only when the older person has said yes to sharing.</p>
            </li>
          </ul>
          <p className="mt-6">
            We ask only for the month and year you were born, never the day, to work out your plan.
          </p>
        </div>
      </section>

      <section aria-labelledby="install" className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="install" className="font-display text-3xl font-bold tracking-tight">
            Add to your phone
          </h2>
          <p className="mt-4 max-w-2xl">
            Keep Build Your Pillars on your home screen like any other app. It opens full screen, with nothing to download from a store.
          </p>
          <div className="mt-6">
            <InstallButton />
          </div>
          <div className="mt-8">
            <WaitlistForm compact />
          </div>
        </div>
      </section>

      <section aria-labelledby="start" className="bg-spruce text-mist">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6">
          <h2 id="start" className="font-display text-3xl font-bold tracking-tight">
            Ready when you are
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/signup" className={`${primaryLink} !bg-mist !text-spruce hover:!bg-white`}>
              Create your account
            </Link>
            <Link to="/login" className={`${secondaryLink} text-mist`}>
              Log in
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
