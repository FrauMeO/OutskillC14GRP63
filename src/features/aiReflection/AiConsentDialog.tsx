// The plain-language consent dialog shown before the first time anything goes to Claude.
// If this wording changes, bump CONSENT_VERSION in src/lib/aiConsent.ts so people are asked again.
// What is listed here must match supabase/functions/daily-reflection (describeDay, describeGoals,
// weekMessage): see docs/gdpr-compliance.md, "Exact AI payload".
import { useEffect, useRef } from 'react';

type Props = { onYes: () => void; onNotNow: () => void };

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-5 text-lg font-semibold';

export default function AiConsentDialog({ onYes, onNotNow }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    // Start on the safe choice, never on "Yes".
    box.current?.querySelector<HTMLElement>('[data-first]')?.focus();
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onNotNow();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !box.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !box.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-spruce/50 p-4 sm:items-center" onKeyDown={onKeyDown}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-consent-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 text-lg leading-relaxed text-spruce shadow-xl"
      >
        <h2 id="ai-consent-title" className="font-display text-2xl font-bold">
          Would you like AI help with your reflections?
        </h2>
        <p className="mt-3">
          If you say yes, the app asks an AI called Claude to write a few gentle sentences about your day, or about your week.
        </p>

        <h3 className="mt-4 font-bold">What is sent to Claude</h3>
        <ul className="mt-1 list-disc space-y-1 pl-6">
          <li>The date.</li>
          <li>
            What you logged, in words: sleep, water, food calories you logged, exercise, steps, standing hours, active calories, and
            time in bed.
          </li>
          <li>Your mood, energy and stress, as words such as “mood okay” or “stress high”, and the feeling words you picked.</li>
          <li>For “Coach me on my week”: the same for your last seven days, plus the goals you set for yourself.</li>
        </ul>

        <h3 className="mt-4 font-bold">What is never sent</h3>
        <p className="mt-1">
          Your name, your email, where you are, your notes, and your answers in the gentle check-in or reflection pages. Days that sound
          hard are never sent: you get a kind fixed message instead.
        </p>

        <h3 className="mt-4 font-bold">Who handles it</h3>
        <p className="mt-1">
          Claude is made by Anthropic and runs in the United States. We do not save the reflection or what was sent. It is shown to you
          and then gone. Anthropic’s own handling is described in its terms.
        </p>

        <p className="mt-4">
          This is your choice. The rest of the app works the same without it. You can change your mind at any time in Settings.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" data-first onClick={onNotNow} className={`${btn} border border-spruce text-spruce hover:bg-mist`}>
            Not now
          </button>
          <button type="button" onClick={onYes} className={`${btn} bg-spruce text-mist hover:bg-spruce-soft`}>
            Yes, use AI help
          </button>
        </div>
      </div>
    </div>
  );
}
