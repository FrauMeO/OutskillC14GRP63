import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { ABOUT_STORY, foundersLine } from '../lib/about';
import { OFFER_LINE } from '../lib/brandCopy';
import { routeTitle } from '../lib/siteMeta';

export default function Why() {
  return (
    <PublicLayout title={routeTitle('/why')}>
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Why we built it</h1>
        <p className="mt-3 text-moss">By {foundersLine()}</p>

        <div className="mt-8 space-y-5">
          <p>
            We are a husband and wife. Bob is 72 and Miah is 60, and we wanted a simple way to follow each other&apos;s days,
            without confusion and without pressure.
          </p>
          <p>
            We looked around, and many health tools felt like a report card. Numbers turned into verdicts. Days without an entry turned
            into red marks. Many caregiver tools watch people without asking them first. That is not how we wanted to look after
            ourselves, or each other.
          </p>
          <p>
            So here, sharing starts with the older person. You invite someone you trust, you choose the pillars and how much they see,
            and you can pause or stop whenever you like.{' '}
            <Link to="/sharing" className="font-semibold underline underline-offset-4">
              Read how sharing works
            </Link>
            .
          </p>
          <p>
            Build Your Pillars rests on four everyday pillars: Drink, Sleep, Move and Balance, which is our word for mental health. You log what you
            choose, you set goals only if you want them, and you look back with curiosity instead of judgment.
          </p>
          <p>
            We kept it independent on purpose. There is no insurer or medical provider behind it and there are no ads. Nothing is
            all-or-nothing, and your data can be downloaded or deleted whenever you wish.
          </p>
          <p>{OFFER_LINE}</p>
          <p>
            We believe change is hard, and you are worth the effort. Be gentle with yourself. Your future self is grateful for the care
            you give today.
          </p>
          <p className="font-display text-xl font-bold">
            Bob and Miah
          </p>
        </div>

        <aside aria-label="In short" className="mt-10 rounded-lg border border-line bg-white p-5">
          <h2 className="font-display text-2xl font-bold">In short</h2>
          <p className="mt-2">{ABOUT_STORY}</p>
        </aside>

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/signup"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-spruce px-6 py-3 font-semibold text-mist transition-colors hover:bg-spruce-soft"
          >
            Create your account
          </Link>
          <Link to="/" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Back to the start
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}
