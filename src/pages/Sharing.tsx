import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { LEAD_CLAIM } from '../lib/brandCopy';
import { SHARING_FAQ, routeTitle } from '../lib/siteMeta';
import { PILLARS, PILLAR_ORDER } from '../lib/pillars';

// /sharing: public. The questions and answers come from SHARING_FAQ, the same list the FAQPage markup is built from.
export default function Sharing() {
  return (
    <PublicLayout title={routeTitle('/sharing')}>
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Sharing, on your terms</h1>
        <p className="mt-4 text-xl">{LEAD_CLAIM}</p>
        <p className="mt-4">
          You can let someone you trust follow along. You pick who, you pick what, and you can stop whenever you like. Here are the
          questions people ask first.
        </p>

        <div className="mt-10 space-y-8">
          {SHARING_FAQ.map((item) => (
            <section key={item.question}>
              <h2 className="font-display text-2xl font-bold tracking-tight">{item.question}</h2>
              <p className="mt-2">{item.answer}</p>
            </section>
          ))}
        </div>

        <section aria-labelledby="pillars-shared" className="mt-12">
          <h2 id="pillars-shared" className="font-display text-2xl font-bold tracking-tight">
            The four pillars you can share
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PILLAR_ORDER.map((key) => (
              <li key={key} className="rounded-lg border border-line bg-white px-4 py-3" style={{ borderTopColor: PILLARS[key].color, borderTopWidth: 5 }}>
                <span className="font-display text-xl font-bold">{PILLARS[key].name}</span>
                <span className="block">{key === 'wellbeing' ? 'Stress, mood and how you feel' : PILLARS[key].subtitle}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10">
          Your entries stay yours. You can download them or delete them any time. Read more in the{' '}
          <Link to="/health-data-privacy" className="font-semibold underline underline-offset-4">
            health data privacy policy
          </Link>
          .
        </p>

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
