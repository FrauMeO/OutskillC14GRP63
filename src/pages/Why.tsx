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
            We are a husband and wife. Bob is 72 and Miah is 60, and we wanted a simple, warm way to notice our days and stay connected.
          </p>
          <p>
            At 60, Miah learned to build software with Claude without a traditional coding background. Build Your Pillars began as her
            project in a 48-hour hackathon.
          </p>
          <p>
            We move in tandem with the world around us, like dance partners. Daylight shifts, weather changes, the moon waxes and wanes,
            and tides come and go. Our bodies and feelings have rhythms too. Miah wanted to build a place where we could notice those
            relationships with curiosity and discover our own answers over time.
          </p>
          <p>
            Build Your Pillars rests on four everyday pillars: Drink, Sleep, Move and Balance. Notice how much you drink, sleep and move,
            then reflect on the balance in your life—your feelings and mood—with curiosity and kindness.
          </p>
          <p>
            Your journey can stay private, a quiet conversation with yourself. Or you can share selected pillars with someone special and
            create space for them to love you back with warmth, encouragement and care. You choose what they see and can pause or end
            sharing whenever you like.{' '}
            <Link to="/sharing" className="font-semibold underline underline-offset-4">
              Read how sharing works
            </Link>
            .
          </p>
          <p>
            We kept it independent on purpose. There is no insurer or medical provider behind it and there are no ads. Your information
            can be downloaded or deleted whenever you wish.
          </p>
          <p>{OFFER_LINE}</p>
          <p>
            Move to your own beat. Flow with your own rhythm. Enjoy what feels good and notice what doesn&apos;t. Let curiosity be your coach.
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
