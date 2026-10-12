import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { ABOUT_STORY, foundersLine } from '../lib/about';

export default function Why() {
  return (
    <PublicLayout title="Why we built it | Build Your Pillars">
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Why we built it</h1>
        <p className="mt-3 text-spruce/85">By {foundersLine()}</p>

        <div className="mt-8 space-y-5">
          <p>
            We are a husband and wife. Robert is 72 and Miah is 60, and we wanted a simple way to share our health journey together,
            without confusion and without pressure.
          </p>
          <p>
            We looked around, and many health tools felt like a report card. Numbers turned into verdicts. Missed days turned into red marks.
            That is not how we wanted to look after ourselves, or each other.
          </p>
          <p>
            So we made something different. Build Your Pillars is built on four everyday pillars: Eat, Sleep, Move and Balance, which is
            our word for mental health. You log what you choose, you set goals only if you want them, and you look back with curiosity
            instead of judgment.
          </p>
          <p>
            We kept it independent on purpose. There is no insurer or medical provider behind it, no ads, and it is free for everyone 60 and over. You decide how
            much to share, nothing is all-or-nothing, and your data can be downloaded or deleted whenever you wish.
          </p>
          <p>
            We believe change is hard, and you are worth the effort. Be gentle with yourself. Your future self is grateful for the care
            you give today.
          </p>
          <p className="font-display text-xl font-bold">
            Miah and Robert
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
