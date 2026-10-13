import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import BirthPrompt from '../components/BirthPrompt';
import { isNativeApp, planView } from '../lib/billing';
import { openBillingPortal, startCheckout, useBilling } from '../lib/billingClient';
import Notice from '../components/Notice';

// Route /plan, "Your plan". Plain words, no countdowns, no pressure.
const bigBtn =
  'min-h-[44px] rounded-md bg-spruce px-5 py-2.5 text-lg font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60';

export default function Plan() {
  const { loading, error, entitlement, subscriptions, reload } = useBilling();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const native = isNativeApp();

  async function go(action: () => Promise<string | null>) {
    setBusy(true);
    setProblem(null);
    const message = await action();
    if (message) {
      setProblem(message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Your plan" />
        <p role="status" className="text-lg">One moment.</p>
      </div>
    );
  }
  if (error || !entitlement) {
    return (
      <div>
        <PageHeader title="Your plan" />
        <p role="alert" className="max-w-prose text-lg">We could not check your plan just now. Please try again in a little while. Nothing about your data has changed.</p>
      </div>
    );
  }

  const own = subscriptions.find((s) => s.plan === 'standard_monthly') ?? null;
  const view = planView(entitlement, { native, subscription: own });
  const returned = params.get('checkout');

  return (
    <div>
      <PageHeader title="Your plan" />

      {returned === 'success' && !native && (
        <p role="status" className="mb-6 max-w-prose rounded-lg border border-line bg-white p-5 text-lg">
          Thank you. Your plan can take a minute to show up here.{' '}
          <button type="button" className="font-semibold underline" onClick={() => void reload()}>
            Check again
          </button>
        </p>
      )}
      {returned === 'cancelled' && !native && (
        <p role="status" className="mb-6 max-w-prose rounded-lg border border-line bg-white p-5 text-lg">
          No problem. Nothing was charged.
        </p>
      )}

      <section aria-labelledby="plan-now" className="max-w-prose rounded-lg border border-line bg-white p-6">
        <h2 id="plan-now" className="font-display text-3xl font-bold">
          {view.headline}
        </h2>
        <p className="mt-3 text-lg">{view.detail}</p>
        {view.note && <p className="mt-3 text-lg text-moss">{view.note}</p>}

        {view.cta === 'subscribe_standard' && view.ctaLabel && (
          <button type="button" className={`${bigBtn} mt-5`} disabled={busy} onClick={() => go(() => startCheckout('standard_monthly'))}>
            {busy ? 'One moment' : view.ctaLabel}
          </button>
        )}
        {view.cta === 'manage' && view.ctaLabel && (
          <button type="button" className={`${bigBtn} mt-5`} disabled={busy} onClick={() => go(openBillingPortal)}>
            {busy ? 'One moment' : view.ctaLabel}
          </button>
        )}
        {view.showManageLink && view.cta !== 'manage' && (
          <p className="mt-5">
            <button type="button" className="min-h-[44px] text-lg font-semibold text-spruce underline" disabled={busy} onClick={() => go(openBillingPortal)}>
              Manage or cancel my plan
            </button>
          </p>
        )}
        {problem && (
          <Notice kind="error" className="mt-4 text-lg">
            {problem}
          </Notice>
        )}
      </section>

      {view.cta === 'ask_birth' && (
        <div className="mt-6 max-w-prose">
          <BirthPrompt onSaved={() => void reload()} />
        </div>
      )}

      <p className="mt-6 max-w-prose text-lg text-moss">
        Build Your Pillars is free for everyone aged 60 and over. A caregiver who follows someone with their permission has a separate caregiver plan.
      </p>
    </div>
  );
}
