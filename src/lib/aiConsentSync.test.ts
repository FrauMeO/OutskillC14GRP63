import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_VERSION } from './aiConsent';
import { noteSynced, resetSyncState, shouldSyncStored, syncConsentToServer } from './aiConsentSync';

beforeEach(() => resetSyncState());

describe('syncConsentToServer', () => {
  it('sends the choice and the current consent version', async () => {
    const call = vi.fn().mockResolvedValue({ error: null });
    expect(await syncConsentToServer(call, true)).toBe(true);
    expect(call).toHaveBeenCalledWith(true, CONSENT_VERSION);
    expect(await syncConsentToServer(call, false)).toBe(true);
    expect(call).toHaveBeenLastCalledWith(false, CONSENT_VERSION);
  });

  it('never throws: a missing database function, a network failure or a thrown error all return false', async () => {
    const missing = vi.fn().mockResolvedValue({ error: { code: 'PGRST202', message: 'function not found' } });
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    const explodes = vi.fn(() => {
      throw new Error('sync throw');
    });
    expect(await syncConsentToServer(missing, true)).toBe(false);
    expect(await syncConsentToServer(offline, true)).toBe(false);
    expect(await syncConsentToServer(explodes, true)).toBe(false);
  });
});

describe('syncing the choice already stored in this browser', () => {
  it('runs once per person and per choice per page load, and again when the choice differs', () => {
    expect(shouldSyncStored('u1', true)).toBe(true);
    expect(shouldSyncStored('u1', true)).toBe(false); // already done
    expect(shouldSyncStored('u2', true)).toBe(true); // control: another person
    expect(shouldSyncStored('u1', false)).toBe(true); // a withdrawal is a new choice
  });
  it('a change made just now counts as synced', () => {
    noteSynced('u1', true);
    expect(shouldSyncStored('u1', true)).toBe(false);
  });
});
