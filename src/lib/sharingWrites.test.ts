import { describe, expect, it, vi } from 'vitest';
import { invitationOperation, saveShareInvitation, saveShareScope, scopeArgs, UNCERTAIN_INVITE, UNCERTAIN_SCOPE, type SharingClient, type InviteArgs } from './sharingWrites';
const invite: InviteArgs = { p_request_id: 'request-1', p_email: 'peer@example.test', p_eat: true, p_sleep: true, p_move: false, p_balance: false, p_level: 'presence', p_version: 1, p_text_hash: 'a'.repeat(64) };
const flags = { eat: true, sleep: true, move: false, balance: false };
describe('atomic sharing writes', () => {
  it('sends scope and disclosure level in one call without a stale pause field', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await saveShareScope({ rpc }, scopeArgs('share', flags, 'presence'))).toEqual({ ok: true });
    expect(rpc.mock.calls).toEqual([['update_care_share_scope', { p_id: 'share', p_eat: true, p_sleep: true, p_move: false, p_balance: false, p_level: 'presence' }]]);
  });
  it('never falls back to split updates when the atomic RPC is missing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function missing', code: 'PGRST202' } });
    expect(await saveShareScope({ rpc }, scopeArgs('share', flags, 'detail'))).toEqual({ ok: false, message: UNCERTAIN_SCOPE });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('sends invitation, scope and consent in exactly one request', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'share-1', error: null });
    expect(await saveShareInvitation({ rpc }, invite)).toEqual({ ok: true, id: 'share-1' });
    expect(rpc.mock.calls).toEqual([['invite_care_share_atomic', invite]]);
  });
  it.each(['throw', 'error', 'empty'])('makes no unsupported rollback claim after %s', async (kind) => {
    const rpc = kind === 'throw' ? vi.fn().mockRejectedValue(new Error('network')) : vi.fn().mockResolvedValue({ data: null, error: kind === 'error' ? { message: 'timeout' } : null });
    expect(await saveShareInvitation({ rpc }, invite)).toEqual({ ok: false, message: UNCERTAIN_INVITE });
    expect(rpc).toHaveBeenCalledTimes(1); // no compensating end call to fail separately
  });
  it('reuses the complete operation on response loss and gets the original committed result', async () => {
    const uuid = vi.fn().mockReturnValue('request-1');
    const operation = invitationOperation(null, JSON.stringify(invite), uuid);
    const retry = invitationOperation(operation, JSON.stringify(invite), uuid);
    expect(retry).toBe(operation);
    const ledger = new Map<string, string>(); let calls = 0;
    const rpc = vi.fn(async (_name, args: InviteArgs) => {
      if (!ledger.has(args.p_request_id)) ledger.set(args.p_request_id, 'share-1');
      if (++calls === 1) throw new Error('reply lost after commit');
      return { data: ledger.get(args.p_request_id), error: null };
    });
    const client = { rpc } as SharingClient;
    expect((await saveShareInvitation(client, invite)).ok).toBe(false);
    expect(await saveShareInvitation(client, { ...invite, p_request_id: retry.id })).toEqual({ ok: true, id: 'share-1' });
    expect(ledger.size).toBe(1);
    expect(uuid).toHaveBeenCalledTimes(1);
  });
  it('starts a new operation for identical choices after confirmed completion', () => {
    const completed = invitationOperation(null, 'same-payload', () => 'first');
    expect(completed.id).toBe('first');
    // UI clears its operation reference only after a confirmed server success.
    expect(invitationOperation(null, 'same-payload', () => 'second').id).toBe('second');
  });
  it('uses a fresh request when the account or any payload choice changes', () => {
    const previous = { key: 'owner-A:presence', id: 'one' };
    expect(invitationOperation(previous, 'owner-A:detail', () => 'two').id).toBe('two');
    expect(invitationOperation(previous, 'owner-B:presence', () => 'three').id).toBe('three');
  });
});
