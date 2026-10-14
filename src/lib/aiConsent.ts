// Consent to send a person's logged words and numbers to Claude (Anthropic) for a written reflection.
// Pure rules plus guarded storage (docs/gdpr-compliance.md gap 2; Apple guideline 5.1.2(i)).
// Stored per signed-in user in this browser only: `byp.aiConsent.<userId>` = {v, at, granted}.
// `v` is the version of the consent TEXT. When the text changes, bump CONSENT_VERSION and everyone
// is asked again. Nothing here talks to the network.

export const CONSENT_VERSION = 1;

export type ConsentRecord = { v: number; at: string; granted: boolean };
// 'unset' = never answered (or the text has changed): the person should be asked.
export type ConsentStatus = 'granted' | 'declined' | 'unset';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const consentKey = (userId: string) => `byp.aiConsent.${userId}`;

// Used when the browser refuses storage (private window, blocked site data): the choice then
// lasts for this tab only, never longer.
const memory = new Map<string, string>();

export function parseConsent(raw: string | null | undefined, version = CONSENT_VERSION): ConsentStatus {
  if (!raw) return 'unset';
  try {
    const r = JSON.parse(raw) as Partial<ConsentRecord> | null;
    if (!r || typeof r !== 'object') return 'unset';
    if (r.v !== version) return 'unset'; // older (or unknown) wording: ask again
    if (typeof r.granted !== 'boolean') return 'unset';
    return r.granted ? 'granted' : 'declined';
  } catch {
    return 'unset';
  }
}

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readConsentValue(userId: string | null | undefined, store: Store | null = defaultStore()): string | null {
  if (!userId) return null;
  const key = consentKey(userId);
  try {
    if (store) {
      const raw = store.getItem(key);
      if (raw !== null) return raw;
    }
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

export function readConsent(userId: string | null | undefined, store: Store | null = defaultStore()): ConsentStatus {
  return parseConsent(readConsentValue(userId, store));
}

// Version + grant timestamp identify one consent decision, without retaining any health data.
export function consentRevision(userId: string | null | undefined): string | null {
  const raw = readConsentValue(userId);
  return parseConsent(raw) === 'granted' ? raw : null;
}

export function writeConsent(
  userId: string,
  granted: boolean,
  store: Store | null = defaultStore(),
  now: Date = new Date(),
): void {
  const key = consentKey(userId);
  const value = JSON.stringify({ v: CONSENT_VERSION, at: now.toISOString(), granted } satisfies ConsentRecord);
  memory.set(key, value);
  try {
    store?.setItem(key, value);
  } catch {
    /* kept in memory for this tab */
  }
}

export function clearConsent(userId: string, store: Store | null = defaultStore()): void {
  const key = consentKey(userId);
  memory.delete(key);
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

// The only gate for every AI call: true only for an explicit, current-version yes.
export const mayCallAi = (status: ConsentStatus) => status === 'granted';

// "Not now" lasts for this session only (module memory), so we never nag, and never record a refusal.
const snoozed = new Set<string>();
export const snoozeAsk = (userId: string) => void snoozed.add(userId);
export const isSnoozed = (userId: string | null | undefined) => !!userId && snoozed.has(userId);
export function resetSessionState() {
  snoozed.clear();
  memory.clear();
}
