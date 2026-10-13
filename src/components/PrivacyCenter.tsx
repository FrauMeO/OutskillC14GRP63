// "Privacy and consent" in Settings (docs/privacy-consent-spec.md, sections 5 and 6):
//  1. Your choices: each one shown as on or off, with a button to take it back or give it again.
//  2. Who has my data.
//  3. A pointer to the download.
//  4. A form for rights requests, with the 30-day answer date shown.
// The rules and the words are in src/lib (consent.ts, consentTexts.ts, privacyRequests.ts, dataRecipients.ts).
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AiConsentSetting from './AiConsentSetting';
import { AI_REFLECTION_ENABLED } from '../features/aiReflection/AiReflectionCard';
import { KIND_LABEL, kindView, statusMessage, type ConsentKind, type ConsentRow } from '../lib/consent';
import { CONSENT_CHANGED, createRequest, fetchMyConsents, fetchMyRequests, setConsent } from '../lib/consentApi';
import { RECIPIENTS } from '../lib/dataRecipients';
import { formatDay, REQUEST_TYPES, requestStatusText, RESPONSE_DAYS, typeLabel, validateRequest, DETAILS_MAX, type RequestRow } from '../lib/privacyRequests';
import { CONTACT_EMAIL } from '../lib/waitlist';
import Notice from './Notice';

type Flash = { kind: 'ok' | 'error'; text: string } | null;

const btn = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 text-lg font-semibold disabled:opacity-60';
const quiet = `${btn} border border-spruce text-spruce hover:bg-mist`;
const solid = `${btn} bg-spruce text-mist hover:bg-spruce-soft`;

function goTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('tabindex', '-1');
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

function Say({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <Notice kind={flash.kind} className="mt-3 text-lg">
      {flash.text}
    </Notice>
  );
}

function Row({ kind, children }: { kind: ConsentKind; children: ReactNode }) {
  return (
    <li className="rounded-md border border-line p-4">
      <p className="text-lg font-semibold">{KIND_LABEL[kind]}</p>
      {children}
    </li>
  );
}

