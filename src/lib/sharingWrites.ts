// One RPC per logical sharing write. Never fall back to the old multi-request sequence.
import type { Database } from './database.types';
import type { PillarFlags, ShareLevel } from './careShares';

type Functions = Database['public']['Functions'];
export type InviteArgs = Functions['invite_care_share_atomic']['Args'];
export type ScopeArgs = Functions['update_care_share_scope']['Args'];
export type WriteReply = { data: unknown; error: { message: string; code?: string } | null };
export type SharingClient = {
  rpc(name: 'invite_care_share_atomic', args: InviteArgs): PromiseLike<WriteReply>;
  rpc(name: 'update_care_share_scope', args: ScopeArgs): PromiseLike<WriteReply>;
};
export const UNCERTAIN_INVITE = 'We could not confirm whether your invitation was saved. Check the sharing list below, or retry the same invitation to safely recover its status. Do not assume sharing is off.';
export const UNCERTAIN_SCOPE = 'We could not confirm whether your changes were saved. Refresh the sharing list to check the current settings before relying on them.';
export type WriteResult = { ok: true; id?: string } | { ok: false; message: string };
export function scopeArgs(id: string, flags: PillarFlags, level: ShareLevel): ScopeArgs {
  return { p_id: id, p_eat: flags.eat, p_sleep: flags.sleep, p_move: flags.move, p_balance: flags.balance, p_level: level };
}
export async function saveShareScope(client: SharingClient, args: ScopeArgs): Promise<WriteResult> {
  try {
    const { error } = await client.rpc('update_care_share_scope', args);
    return error ? { ok: false, message: UNCERTAIN_SCOPE } : { ok: true };
  } catch { return { ok: false, message: UNCERTAIN_SCOPE }; }
}
export async function saveShareInvitation(client: SharingClient, args: InviteArgs): Promise<WriteResult> {
  try {
    const { data, error } = await client.rpc('invite_care_share_atomic', args);
    if (error || typeof data !== 'string' || !data) return { ok: false, message: UNCERTAIN_INVITE };
    return { ok: true, id: data };
  } catch { return { ok: false, message: UNCERTAIN_INVITE }; }
}
/** Keep a request ID tied to its complete payload, so a lost reply can be retried safely. */
export function invitationOperation(previous: { key: string; id: string } | null, key: string, uuid: () => string) {
  return previous?.key === key ? previous : { key, id: uuid() };
}
