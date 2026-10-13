import { describe, expect, it } from 'vitest';
import { canConfirmDelete } from './deleteAccount';

describe('canConfirmDelete', () => {
  it('accepts the word in any case, with spaces around it', () => {
    expect(canConfirmDelete('delete')).toBe(true);
    expect(canConfirmDelete('  DELETE ')).toBe(true);
  });
  it('rejects anything else, including empty and near misses', () => {
    expect(canConfirmDelete('')).toBe(false);
    expect(canConfirmDelete('deleted')).toBe(false);
    expect(canConfirmDelete('del ete')).toBe(false);
  });
});
