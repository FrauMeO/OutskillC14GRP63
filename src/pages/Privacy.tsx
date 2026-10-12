import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { CONTACT_EMAIL } from '../lib/waitlist';

// Public Privacy Policy (route /privacy). Plain words, 18px text from PublicLayout.
// Every statement here was checked against the code; the evidence is in docs/gdpr-compliance.md.
// Anything uncertain lives in that document, not here.
// Standard: docs/privacy-standard.md (Washington My Health My Data Act for everyone, stricter foreign rule where it asks more).
// Health information has its own page: src/pages/HealthDataPrivacy.tsx (route /health-data-privacy).
// LEGAL REVIEW: the 30-day answer time and the minimum age (code now enforces 18, decided 2026-10-12).
// LEGAL REVIEW needed before launch: controller identity and address, the "18" age wording, the
// transfer wording, the supervisory-authority wording, retention wording for backups and the
// waitlist, and the Anthropic paragraph (check Anthropic's terms first).

export const PRIVACY_UPDATED = '12 October 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-4">
    {CONTACT_EMAIL}
  </a>
);

export default function Privacy() {
  return (
    <PublicLayout title="Privacy Policy | Build Your Pillars">
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-spruce/85">Last updated {PRIVACY_UPDATED}</p>
        <p className="mt-6">
          This page explains, in plain words, what Build Your Pillars keeps about you, why, who else handles it, and what you can do
          about it. Your health information is private to you unless you choose to share it.
        </p>

        <p className="mt-4 rounded-lg border border-line bg-white p-5">
          <strong>Your health information has its own page.</strong> Read the{' '}
          <Link to="/health-data-privacy" className="font-semibold underline underline-offset-4">
            Consumer Health Data Privacy Policy
          </Link>{' '}
          for exactly what health information we keep, who receives it, and how to use your rights. We follow it for everyone, wherever
          you live. If the two pages ever differ, the stricter one applies.
        </p>

        <nav aria-label="On this page" className="mt-6 rounded-lg border border-line bg-white p-5">
          <p className="font-display text-xl font-bold">On this page</p>
          <ul className="mt-2 space-y-1">
            {[
              ['who', 'Who we are'],
              ['collect', 'What we collect and why'],
              ['health', 'Health information and your consent'],
              ['ai', 'AI help'],
              ['weather', 'Weather and rounded location'],
              ['others', 'Who else handles your data'],
              ['transfers', 'Where it is stored'],
              ['keep', 'How long we keep it'],
              ['rights', 'Your rights'],
              ['sharing', 'Sharing with another person'],
              ['browser', 'Cookies and browser storage'],
              ['security', 'Security'],
              ['children', 'Children'],
              ['changes', 'Changes to this policy'],
              ['complain', 'Complaints'],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="who" title="Who we are">
          <p>
            Build Your Pillars is run by Miah Shull Olmsted and Robert Olmsted, a husband and wife. We decide why and how your
            information is used, which makes us the &ldquo;controller&rdquo; of your data under privacy laws such as the EU&rsquo;s GDPR.
          </p>
          <p>
            You can reach us at {mail}. {/* LEGAL REVIEW: add the legal entity name and a postal address here. */}
          </p>
        </Section>

        <Section id="collect" title="What we collect and why">
          <p>We keep only what you give us or choose to log.</p>
          <Bullets
            items={[
              <>
                <strong>Your account:</strong> your email address, your password (handled by our sign-in provider, Supabase), your
                name, and, if you choose, a home city. We use these to run your account and to show the right weather and help lines for
                your country.
              </>,
              <>
                <strong>What you log:</strong> exercise, steps, standing hours, sleep, water, calories, notes, and your mood, energy,
                stress and feelings. We use these to show your days, trends and goals.
              </>,
              <>
                <strong>Where you were:</strong> a city name and a map position rounded to about 11 kilometres, for each day you log.
              </>,
              <>
                <strong>Your goals:</strong> the goals you set, if any.
              </>,
              <>
                <strong>Gentle check-ins:</strong> the dates a check-in was offered or taken, and the scores if you choose to answer.
                Your written words are never stored there.
              </>,
              <>
                <strong>Sharing:</strong> if you invite someone, the email address you type and which pillars you chose.
              </>,
              <>
                <strong>The waiting list:</strong> if you join it, your email address and which store you want. You do not need an account
                for this.
              </>,
            ]}
          />
          <p>
            We use this to run the service you asked for. We do not sell your data, use it for advertising, or build a profile to sell
            to anyone.
          </p>
        </Section>

        <Section id="health" title="Health information and your consent">
          <p>
            What you log about your sleep, movement, eating, mood, energy, stress, feelings and check-ins is health information. Privacy
            laws treat it as especially sensitive. We keep it only with your clear, explicit agreement, which you give by ticking a box
            when you create your account (it is not hidden inside these pages). Sharing it with another person, and AI help, each ask for
            a separate yes of their own. You can take your agreement back at any time by deleting entries or your whole account (see
            Your rights).
          </p>
          <p>
            You choose what to log. Nothing is required except an email address and a password to have an account.
          </p>
        </Section>

        <Section id="ai" title="AI help">
          <p>
            Build Your Pillars can write a short, kind reflection on your day or your week. This only happens when you ask for it, or
            when you switch on the automatic option in Settings (it is off until you switch it on). If this feature is not shown to
            you, nothing is sent.
          </p>
          <p>When a reflection is written, we send the following to Claude, an AI model made by Anthropic:</p>
          <Bullets
            items={[
              'The date.',
              'What you logged that day, as plain sentences: water, calories eaten, sleep, time in bed, time awake, exercise, steps, standing hours and active calories.',
              'Your mood, energy and stress, as words such as “mood okay” or “stress high”, and the feelings you picked.',
              'For the weekly note: the same for the last seven days, plus the goals you set.',
            ]}
          />
          <p>
            We do <strong>not</strong> send your name, email address, notes, location, weather, or any gentle check-in answers.
          </p>
          <p>
            On a hard day, for example very low mood, or low mood together with high stress, we do not send anything. You get a fixed,
            caring message instead.
          </p>
          <p>
            We do not save the reflection or what was sent. It is shown to you and then gone when you reload the page. Anthropic
            processes the request to write the reply and handles it under its own terms and privacy policy.{' '}
            {/* LEGAL REVIEW: confirm Anthropic retention, training use, region and DPA before launch. */}
          </p>
          <p>The reflection is a kind note, not medical advice, and it does not make any decision about you.</p>
        </Section>

        <Section id="weather" title="Weather and rounded location">
          <p>To show the weather for each day you log, your browser contacts two outside services directly:</p>
          <Bullets
            items={[
              <>
                <strong>Open-Meteo</strong> (weather, air quality and city search). It receives your rounded map position, the dates
                needed, the city name you type into the search, and your device&rsquo;s internet address (IP address).
              </>,
              <>
                <strong>BigDataCloud</strong> (turns a rounded position into a city name). It is used only when you log today and allow
                your device to share its location. It receives the rounded position and your IP address.
              </>,
            ]}
          />
          <p>
            Your device only shares its location if your browser asks and you say yes. We round it to about 11 kilometres before using
            or saving it. If you say no, we use your home city instead, or no place at all. Saving a day never depends on location.
          </p>
        </Section>

        <Section id="others" title="Who else handles your data">
          <Bullets
            items={[
              <>
                <strong>Supabase</strong> (United States): stores your account and everything you log, and provides sign-in.
              </>,
              <>
                <strong>Vercel</strong> (United States): hosts this website. Like any host, it sees the internet address and browser type
                of visitors.
              </>,
              <>
                <strong>Anthropic</strong> (United States): writes AI reflections, only as described above.
              </>,
              <>
                <strong>Open-Meteo</strong> and <strong>BigDataCloud</strong>: weather and city names, only as described above.
              </>,
            ]}
          />
          <p>
            We do not share your data with advertisers, insurers, employers or health providers. If you choose to share with another
            person, see Sharing with another person below.
          </p>
          <p>{/* LEGAL REVIEW: confirm processor agreements are signed with each provider. */}</p>
        </Section>

        <Section id="transfers" title="Where it is stored">
          <p>
            Your account and everything you log is stored with Supabase in the United States (east coast). If you live outside the
            United States, that means your data is sent to the United States. Outside services listed above are also based in, or
            reachable from, the United States.
          </p>
          <p>
            For people in Europe, we are putting in place the safeguards the law asks for when data leaves the EU, such as the
            standard contractual clauses and certification under the EU-US Data Privacy Framework where a provider has it.{' '}
            {/* LEGAL REVIEW: this wording must match the agreements actually signed. Confirm before launch. */}
          </p>
        </Section>

        <Section id="keep" title="How long we keep it">
          <Bullets
            items={[
              'Your account and everything you logged: until you delete it. We do not delete your entries on a timer.',
              'Waiting list emails: until the app launches plus a short time afterwards, or sooner if you ask us to remove yours.',
              'The AI reflection: we do not keep it.',
              'When you delete your account, we delete your sign-in, your profile, your logs, goals, weather records, check-ins and sharing records. Our database provider may keep short-lived backup copies for a limited time before they expire.',
            ]}
          />
        </Section>

        <Section id="rights" title="Your rights and how to use them">
          <p>You can do all of these from the app, or by emailing {mail}. We answer within 30 days. If we need more time we will tell you
            why, and take no more than 30 extra days. If you disagree with an answer, you can appeal; see the{' '}
            <Link to="/health-data-privacy#appeal" className="font-semibold underline underline-offset-4">
              Consumer Health Data Privacy Policy
            </Link>
            .</p>
          <Bullets
            items={[
              <>
                <strong>See and take your data:</strong> in Settings, choose &ldquo;Download all my data&rdquo;. You get a file you can
                keep and take elsewhere.
              </>,
              <>
                <strong>Correct it:</strong> change your name and home city in Settings, and edit any day you logged.
              </>,
              <>
                <strong>Delete it:</strong> in Settings, choose &ldquo;Delete my account&rdquo;. You can also delete your reflection
                history on its own.
              </>,
              <>
                <strong>Switch off AI help:</strong> in Settings, turn off &ldquo;Use AI help for reflections&rdquo;. Nothing is sent after
                that.
              </>,
              <>
                <strong>Switch off gentle check-ins:</strong> in Settings.
              </>,
              <>
                <strong>End sharing:</strong> in Settings, end any share at any time.
              </>,
              <>
                <strong>Limit or object to how we use your data, or take back your consent:</strong> email us. Taking back consent does
                not affect what was done before.
              </>,
              <>
                <strong>Leave the waiting list:</strong> email us and we will remove your address.
              </>,
            ]}
          />
        </Section>

        <Section id="sharing" title="Sharing with another person">
          <p>
            You can invite someone, such as a partner or a caregiver, to follow your pillars. It is your choice, and you can end it
            whenever you like.
          </p>
          <Bullets
            items={[
              'They see only the pillars you tick, and only for days you logged. You choose how much: just that you logged, a weekly summary in words, or day-by-day detail. It is read-only.',
              'Your notes, feelings list, locations and gentle check-in answers are never shared. Mood, energy and stress scores are shared only if you tick Balance.',
              'They also see your name, so they know whose pillars they are looking at.',
              'We keep the email address you enter so that the invitation matches the person when they log in. We do not send them an email ourselves, so please tell them yourself.',
              'When you end a share, they lose access straight away. We keep a short record that it ended, including that email address, until you delete your account.',
            ]}
          />
        </Section>

        <Section id="browser" title="Cookies and browser storage">
          <p>
            Our app does not set cookies of its own. Your browser keeps your sign-in session so you stay signed in. That is strictly
            necessary, and it is removed when you sign out. If you answer the question about AI help, your browser also keeps that one
            answer (yes or no, with the date), so we do not ask again.
          </p>
          <p>
            Build Your Pillars does not contain advertising, analytics or tracking tools. Our website host and the outside services
            listed above may log technical details such as your internet address when your browser contacts them.
          </p>
        </Section>

        <Section id="security" title="Security">
          <Bullets
            items={[
              'Each person can only read and change their own rows. This is enforced inside the database itself (row-level security), not only in the app.',
              'The waiting list cannot be read from the app at all.',
              'Information travels between your device and our services over secure (HTTPS) connections.',
            ]}
          />
          <p>No online service is perfectly secure. If something goes wrong that affects you, we will tell you.</p>
        </Section>

        <Section id="children" title="Children">
          <p>
            Build Your Pillars is not for anyone under 18. Please do not create an account if you are under 18. If we learn that we
            hold data from someone under 18, we will delete it.{' '}
            {/* LEGAL REVIEW: confirm 18 (Miah, 2026-10-12) and the wording for each target country. */}
          </p>
        </Section>

        <Section id="changes" title="Changes to this policy">
          <p>
            If we change how we use your data, we will update this page and its date, and tell you in the app before the change
            starts if it matters to you. Earlier versions are available if you email us.
          </p>
        </Section>

        <Section id="complain" title="Complaints">
          <p>
            Please talk to us first at {mail}; we will do our best to put things right. You also have the right to complain to your
            local data protection authority, for example the authority in the EU country where you live or work, the Office of the
            Privacy Commissioner of Canada, or the Washington State Attorney General (see the{' '}
            <Link to="/health-data-privacy#appeal" className="font-semibold underline underline-offset-4">
              Consumer Health Data Privacy Policy
            </Link>
            ).{' '}
            {/* LEGAL REVIEW: list the right authority for each target country. */}
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/terms" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Read the terms of use
          </Link>
          <Link to="/" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Back to the start
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}
