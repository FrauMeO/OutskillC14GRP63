// Data access for the email preferences and nudges. Uses an untyped view of the Supabase client because
// src/lib/database.types.ts does not know the 0017 tables and functions yet (add them there when 0017 is
// applied and this cast can go).
import { supabase } from '../supabase';

interface DbError {
  message: string;
}
interface Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: DbError | null }>;
}
const db = supabase as unknown as Db;

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export interface PrefsRow {
  share_id: string;
  owner_allows_nudges: boolean;
  supporter_digest: boolean;
}

export async function loadPrefs(): Promise<Map<string, PrefsRow>> {
  const { data, error } = await db.from('care_share_email_prefs').select('share_id, owner_allows_nudges, supporter_digest');
  if (error) throw new Error('Could not load your email choices.');
  return new Map((data as PrefsRow[]).map((r) => [r.share_id, r]));
}

export interface OwnerShare {
  id: string;
  viewer_email: string;
  status: 'pending' | 'active';
}

/** The people the signed-in owner shares with (pending or active). */
export async function loadOwnerShares(userId: string): Promise<OwnerShare[]> {
  const { data, error } = await db
    .from('care_shares')
    .select('id, viewer_email, status')
    .eq('owner_id', userId)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false });
  if (error) throw new Error('Could not load your shares.');
  return data as OwnerShare[];
}

export interface FollowedShare {
  share_id: string;
  owner_name: string;
  status: string;
}

/** The people the signed-in supporter follows (active only; a pending invitation has no email choices yet). */
export async function loadFollowed(): Promise<FollowedShare[]> {
  const { data, error } = await db.rpc('followed_people');
  if (error) throw new Error('Could not load the people you follow.');
  return (data as FollowedShare[]).filter((r) => r.status === 'active');
}

export async function setNudgePref(shareId: string, allow: boolean): Promise<void> {
  const { error } = await db.rpc('set_nudge_pref', { p_share_id: shareId, p_allow: allow, p_tz: zone() });
  if (error) throw new Error('Could not save that. Please try again.');
}

export async function setDigestPref(shareId: string, on: boolean): Promise<void> {
  const { error } = await db.rpc('set_digest_pref', { p_share_id: shareId, p_on: on, p_tz: zone() });
  if (error) throw new Error('Could not save that. Please try again.');
}

/** Time of the most recent nudge the signed-in user sent on this share, or null. */
export async function lastNudgeAt(shareId: string, userId: string): Promise<Date | null> {
  const { data, error } = await db
    .from('care_nudges')
    .select('created_at')
    .eq('share_id', shareId)
    .eq('sender_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('Could not check your notes.');
  const row = (data as { created_at: string }[])[0];
  return row ? new Date(row.created_at) : null;
}

/** Makes the nudge row (the database checks every rule) and returns its id. */
export async function createNudge(shareId: string, preset: string): Promise<string> {
  const { data, error } = await db.rpc('send_care_nudge', { p_share_id: shareId, p_preset: preset });
  if (error) throw new Error('That note could not be sent right now.');
  return String(data);
}

export type LinkAction = 'confirm' | 'mute' | 'unsub';

const redeemed = new Map<string, Promise<boolean>>();

/** Used by the page behind the links in emails. Works signed out; the token is the proof.
 *  Remembers the answer per token so React's double effect in development cannot spend a one-use token twice. */
export function redeemEmailLink(action: LinkAction, token: string): Promise<boolean> {
  const key = action + ':' + token;
  const hit = redeemed.get(key);
  if (hit) return hit;
  const fn = action === 'confirm' ? 'confirm_waitlist' : action === 'mute' ? 'mute_nudges_by_token' : 'unsubscribe_digest_by_token';
  const p = db.rpc(fn, { p_token: token }).then(({ data, error }) => {
    if (error) throw new Error('Something went wrong.');
    return data === true;
  });
  redeemed.set(key, p);
  p.catch(() => redeemed.delete(key));
  return p;
}
