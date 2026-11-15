import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '../lib/waitlist';
import { OFFER_LINE } from '../lib/brandCopy';

// "How we work": the plain-English terms of use, shown on the privacy page (Miah, 2026-10-22).
// Moved here from pages/Terms.tsx without changing the wording.
// LEGAL REVIEW needed before launch: the whole section, especially "Limits on our responsibility",
// and the governing-law placeholder, which the founders must fill in.

export const TERMS_UPDATED = '12 October 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h3 id={id} className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        {title}
      </h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export default function HowWeWork() {
  return (
    <section aria-labelledby="how-we-work" className="mt-16 border-t border-line pt-10">
      <h2 id="how-we-work" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        How we work
      </h2>
      <p className="mt-3 text-moss">Last updated {TERMS_UPDATED}</p>
      <p className="mt-6">
        These are the simple rules for using Build Your Pillars, our terms of use. By creating an account or using the app, you agree
        to them.
      </p>

        <Section id="what" title="What this is, and what it is not">
          <p>
            Build Your Pillars is a place to notice your own days with kindness. It is not medical advice, it does not diagnose
            anything, and it is not a substitute for a doctor, nurse or counsellor. Please talk to a health professional about any health
            concern.
          </p>
          <p>
            It is <strong>not an emergency service</strong>. If you are in danger or thinking about hurting yourself, call your local
            emergency number now. The app lists help lines for your country on its Reflect page, and findahelpline.com lists services in
            many countries.
          </p>
        </Section>

        <Section id="age" title="Who can use it">
          <p>You must be 18 or older. {/* LEGAL REVIEW: confirm age (18 everywhere, Miah 2026-10-12). */}</p>
        </Section>

        <Section id="price" title="What it costs">
          <p>
            {OFFER_LINE} We will tell you before any charge begins, and you can cancel any time.
            {/* LEGAL REVIEW: refunds, cancellation, taxes, and how age is confirmed (self-declared month and year of birth). */}
          </p>
        </Section>

        <Section id="yours" title="Your data is yours">
          <p>
            What you log belongs to you. You can download it or delete your account at any time in Settings. We use it only to run the
            service, as described in the Privacy Policy.
          </p>
        </Section>

        <Section id="use" title="Using the app fairly">
          <ul className="list-disc space-y-2 pl-6">
            <li>Use your own account and keep your password to yourself.</li>
            <li>Only share your pillars with people you trust, and only invite someone who would want to be invited.</li>
            <li>Do not try to break into the service, overload it, or look at anyone else&rsquo;s information.</li>
            <li>Do not use the app to harass anyone or to break the law.</li>
          </ul>
          <p>We may close an account that breaks these rules.</p>
        </Section>

        <Section id="change" title="Changes to the service">
          <p>
            We are a small, founder-led team. We may change features, pause the service, or stop it. If we stop it, we will tell you in advance where
            we can, and give you time to download your data. We may also update these terms, and will tell you in the app if the change
            matters.
          </p>
        </Section>

        <Section id="liability" title="Limits on our responsibility">
          <p>
            We try hard to keep the app working and your data secure, but we offer it &ldquo;as is&rdquo;, without a promise that it will
            always be available or free of mistakes. To the extent the law allows, we are not responsible for losses that come from using
            the app, or from relying on it instead of professional advice. Nothing here limits any right you have by law that cannot be
            limited. {/* LEGAL REVIEW: this paragraph needs a lawyer for each target country. */}
          </p>
        </Section>

        <Section id="law" title="Which country&rsquo;s law applies">
          <p>
            {/* PLACEHOLDER for the founders and a lawyer: replace with the real governing law and courts. */}
            <strong>[To be completed by the founders: governing law and where disputes are handled.]</strong>
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Questions about these terms:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

    </section>
  );
}
