import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import WaitlistForm from '../components/WaitlistForm';
import InstallButton from '../components/InstallButton';
import { PILLARS, PILLAR_ORDER, PILLAR_TAGLINE } from '../lib/pillars';
import { HERO_LINE, HOME_TITLE, OFFER_LINE } from '../lib/brandCopy';

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
    body: 'Set a goal, change it, or simply follow your own rhythm. A Day off gives the story of your week room to breathe.',
  },
];

export default function Landing() {
  return (
    <PublicLayout title={HOME_TITLE}>
      <section className="bg-spruce text-mist">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-[1.25fr_0.75fr] md:items-center">
          <div>
            <p className="font-display text-xl font-bold text-mist/90">{PILLAR_TAGLINE}</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{HERO_LINE}</h1>
            <p className="mt-6 max-w-2xl text-xl text-mist">
              Celebrate the life you are living. Notice your water, sleep, movement and balance with curiosity, kindness and reflection.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                to="/signup"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-mist px-6 py-3 font-semibold text-spruce transition-colors hover:bg-white"
              >
                Try Build Your Pillars
              </Link>
              <Link to="/login" className={`${secondaryLink} text-mist`}>
                Log in
              </Link>
            </div>
          </div>
          <ul aria-label="The four pillars" className="grid grid-cols-2 gap-3">
            {PILLAR_ORDER.map((key) => {
              const pillar = PILLARS[key];
              return (
                <li key={key} className="rounded-xl bg-mist p-4 text-spruce" style={{ borderTop: `8px solid ${pillar.color}` }}>
                  <p className="font-display text-2xl font-bold">{pillar.name}</p>
                  <p className="mt-1 text-base">{pillar.subtitle}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="for-you" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="for-you" className="font-display text-3xl font-bold tracking-tight">
          What helps you feel good?
        </h2>
        <p className="mt-4 max-w-3xl text-xl">
          Build Your Pillars gives you a quiet place to discover your own answer. Follow your rhythm, celebrate what feels good and
          return whenever curiosity brings you back. Every day adds to the story in its own way.
        </p>
      </section>

      <section aria-labelledby="everyday" className="border-y border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="everyday" className="font-display text-3xl font-bold tracking-tight">
            Notice with curiosity
          </h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {EVERYDAY.map((f) => (
              <li key={f.title} className="rounded-xl bg-mist p-5">
                <h3 className="font-display text-2xl font-bold">{f.title}</h3>
                <p className="mt-2">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h2 id="pillars" className="font-display text-3xl font-bold tracking-tight">
          Four parts of your whole life
        </h2>
        <p className="mt-4 max-w-2xl">Drink. Sleep. Move. Balance. Notice each pillar on its own, then discover how they move together across your days.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {PILLAR_ORDER.map((key) => {
            const p = PILLARS[key];
            return (
              <li key={key} className="rounded-lg border border-line bg-white p-5" style={{ borderTopColor: p.color, borderTopWidth: 6 }}>
                <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                <p className="mt-1">{p.subtitle}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="sharing" className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 id="sharing" className="font-display text-3xl font-bold tracking-tight">
              Keep it close, or share it with someone special
            </h2>
            <p className="mt-4 max-w-2xl">
              Your journey can stay private and reflective. Or you can invite someone special to follow selected pillars and create space for
              them to love you back—with warmth, encouragement and care.
            </p>
            <p className="mt-3 max-w-2xl text-base text-moss">
              Both choices are complete. If you share, you decide what they see and can pause or end it whenever you want.
            </p>
          </div>
          <Link to="/sharing" className={`${primaryLink} whitespace-nowrap`}>
            How sharing works
          </Link>
        </div>
      </section>

      <section aria-labelledby="privacy" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
          <h2 id="privacy" className="font-display text-3xl font-bold tracking-tight">
            Your information stays yours
          </h2>
          <p className="mt-4 max-w-3xl">
            No ads. No insurer or medical provider behind the app. Enter only what you choose, and download or delete your information when
            you want.
          </p>
          <p className="mt-4">
            <Link to="/health-data-privacy" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Read the details
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
