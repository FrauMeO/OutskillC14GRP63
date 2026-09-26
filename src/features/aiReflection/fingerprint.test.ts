import { describe, expect, it } from 'vitest';
import { entryFingerprint } from './fingerprint';

describe('automatic reflection fingerprint', () => {
  const day = { log_date: '2026-09-26', sleep_hours: '7', mood: 4, feelings: ['calm'], notes: 'a' };

  it('changes when a logged value changes', () => {
    expect(entryFingerprint(day)).not.toBe(entryFingerprint({ ...day, mood: 3 }));
    expect(entryFingerprint(day)).not.toBe(entryFingerprint({ ...day, feelings: ['calm', 'tired'] }));
  });

  it('stays the same when only notes or unrelated fields change (control), and is null without an entry', () => {
    expect(entryFingerprint(day)).toBe(entryFingerprint({ ...day, notes: 'b', location_name: 'X' }));
    expect(entryFingerprint(null)).toBeNull();
  });
});
