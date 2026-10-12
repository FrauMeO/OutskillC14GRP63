// The calls that read and write the consent ledger and the privacy requests (migration 0020).
// The rules are in consent.ts and privacyRequests.ts; nothing here decides anything.
import { supabase } from './supabase';
import { consentHash, CURRENT_VERSION, type TextPurpose } from './consentTexts';
import type { ConsentClient, ConsentRow, RecordArgs } from './consent';
import type { RequestRow } from './privacyRequests';

export const CONSENT_CHANGED = 'byp-consent-changed';
export const SAVE_PROBLEM = 'We could not save that just now. Please try again.';

export async function fetchMyConsents(): Promise<ConsentRow[]> {
  const { data, error } = await supabase.rpc('my_consents');
  if (error) throw new Error(error.message);
  return (data ?? []) as ConsentRow[];
}

export async function recordConsent(a: RecordArgs): Promise<void> {
  const { error } = await supabase.rpc('record_consent', {
    p_kind: a.kind,
    p_version: a.version,
    p_granted: a.granted,
    p_text_hash: a.hash,
    p_share_id: a.shareId ?? null,
    p_details: (a.details ?? {}) as never,
  });
  if (error) throw new Error(error.message);
}

export { recordPendingConsents } from './consent';

export const liveClient: ConsentClient = { fetchMine: fetchMyConsents, record: recordConsent };

/** Give or take back a choice made with the current wording. Returns a plain sentence on failure, null on success. */
export async function setConsent(purpose: TextPurpose, granted: boolean, extra?: { shareId?: string; details?: Record<string, unknown> }): Promise<string | null> {
  try {
    await recordConsent({ kind: purpose, version: CURRENT_VERSION[purpose], granted, hash: await consentHash(purpose), ...extra });
    window.dispatchEvent(new Event(CONSENT_CHANGED));
    return null;
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    // Our own messages are plain English; anything else is a connection or setup problem.
    return /^(That|The |Say |Only |Sign in|You |Please )/.test(m) ? m : SAVE_PROBLEM;
  }
}

export async function fetchMyRequests(): Promise<RequestRow[]> {
  const { data, error } = await supabase.rpc('my_privacy_requests');
  if (error) throw new Error(error.message);
  return (data ?? []) as RequestRow[];
}

export async function createRequest(type: string, details: string): Promise<{ id: string; dueAt: string } | string> {
  try {
    const { data, error } = await supabase.rpc('create_privacy_request', { p_type: type, p_details: details.trim() || null });
    if (error) return /^(Please|You already|Sign in)/.test(error.message) ? error.message : SAVE_PROBLEM;
    const row = (data ?? [])[0];
    if (!row) return SAVE_PROBLEM;
    return { id: row.request_id, dueAt: row.request_due_at };
  } catch {
    return SAVE_PROBLEM;
  }
}
