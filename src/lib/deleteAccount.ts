// Deleting an account cannot be undone, so the person types a word to confirm.
export const DELETE_WORD = 'delete';

export function canConfirmDelete(typed: string): boolean {
  return typed.trim().toLowerCase() === DELETE_WORD;
}