export default function PrivacyCenter() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [historyOk, setHistoryOk] = useState(true);
  const [profile, setProfile] = useState<{ marketing: boolean; health: boolean } | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState(false);
  const [explainCore, setExplainCore] = useState(false);

  const [type, setType] = useState('access');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [requestFlash, setRequestFlash] = useState<Flash>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestsOk, setRequestsOk] = useState(true);

  const loadChoices = useCallback(async () => {
    if (!user) return;
    const p = await supabase.from('profiles').select('marketing_opt_in, health_consent_at').eq('id', user.id).maybeSingle();
    setProfile({ marketing: p.data?.marketing_opt_in ?? false, health: !!p.data?.health_consent_at });
    try {
      setRows(await fetchMyConsents());
      setHistoryOk(true);
    } catch {
      setHistoryOk(false); // migration 0020 not applied yet, or offline: the profile flags still tell the story
    }
  }, [user]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      setRequests(await fetchMyRequests());
      setRequestsOk(true);
    } catch {
      setRequestsOk(false);
    }
  }, [user]);

  useEffect(() => {
    loadChoices();
    loadRequests();
    window.addEventListener(CONSENT_CHANGED, loadChoices);
    return () => window.removeEventListener(CONSENT_CHANGED, loadChoices);
  }, [loadChoices, loadRequests]);

  async function change(kind: 'collect_use' | 'email_marketing', granted: boolean) {
    setBusy(true);
    setFlash(null);
    const problem = await setConsent(kind, granted);
    setBusy(false);
    if (problem) return setFlash({ kind: 'error', text: problem });
    setFlash({ kind: 'ok', text: statusMessage(kind, granted) });
    setExplainCore(false);
    await loadChoices();
  }

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    setRequestFlash(null);
    const problem = validateRequest(type, details);
    if (problem) return setRequestFlash({ kind: 'error', text: problem });
    setSending(true);
    const res = await createRequest(type, details);
    setSending(false);
    if (typeof res === 'string') return setRequestFlash({ kind: 'error', text: res });
    setRequestFlash({ kind: 'ok', text: `We got your request. We will answer by ${formatDay(res.dueAt)}.` });
    setDetails('');
    await loadRequests();
  }

  const core = kindView('collect_use', rows, profile ? profile.health : null);
  const mail = kindView('email_marketing', rows, profile ? profile.marketing : null);
  const share = kindView('share_caregiver', rows, null);
  const selected = REQUEST_TYPES.find((t) => t.value === type);

  const state = (on: boolean | null) => (on === null ? 'Loading…' : on ? 'On' : 'Off');

  return (
    <section aria-labelledby="privacy-center" className="mt-6 max-w-2xl rounded-lg border border-line bg-white p-6 text-lg">
      <h2 id="privacy-center" className="font-display text-2xl font-bold">
        Privacy and consent
      </h2>
      <p className="mt-2 text-moss">
        You are in charge of your information. Taking a choice back is as easy as giving it. Read the{' '}
        <a href="/health-data-privacy" className="font-semibold underline underline-offset-4">
          Consumer Health Data Privacy Policy
        </a>
        .
      </p>

      <h3 className="mt-6 font-display text-xl font-bold">Your choices</h3>
      <ul className="mt-3 space-y-3">
        <Row kind="collect_use">
          <p className="text-moss">
            {state(core.on)}. {core.summary}
          </p>
          {core.on === false ? (
            <button type="button" className={`${solid} mt-2`} disabled={busy} onClick={() => change('collect_use', true)}>
              Say yes again
            </button>
          ) : (
            <button type="button" className={`${quiet} mt-2`} disabled={busy || core.on === null} onClick={() => setExplainCore((x) => !x)} aria-expanded={explainCore}>
              Take this back
            </button>
          )}
          {explainCore && (
            <div role="group" aria-label="What taking this back means" className="mt-3 rounded-md border border-alert/40 bg-alert/5 p-4">
              <p>
                Without this, we cannot keep your entries, and the app cannot work. Taking it back means deleting your account. Your logs,
                goals, check-ins and sharing are deleted, and this cannot be undone. You can download your data first.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" autoFocus className={quiet} onClick={() => setExplainCore(false)}>
                  Keep as it is
                </button>
                <button type="button" className={`${btn} border border-alert text-alert hover:bg-alert/10`} onClick={() => goTo('delete-account')}>
                  Go to Delete my account
                </button>
              </div>
            </div>
          )}
        </Row>

        <Row kind="email_marketing">
          <p className="text-moss">
            {state(mail.on)}. {mail.summary}
          </p>
          <button
            type="button"
            className={`${mail.on ? quiet : solid} mt-2`}
            disabled={busy || mail.on === null}
            onClick={() => change('email_marketing', !mail.on)}
          >
            {mail.on ? 'Take this back' : 'Say yes'}
          </button>
        </Row>

        {AI_REFLECTION_ENABLED && (
          <Row kind="ai_processing">
            <div className="mt-2">
              <AiConsentSetting />
            </div>
          </Row>
        )}

        <Row kind="share_caregiver">
          <p className="text-moss">{share.summary}</p>
          <button type="button" className={`${quiet} mt-2`} onClick={() => goTo('sharing')}>
            Go to Sharing
          </button>
        </Row>
      </ul>
      <Say flash={flash} />
      {!historyOk && (
        <p role="status" className="mt-3 text-moss">
          The list of your past choices is not available right now. Your current choices above are still right.
        </p>
      )}

      <h3 className="mt-8 font-display text-xl font-bold">Who has my data</h3>
      <p className="mt-2 text-moss">
        This is everyone who can receive your health information, and what they get. It matches our Consumer Health Data Privacy Policy.
      </p>
      <ul className="mt-3 space-y-3">
        {RECIPIENTS.map((r) => (
          <li key={r.name} className="rounded-md border border-line p-4">
            <p className="font-semibold">{r.name}</p>
            <p>
              <span className="font-medium">They get:</span> {r.what}
            </p>
            <p>
              <span className="font-medium">Why:</span> {r.why}
            </p>
            <p>
              <span className="font-medium">Your choice:</span> {r.choice}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-moss">
        Want this in an email? Write to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-4">
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <h3 className="mt-8 font-display text-xl font-bold">Download my data</h3>
      <p className="mt-2 text-moss">You can download everything you have logged, any time, in the Your data section above.</p>
      <button type="button" className={`${quiet} mt-2`} onClick={() => goTo('your-data')}>
        Go to Your data
      </button>

      <h3 className="mt-8 font-display text-xl font-bold">Ask us about your data</h3>
      <p className="mt-2 text-moss">
        Send us a request here. We answer within {RESPONSE_DAYS} days, and we show you the date.
      </p>
      <form onSubmit={sendRequest} className="mt-3 space-y-3" noValidate>
        <label className="block font-medium">
          What do you need?
          <select
            className="mt-1.5 block min-h-11 w-full rounded-md border border-line bg-white px-3 py-2.5 text-lg"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-describedby="request-hint"
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <p id="request-hint" className="text-moss">
          {selected?.hint}
        </p>
        <label className="block font-medium">
          {selected?.needsDetails ? 'Tell us more' : 'Tell us more (optional)'}
          <textarea
            className="mt-1.5 block min-h-28 w-full rounded-md border border-line px-3 py-2.5 text-lg"
            value={details}
            maxLength={DETAILS_MAX}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <button type="submit" className={solid} disabled={sending}>
          {sending ? 'Sending…' : 'Send request'}
        </button>
        <Say flash={requestFlash} />
      </form>

      <h4 className="mt-6 font-display text-lg font-bold">Your requests</h4>
      {!requestsOk && <p className="mt-2 text-moss">Your requests are not available right now.</p>}
      {requestsOk && requests.length === 0 && <p className="mt-2 text-moss">You have not sent any requests.</p>}
      <ul className="mt-2 space-y-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-md border border-line p-4">
            <p className="font-semibold">{typeLabel(r.request_type)}</p>
            <p className="text-moss">Sent {formatDay(r.created_at)}</p>
            <p>{requestStatusText(r, new Date())}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
