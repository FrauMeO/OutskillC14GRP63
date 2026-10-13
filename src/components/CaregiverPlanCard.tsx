import { useState } from 'react';
import { caregiverCardView, isNativeApp } from '../lib/billing';
import { startCheckout, useBilling } from '../lib/billingClient';

// Supporter side. Mount it at the top of src/pages/FollowingPerson.tsx (and optionally on the Following
// list row) for a person whose share is active. `name` is the owner's display name.
// During the beta it only explains; it sells nothing in a native app.
export default function CaregiverPlanCard({ name }: { name: string | null | undefined }) {
  const { loading, entitlement } = useBilling();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !entitlement) return null; // fail quiet: the server still decides what may be seen
  const view = caregiverCardView(name, entitlement, isNativeApp());
  if (!view.show) return null;

  async function buy() {
    setBusy(true);
    setError(null);
    const problem = await startCheckout('caregiver_yearly');
    if (problem) {
      setError(problem);
      setBusy(false);
    }
  }

  return (
    <section aria-label="Caregiver plan" className="rounded-lg border border-line bg-white p-5">
      <p className="max-w-prose text-lg">{view.text}</p>
      {view.note && <p className="mt-2 max-w-prose text-lg text-moss">{view.note}</p>}
      {view.cta === 'subscribe_caregiver' && view.ctaLabel && (
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="mt-4 min-h-[44px] rounded-md bg-spruce px-5 py-2.5 text-lg font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
        >
          {busy ? 'One moment' : view.ctaLabel}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-lg text-ember">
          {error}
        </p>
      )}
    </section>
  );
}
