// Pure rules for the consent ledger (migration 0020; docs/privacy-consent-spec.md). No network here:
// the calls that use these rules are in consentApi.ts.

export const CONSENT_KINDS = ['collect_use', 'share_caregiver', 'ai_processing', 'email_marketing'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** A row of my_consents(): the latest state of one kind (of one share, for share_caregiver). */
export type ConsentRow = { kind: ConsentKind; version: number; granted: boolean; share_id: string | null; created_at: string };

export const HASH_PATTERN = /^[0-9a-f]{64}$/;
export const isConsentKind = (x: unknown): x is ConsentKind => typeof x === 'string' && (CONSENT_KINDS as readonly string[]).includes(x);
export const isValidVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1000;

/** Newest row per kind, ignoring per-share rows. */
export function latestByKind(rows: ConsentRow[]): Partial<Record<ConsentKind, ConsentRow>> {
  const out: Partial<Record<ConsentKind, ConsentRow>> = {};
  for (const r of rows) {
    if (r.kind === 'share_caregiver') continue;
    const have = out[r.kind];
    if (!have || r.created_at >= have.created_at) out[r.kind] = r;
  }
  return out;
}

/** How many shares the person has said yes to and not taken back. */
export function grantedShareCount(rows: ConsentRow[]): number {
  return rows.filter((r) => r.kind === 'share_caregiver' && r.granted).length;
}

// ---------- choices made on the sign-up form, recorded once the person has a session ----------
// The sign-up form cannot write the ledger (with email confirmation there is no session yet), so it
// leaves the choices in the sign-up metadata. After the first sign-in they are written once.

export const PENDING_KEY = 'pending_consents';
export type PendingKind = 'collect_use' | 'email_marketing';
export type PendingConsent = { kind: PendingKind; version: number; hash: string };

const PENDING_KINDS: PendingKind[] = ['collect_use', 'email_marketing'];

/** The metadata object to send with signUp(). */
export function pendingMetadata(choices: PendingConsent[]): Record<string, { v: number; h: string }> {
  return Object.fromEntries(choices.map((c) => [c.kind, { v: c.version, h: c.hash }]));
}

/** Read the choices back out of a user's metadata. Anything malformed is ignored, never guessed. */
export function parsePending(meta: unknown): PendingConsent[] {
  if (!meta || typeof meta !== 'object') return [];
  const raw = (meta as Record<string, unknown>)[PENDING_KEY];
  if (!raw || typeof raw !== 'object') return [];
  const out: PendingConsent[] = [];
  for (const kind of PENDING_KINDS) {
    const e = (raw as Record<string, unknown>)[kind];
    if (!e || typeof e !== 'object') continue;
    const { v, h } = e as { v?: unknown; h?: unknown };
    if (isValidVersion(v) && typeof h === 'string' && HASH_PATTERN.test(h)) out.push({ kind, version: v, hash: h });
  }
  return out;
}

/** Only kinds with no ledger row at all are written, so a later withdrawal is never undone by an old sign-up choice. */
export function pendingToWrite(pending: PendingConsent[], existing: ConsentRow[]): PendingConsent[] {
  const have = new Set(existing.map((r) => r.kind));
  return pending.filter((p) => !have.has(p.kind));
}

export type RecordArgs = { kind: ConsentKind; version: number; granted: boolean; hash: string; shareId?: string | null; details?: Record<string, unknown> };

/** The two calls the sign-up recorder needs, so it can be tested with a stand-in (consentApi.ts has the real ones). */
export type ConsentClient = {
  fetchMine: () => Promise<ConsentRow[]>;
  record: (a: RecordArgs) => Promise<void>;
};

const inFlight = new Set<string>();

/**
 * After the first sign-in: write the sign-up choices that have no ledger row yet. Safe to call on
 * every sign-in (a kind that already has a row is skipped) and never throws: a failure just means
 * the next sign-in tries again.
 */
export async function recordPendingConsents(userId: string, metadata: unknown, client: ConsentClient): Promise<PendingConsent[]> {
  const pending = parsePending(metadata);
  if (pending.length === 0 || inFlight.has(userId)) return [];
  inFlight.add(userId);
  const written: PendingConsent[] = [];
  try {
    const todo = pendingToWrite(pending, await client.fetchMine());
    for (const p of todo) {
      await client.record({ kind: p.kind, version: p.version, granted: true, hash: p.hash });
      written.push(p);
    }
  } catch {
    /* tried again at the next sign-in */
  } finally {
    inFlight.delete(userId);
  }
  return written;
}

// ---------- words for the screens ----------

export const KIND_LABEL: Record<ConsentKind, string> = {
  collect_use: 'Keeping what you enter',
  share_caregiver: 'Sharing with people you invite',
  ai_processing: 'AI help for reflections',
  email_marketing: 'News by email',
};

export const SIGNUP_CONSENT_ERROR = 'Please tick the box to let us keep what you enter. Without it, we cannot make an account.';

export function statusMessage(kind: ConsentKind, granted: boolean): string {
  switch (kind) {
    case 'email_marketing':
      return granted ? 'You will get occasional news by email.' : 'You will not get news by email.';
    case 'ai_processing':
      return granted ? 'AI help is on.' : 'AI help is off. Nothing will be sent.';
    case 'collect_use':
      return granted ? 'We keep what you enter, to run the app for you.' : 'We have stopped keeping what you enter.';
    case 'share_caregiver':
      return granted ? 'Sharing is on for that person.' : 'Sharing has ended. They cannot see anything now.';
  }
}

export type KindView = { on: boolean | null; summary: string };

/**
 * What to show for one kind. `profileOn` is the existing profile flag (marketing_opt_in, or whether
 * health_consent_at is set): accounts made before the ledger have no rows but a real earlier yes.
 */
export function kindView(kind: ConsentKind, rows: ConsentRow[], profileOn: boolean | null): KindView {
  if (kind === 'share_caregiver') {
    const n = grantedShareCount(rows);
    return { on: n > 0, summary: n === 0 ? 'You are not sharing with anyone.' : n === 1 ? 'You share with 1 person.' : `You share with ${n} people.` };
  }
  const row = latestByKind(rows)[kind];
  if (row) return { on: row.granted, summary: row.granted ? 'You said yes.' : 'You took this back.' };
  if (profileOn === true) return { on: true, summary: 'You said yes before we kept a record of it.' };
  if (profileOn === false) return { on: false, summary: 'You have not said yes.' };
  return { on: null, summary: 'Loading…' };
}
