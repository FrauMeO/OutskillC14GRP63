import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { routeTitle } from '../lib/siteMeta';
import { CONTACT_EMAIL } from '../lib/waitlist';

// Consumer Health Data Privacy Policy (route /health-data-privacy). Plain words, 18px text from PublicLayout.
// Standard we follow (decision by Miah, 2026-10-12): Washington My Health My Data Act (chapter 19.373 RCW)
// for every user everywhere, and the stricter of GDPR, PIPEDA and India's DPDP Act where they ask for more.
// See docs/privacy-standard.md. We do NOT claim HIPAA compliance anywhere (HIPAA does not apply to us).
//
// LEGAL REVIEW needed before launch: the whole page. Especially: the 30-day answer time and the
// appeal wording, whether Supabase and Anthropic count as "processors", whether Open-Meteo and
// BigDataCloud count as third parties, the Stripe sentence, and the Washington Attorney General link.
//
// Evidence for each statement (file:line, checked 12 October 2026). Anything not verifiable in the
// code is listed under "Could not verify" in docs/privacy-standard.md, not stated here as fact.
//  - Account email, password, one display name: src/pages/AuthPage.tsx:103-119,180-206; src/lib/signup.ts:17-23
//  - Birth month and year (never the day): AuthPage.tsx:121-157; supabase/migrations/0016_signup_name_and_birth.sql:1-11,44-58
//  - Optional home city: AuthPage.tsx:160-178; 0004_checkin_location_conditions.sql:30-35
//  - Daily log fields: supabase/migrations/0001_init.sql:20-30; 0004:17-27; 0006_dashboard_metrics.sql:8-16
//  - Feelings are picked from a list: 0004:20-23; 0008_more_feelings.sql
//  - Location rounded to 0.1 degree (about 11 km), device location only for today, else home city:
//    src/lib/location.ts:1-2,19-21,23-40,86-101; src/pages/LogHabits.tsx:255-262
//  - Weather record saved per logged day: 0004:37-63; src/lib/conditionsCore.ts:162-168
//  - Goals: 0001_init.sql:11-18
//  - Gentle check-in dates and scores incl. one item score, no free text: 0007_reflections.sql:1-27
//  - Apple Health / phone import (only in the phone app, only if the person starts it): src/components/HealthImport.tsx:1-20;
//    src/lib/native/healthImport.ts:34,163-165
//  - Care sharing: invitee email, pillars, level; viewer sees only logged days of ticked pillars; notes, feelings,
//    locations and check-in answers are never shared; the viewer sees the owner's display name:
//    0010_care_shares.sql:1-30; 0015_care_sharing_v2.sql:1-34; 0014_review_fixes.sql:53; docs/care-sharing-v2-contract.md
//  - The invitation is not emailed by us: src/components/SharingSettings.tsx:392-393
//  - Invitation expires after 14 days: 0014_review_fixes.sql:27
//  - Owner can pause, end, and sees which days the person looked (dates only): SharingSettings.tsx:298-321,215-217
//  - AI: only on request or the automatic option; consent gate in the browser: src/features/aiReflection/AiReflectionCard.tsx:3-4,34-35;
//    src/lib/aiConsent.ts:82-83; src/components/AiConsentSetting.tsx:15-18
//  - AI payload (what is sent / not sent), hard days not sent, nothing stored:
//    supabase/functions/daily-reflection/index.ts:38-39,59-62,84-87,120; logic.ts:46-54,63-85,122
//  - Weather lookups go from the browser to Open-Meteo (rounded coordinates, dates, city text, IP): conditionsCore.ts:162-168; location.ts:57
//  - City name lookup to BigDataCloud (rounded coordinates, IP): location.ts:71-72; LogHabits.tsx:259-260
//  - Download all my data (JSON, CSV): src/pages/Settings.tsx:62-99,296-312; src/lib/export.ts:7-14
//  - Delete my account (removes sign-in and everything saved): src/components/DeleteAccount.tsx:18; 0012_delete_my_account.sql:7-16
//  - Delete reflection history alone: Settings.tsx:118-125
//  - Gentle check-ins switch: Settings.tsx:50-62
//  - Email news switch: src/components/EmailPreferences.tsx:28-40
//  - Where stored (Supabase, us-east-1): CLAUDE.md "Supabase project"; hosting (Vercel): vercel.json:1-6
//  - Nothing is sold, no advertising or analytics code: package.json dependencies (react, react-dom, react-is,
//    react-router-dom, recharts, supabase-js, per docs/gdpr-compliance.md 1.4); no geofence or ad code anywhere in src/
//  - Stripe: NOT in the code yet (no match in src/ or supabase/). The sentence about payments is a promise from Miah's
//    brief of 2026-10-12. Recheck it when billing is built.

