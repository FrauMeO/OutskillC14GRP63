// The consent step before a care-sharing invitation is created (docs/privacy-consent-spec.md, 4.2).
// Names the person, what they will see, why, and how to stop. "Not now" has focus when it opens;
// Escape means "Not now"; nothing happens until the box is ticked and "Send invitation" is pressed.
// If this wording changes, bump SHARE_CAREGIVER.version in src/lib/consentTexts.ts.
import { useEffect, useRef, useState } from 'react';
import { shareConsentCopy } from '../lib/consentTexts';
import type { ShareLevel } from '../lib/careShares';

type Props = {
  email: string;
  pillars: string; // e.g. "Sleep and Move"
  level: ShareLevel;
  balance: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-5 text-lg font-semibold disabled:opacity-60';

export default function ShareConsentDialog({ email, pillars, level, balance, busy, onCancel, onConfirm }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [agreed, setAgreed] = useState(false);
  const copy = shareConsentCopy(email, pillars, level, balance);

  useEffect(() => {
    opener.current = document.activeElement;
    // Start on the safe choice, never on "Send invitation".
    box.current?.querySelector<HTMLElement>('[data-first]')?.focus();
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !(el as HTMLButtonElement).disabled);
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
        aria-labelledby="share-consent-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 text-lg leading-relaxed text-spruce shadow-xl"
      >
        <h2 id="share-consent-title" className="font-display text-2xl font-bold">
          {copy.title}
        </h2>
        <p className="mt-3">{copy.intro}</p>
        <p className="mt-3">
          <strong>{copy.seeLabel}</strong> {copy.see}
        </p>
        {copy.balanceNote && <p className="mt-1">{copy.balanceNote}</p>}
        <p className="mt-3">{copy.never}</p>
        <p className="mt-3">{copy.why}</p>
        <p className="mt-3">{copy.onlyLook}</p>
        <p className="mt-3">{copy.inCharge}</p>
        <p className="mt-3">{copy.expiry}</p>
        <p className="mt-3 text-base">
          <a href="/health-data-privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
            Consumer Health Data Privacy Policy
          </a>
        </p>

        <label className="mt-4 flex min-h-11 items-start gap-3">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={busy} className="mt-1 size-6 shrink-0 accent-spruce" />
          <span className="font-semibold">{copy.label}</span>
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" data-first onClick={onCancel} disabled={busy} className={`${btn} border border-spruce text-spruce hover:bg-mist`}>
            Not now
          </button>
          <button type="button" onClick={onConfirm} disabled={!agreed || busy} className={`${btn} bg-spruce text-mist hover:bg-spruce-soft`}>
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
