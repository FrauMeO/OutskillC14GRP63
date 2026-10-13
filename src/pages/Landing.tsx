import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import WaitlistForm from '../components/WaitlistForm';
import InstallButton from '../components/InstallButton';
import { PILLARS, PILLAR_ORDER } from '../lib/pillars';
import { HERO_LINE, HOME_TITLE, LEAD_CLAIM, OFFER_LINE } from '../lib/brandCopy';

const primaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-spruce px-6 py-3 font-semibold text-mist transition-colors hover:bg-spruce-soft';
const secondaryLink =
  'inline-flex min-h-12 items-center justify-center rounded-md px-4 py-3 font-semibold underline underline-offset-4';

const EVERYDAY = [
  {
    title: 'Log a day, your way',
    body: 'Note your water, sleep, movement, how you feel and a few words of your own. Fill in what you want. Leave the rest blank.',
  },
  {
    title: 'Notice your patterns',
    body: 'See today against your own goals, a week of trends, and what tends to go along with what, including the weather where you are. Always with the number of days behind it.',
  },
  {
    title: 'Goals that are yours',
    body: 'Set a goal, change it, or skip goals altogether. Nothing is graded, and a Day off is just a Day off.',
  },
];

const SHARING_STEPS = [
  { title: 'You invite', body: 'Pick one person you trust. They have to say yes before they see anything.' },
  { title: 'You choose', body: 'Tick the pillars you want to share, and how much they see. It is a read-only view.' },
  { title: 'You can pause or stop', body: 'Any time, and it takes effect straight away. You can invite them again later.' },
];

const CONTROLS = [
  'No insurer or medical provider is behind this app.',
  'No ads.',
  'You choose how much to enter. Leave anything blank.',
  'Download your data, or delete it, whenever you like.',
  'Any AI help sees your numbers, ratings and chosen feelings, never your notes, name or email.',
];

export default function Landing() {
  return (
    <PublicLayout title={HOME_TITLE}>
      <section className="bg-spruce text-mist">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{HERO_LINE}</h1>
          <p className="mt-6 max-w-2xl text-xl text-mist">{LEAD_CLAIM}</p>
          <p className="mt-4 max-w-2xl text-mist">
            Build Your Pillars is gentle, private self-tracking for adults 50 and over, and the people who care about them.
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

      <section aria-labelledby="everyday" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="everyday" className="font-display text-3xl font-bold tracking-tight">
          A gentle way to notice your days
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-3">
          {EVERYDAY.map((f) => (
            <li key={f.title}>
              <h3 className="font-display text-2xl font-bold">{f.title}</h3>
              <p className="mt-2">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sharing" className="border-y border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="sharing" className="font-display text-3xl font-bold tracking-tight">
            Sharing, on your terms
          </h2>
          <p className="mt-4 max-w-2xl">
            Sharing is for staying close. You decide who follows along, what they see, and for how long.
          </p>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {SHARING_STEPS.map((s) => (
              <li key={s.title} className="rounded-lg border border-line px-5 py-4">
                <h3 className="font-display text-2xl font-bold">{s.title}</h3>
                <p className="mt-2">{s.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link to="/sharing" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Read how sharing works
            </Link>
          </p>
          <p className="mt-2 max-w-2xl">
            Were you invited by someone? Create an account with the email address they used, and say yes when you are ready.
          </p>
        </div>
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="pillars" className="font-display text-3xl font-bold tracking-tight">
          Four pillars underneath
        </h2>
        <p className="mt-4 max-w-2xl">Drink. Sleep. Move. Balance. Four everyday pillars, always in that order.</p>
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

      <section aria-labelledby="control" className="border-y border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="control" className="font-display text-3xl font-bold tracking-tight">
            What you control about your data
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CONTROLS.map((text) => (
              <li key={text} className="rounded-lg border border-line bg-mist px-5 py-4">
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-6">
            <Link to="/why" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Read why we built it
            </Link>
          </p>
        </div>
      </section>

      <section aria-labelledby="offer" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="offer" className="font-display text-3xl font-bold tracking-tight">
          Where you can use it, and what it costs
        </h2>
        <p className="mt-4 max-w-2xl text-xl">{OFFER_LINE}</p>
        <p className="mt-4 max-w-2xl">
          We ask only for the month and year you were born, never the day, to know which one applies.
        </p>
        <p className="mt-4 max-w-2xl">
          It works in your web browser today, on a phone, tablet or computer. You can keep it on your home screen like any other app. The
          App Store and Google Play apps are not ready yet.
        </p>
        <div className="mt-6">
          <InstallButton />
        </div>
        <div className="mt-8">
          <WaitlistForm compact />
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