export const HEALTH_PRIVACY_UPDATED = '12 October 2026';

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

const settingsLink = (
  <Link to="/settings" className="font-semibold underline underline-offset-4">
    Settings
  </Link>
);

export default function HealthDataPrivacy() {
  return (
    <PublicLayout title={routeTitle('/health-data-privacy')}>
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Consumer Health Data Privacy Policy</h1>
        <p className="mt-3 text-moss">Last updated {HEALTH_PRIVACY_UPDATED}</p>
        <p className="mt-6">
          This page is only about your health information: what Build Your Pillars keeps, why, who else receives it, and how you stay in
          control. Our general{' '}
          <Link to="/privacy" className="font-semibold underline underline-offset-4">
            Privacy Policy
          </Link>{' '}
          covers everything else, such as your email address and the waiting list. Build Your Pillars is for people 18 and older.
        </p>
        <p className="mt-4">
          We follow the Washington My Health My Data Act for <strong>everyone</strong>, wherever you live. Where the privacy laws of the
          European Union, Canada or India ask for more, we follow the stricter rule for everyone. Build Your Pillars is a consumer app.
          It is not a doctor, a clinic or an insurer, and the US health privacy law known as HIPAA does not apply to it.
        </p>

        <nav aria-label="On this page" className="mt-6 rounded-lg border border-line bg-white p-5">
          <p className="font-display text-xl font-bold">On this page</p>
          <ul className="mt-2 space-y-1">
            {[
              ['collect', 'What health information we collect, and why'],
              ['sources', 'Where it comes from'],
              ['share', 'Who receives it'],
              ['never', 'What we never do'],
              ['rights', 'Your choices, and how to use them'],
              ['appeal', 'If you disagree with our answer'],
              ['changes', 'Changes to this page'],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="collect" title="What health information we collect, and why">
          <p>
            We keep the health information you choose to enter, so the app can show you your own days, goals and trends. We ask for your
            clear yes before we start, when you create your account. You can take it back at any time.
          </p>
          <Bullets
            items={[
              <>
                <strong>Your daily log:</strong> exercise, steps, standing hours, active calories, sleep, time in bed, time awake, water,
                calories eaten, and any notes you write. <em>Why:</em> to show your days, goals and trends.
              </>,
              <>
                <strong>Mood, energy, stress and feelings:</strong> scores from 1 to 5, and feelings you pick from a list.{' '}
                <em>Why:</em> to show how you felt alongside your habits, and to find patterns for you.
              </>,
              <>
                <strong>Where you were:</strong> a city name and a map position rounded to about 11 kilometres, for each day you log. We
                never keep an exact position. <em>Why:</em> to attach the weather for that day.
              </>,
              <>
                <strong>Weather for your logged days:</strong> temperature, air quality and similar details for that rounded place. It is
                not about your body. We keep it next to your entries so Insights can show what tended to go together.
              </>,
              <>
                <strong>Your goals:</strong> the goals you set. <em>Why:</em> to show your progress against your own goals.
              </>,
              <>
                <strong>Gentle check-ins:</strong> the dates a check-in was offered or taken, and, only if you answer, the scores,
                including the score for one question about thoughts of self-harm. We never keep your written words from a check-in.{' '}
                <em>Why:</em> so you can look back on how you have been, and so a check-in is not offered too often. You can turn
                check-ins off in {settingsLink}.
              </>,
              <>
                <strong>Your birth month and year</strong> (never the day), <strong>one first name</strong> you choose, and, if you want,{' '}
                <strong>a home city</strong>. These are not health information on their own, but they sit next to it, so we protect them
                the same way. <em>Why:</em> to set your plan (free from age 60), to greet you, and to show weather on days you do not share
                your location.
              </>,
            ]}
          />
          <p>
            We use this information for these purposes only. We do not use it for advertising, for research, to train AI models, or for
            anything else. If we ever want to collect a new kind of health information, or use it for a new purpose, we will update this
            page first and ask for your yes before we do.
          </p>
          <p>
            What is <strong>necessary</strong> to run the app is your email, password, first name, birth month and year, and whatever you
            decide to log. Everything else is a choice you make, and the app still works without it.
          </p>
        </Section>

        <Section id="sources" title="Where it comes from">
          <Bullets
            items={[
              'You, when you type it in.',
              'Your phone, if you use the phone app and choose to bring in your last days from Apple Health or Health Connect. Nothing is read until you start that.',
              'Your device, for your location, only if your browser or phone asks and you say yes. If you say no, we use your home city or no place at all.',
              'A weather service, which supplies the weather for the rounded place and date.',
            ]}
          />
        </Section>

        <Section id="share" title="Who receives it">
          <p>
            We name every company or person who can receive your health information, and say what each one gets. Sharing with a person you
            invite, or with an AI, always needs its own separate yes from you, apart from the yes you gave to keep your information.
          </p>
          <h3 className="font-display text-xl font-bold">Companies that work for us (processors)</h3>
          <Bullets
            items={[
              <>
                <strong>Supabase</strong> (United States): stores your account and everything above, and handles sign-in. It gets all of
                it, because that is where it is kept. Supabase works under our instructions.
              </>,
              <>
                <strong>Vercel</strong> (United States): hosts this website. Your entries do not go through it. It sees the internet address
                and browser type of people who open a page.
              </>,
              <>
                <strong>Anthropic</strong> (United States), only if you say yes to AI help: it receives the date, what you logged that day as
                plain sentences, your mood, energy and stress as words (such as &ldquo;mood okay&rdquo;), the feelings you picked, and, for
                the weekly note, the same for seven days plus your goals. It does <strong>not</strong> receive your name, email, notes,
                location, weather or check-in answers. On a hard day, for example very low mood, we send nothing and show a fixed, caring
                message instead. We do not save the reflection or what was sent. Anthropic handles the request under its own terms.
              </>,
            ]}
          />
          <h3 className="font-display text-xl font-bold">Weather services your browser contacts</h3>
          <Bullets
            items={[
              <>
                <strong>Open-Meteo:</strong> receives your rounded map position, the dates needed, any city name you type into the search, and
                your device&rsquo;s internet address. It does not receive your name, email or anything you logged.
              </>,
              <>
                <strong>BigDataCloud:</strong> only when you log today and allow your device to share its location. It receives the rounded
                map position and your internet address, and tells us the city name. It does not receive your name, email or anything you
                logged.
              </>,
            ]}
          />
          <h3 className="font-display text-xl font-bold">A person you choose</h3>
          <Bullets
            items={[
              <>
                <strong>The person you invite</strong> (for example a partner or a caregiver), only after you say yes for that person: they
                see your first name and the pillars you tick (Drink, Sleep, Move, Balance). You choose how much they see: only that you
                logged a day, a weekly summary in words, or day-by-day detail. Balance is mood, energy and stress, and is off unless you
                tick it. They never see your notes, your feelings list, your places or your check-in answers. They cannot change
                anything. You can pause or end the sharing at any time and it stops at once, and you can see on which days they looked.
                The invitation ends by itself after 14 days if they do not accept.
              </>,
            ]}
          />
          <p>
            <strong>Payments.</strong> We have no payments yet. If we add paid plans, a payment company (Stripe) will receive your email
            address and payment details to take the payment. It will never receive your health information. We will update this page first.
          </p>
          <p>
            Want this list in a message? Email {mail} and we will send it. We do not share your health information with advertisers,
            insurers, employers, data brokers or health care providers.
          </p>
        </Section>

        <Section id="never" title="What we never do">
          <Bullets
            items={[
              <>
                <strong>We never sell your health information.</strong> Not for money, and not for anything else of value.
              </>,
              <>
                <strong>We do not use geofencing.</strong> We never draw a map boundary around a clinic or other health care place to find,
                follow, or send messages to people.
              </>,
              'We do not show ads, and the app contains no advertising or analytics tools.',
              'We do not change what you can do, or what you pay, because you used one of your privacy rights.',
            ]}
          />
        </Section>

        <Section id="rights" title="Your choices, and how to use them">
          <p>
            You can do these things yourself in the app, or by emailing {mail}. We answer within <strong>30 days</strong>. The law in
            Washington allows 45, and we ask more of ourselves. If we truly need more time, we will tell you why inside the first 30
            days, and we will take no more than 30 extra days. We will ask you to reply from the email address on your account, to be
            sure it is you. You never need to make a new account to ask. Your first two requests each year are free.
          </p>
          <Bullets
            items={[
              <>
                <strong>See your data:</strong> in {settingsLink}, choose &ldquo;Download all my data&rdquo;. You get a file you can keep
                and take elsewhere.
              </>,
              <>
                <strong>Know who has it:</strong> the list is on this page, under &ldquo;Who receives it&rdquo;. Email us for a copy that
                names the people you invited.
              </>,
              <>
                <strong>Correct it:</strong> change your name and home city in {settingsLink}, and edit any day you logged.
              </>,
              <>
                <strong>Delete it:</strong> in {settingsLink}, choose &ldquo;Delete my account&rdquo;. It removes your sign-in, your
                profile, your logs, goals, weather records, check-ins and sharing records, and this cannot be undone. We tell our
                processors by removing what they hold for us. Copies in our database provider&rsquo;s backups expire on their own
                schedule, and under Washington law no later than six months after we confirm your request. We will not restore a
                deleted account. You can also delete your check-in history by itself.
              </>,
              <>
                <strong>Take back a yes:</strong> turn off AI help or the news emails in {settingsLink}, end any sharing there, or turn
                off gentle check-ins. To take back the yes that lets us keep your information, delete your account or email us. Taking a
                yes back does not undo what happened before.
              </>,
              <>
                <strong>Ask us anything about this page:</strong> email {mail}.
              </>,
            ]}
          />
        </Section>

        <Section id="appeal" title="If you disagree with our answer">
          <p>
            If we say no to a request, or you think we got it wrong, you can appeal. Email {mail} with the word &ldquo;Appeal&rdquo; in the
            subject line and tell us what you want changed. We will answer in writing within <strong>30 days</strong> and explain why. The
            Washington law sets 45 days, and we ask more of ourselves.
          </p>
          <p>
            If we still say no, you can complain to the Washington State Attorney General at{' '}
            <a
              href="https://www.atg.wa.gov/file-complaint"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-4"
            >
              atg.wa.gov/file-complaint
            </a>
            . You can also complain to your own local privacy authority; see the Complaints part of our{' '}
            <Link to="/privacy#complain" className="font-semibold underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <Section id="changes" title="Changes to this page">
          <p>
            If we change what we collect, why, or who receives it, we will update this page and its date first, and ask for your yes in the
            app before the change starts. Earlier versions are available if you email us.
          </p>
        </Section>

        <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/privacy" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Read the general Privacy Policy
          </Link>
          <Link to="/privacy#how-we-work" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Read how we work
          </Link>
          <Link to="/" className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4">
            Back to the start
          </Link>
        </div>
      </article>
    </PublicLayout>
  );
}
