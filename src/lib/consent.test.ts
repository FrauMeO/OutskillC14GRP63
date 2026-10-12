import { describe, expect, it } from 'vitest';
import {
  grantedShareCount,
  kindView,
  latestByKind,
  parsePending,
  pendingMetadata,
  pendingToWrite,
  recordPendingConsents,
  statusMessage,
  type ConsentClient,
  type ConsentRow,
  type RecordArgs,
} from './consent';

const H = 'a'.repeat(64);
const row = (kind: ConsentRow['kind'], granted: boolean, at = '2026-10-12T10:00:00Z', share: string | null = null): ConsentRow => ({
  kind,
  version: 1,
  granted,
  share_id: share,
  created_at: at,
});

describe('latestByKind and kindView', () => {
  it('takes the newest row per kind and ignores per-share rows', () => {
    const rows = [row('email_marketing', true, '2026-10-01T00:00:00Z'), row('email_marketing', false, '2026-10-02T00:00:00Z'), row('share_caregiver', true, '2026-10-03T00:00:00Z', 's1')];
    expect(latestByKind(rows).email_marketing?.granted).toBe(false);
    expect(latestByKind(rows).share_caregiver).toBeUndefined();
  });
  it('shows yes, withdrawn, and an earlier yes from before the ledger', () => {
    expect(kindView('email_marketing', [row('email_marketing', true)], false)).toMatchObject({ on: true });
    expect(kindView('email_marketing', [row('email_marketing', false)], true)).toMatchObject({ on: false }); // the ledger wins over the flag
    expect(kindView('collect_use', [], true)).toMatchObject({ on: true, summary: expect.stringContaining('before we kept a record') });
    expect(kindView('collect_use', [], false)).toMatchObject({ on: false });
    expect(kindView('collect_use', [], null)).toMatchObject({ on: null });
  });
  it('counts shares that are still agreed to', () => {
    const rows = [row('share_caregiver', true, '2026-10-01T00:00:00Z', 's1'), row('share_caregiver', false, '2026-10-02T00:00:00Z', 's2'), row('share_caregiver', true, '2026-10-03T00:00:00Z', 's3')];
    expect(grantedShareCount(rows)).toBe(2);
    expect(kindView('share_caregiver', rows, null).summary).toBe('You share with 2 people.');
    expect(kindView('share_caregiver', [], null)).toMatchObject({ on: false, summary: 'You are not sharing with anyone.' });
  });
});

describe('sign-up choices in metadata', () => {
  it('round trips', () => {
    const meta = { pending_consents: pendingMetadata([{ kind: 'collect_use', version: 1, hash: H }, { kind: 'email_marketing', version: 2, hash: 'b'.repeat(64) }]) };
    expect(parsePending(meta)).toEqual([
      { kind: 'collect_use', version: 1, hash: H },
      { kind: 'email_marketing', version: 2, hash: 'b'.repeat(64) },
    ]);
  });
  it('ignores anything malformed or not allowed at sign-up (control: a good entry survives)', () => {
    expect(parsePending(null)).toEqual([]);
    expect(parsePending({})).toEqual([]);
    expect(parsePending({ pending_consents: 'yes' })).toEqual([]);
    const bad = {
      collect_use: { v: 1, h: 'short' }, // bad hash
      email_marketing: { v: 0, h: H }, // bad version
      ai_processing: { v: 1, h: H }, // cannot be agreed to at sign-up
      share_caregiver: { v: 1, h: H }, // nor this
    };
    expect(parsePending({ pending_consents: bad })).toEqual([]);
    expect(parsePending({ pending_consents: { ...bad, collect_use: { v: 1, h: H } } })).toEqual([{ kind: 'collect_use', version: 1, hash: H }]);
    expect(parsePending({ pending_consents: { collect_use: { v: 1, h: H.toUpperCase() } } })).toEqual([]); // upper case is refused like the database does
  });
  it('writes only kinds with no ledger row', () => {
    const pending = [{ kind: 'collect_use' as const, version: 1, hash: H }, { kind: 'email_marketing' as const, version: 1, hash: H }];
    expect(pendingToWrite(pending, [])).toHaveLength(2);
    expect(pendingToWrite(pending, [row('email_marketing', false)])).toEqual([pending[0]]); // a later withdrawal is not undone
  });
});

function fakeClient(existing: ConsentRow[] = [], failOn?: string) {
  const writes: RecordArgs[] = [];
  const client: ConsentClient = {
    fetchMine: async () => existing,
    record: async (a) => {
      if (failOn === a.kind) throw new Error('offline');
      writes.push(a);
      existing.push(row(a.kind, a.granted));
    },
  };
  return { client, writes };
}
const META = { pending_consents: pendingMetadata([{ kind: 'collect_use', version: 1, hash: H }, { kind: 'email_marketing', version: 1, hash: H }]) };

describe('recordPendingConsents (the post-login effect)', () => {
  it('writes each choice once, as a grant, and a second sign-in writes nothing', async () => {
    const { client, writes } = fakeClient();
    expect(await recordPendingConsents('u1', META, client)).toHaveLength(2);
    expect(writes.map((w) => [w.kind, w.granted])).toEqual([['collect_use', true], ['email_marketing', true]]);
    expect(await recordPendingConsents('u1', META, client)).toEqual([]);
    expect(writes).toHaveLength(2); // control: the first call really wrote, the second really did not
  });
  it('does nothing without sign-up choices', async () => {
    const { client, writes } = fakeClient();
    expect(await recordPendingConsents('u2', {}, client)).toEqual([]);
    expect(writes).toEqual([]);
  });
  it('a failure does not throw or claim success; a later sign-in finishes the job', async () => {
    const existing: ConsentRow[] = [];
    const bad = fakeClient(existing, 'email_marketing');
    expect(await recordPendingConsents('u3', META, bad.client)).toHaveLength(1); // collect_use made it, marketing did not
    const good = fakeClient(existing);
    expect((await recordPendingConsents('u3', META, good.client)).map((p) => p.kind)).toEqual(['email_marketing']);
  });
  it('never throws when the first read fails', async () => {
    const client: ConsentClient = {
      fetchMine: async () => {
        throw new Error('offline');
      },
      record: async () => {},
    };
    await expect(recordPendingConsents('u4', META, client)).resolves.toEqual([]);
  });
});

describe('statusMessage', () => {
  it('says what happened in plain words', () => {
    expect(statusMessage('email_marketing', false)).toBe('You will not get news by email.');
    expect(statusMessage('ai_processing', false)).toBe('AI help is off. Nothing will be sent.');
    expect(statusMessage('email_marketing', true)).not.toBe(statusMessage('email_marketing', false));
  });
});
