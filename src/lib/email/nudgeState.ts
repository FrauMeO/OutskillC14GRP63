// What the "Thinking of you" buttons should do, as plain logic (tested). No imports on purpose.

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeBlock = 'not_allowed' | 'sent_recently' | 'busy' | null;

export function nudgeBlock(input: { allowed: boolean; lastNudgeAt: Date | null; now: Date; busy?: boolean }): NudgeBlock {
  if (!input.allowed) return 'not_allowed';
  if (input.lastNudgeAt && input.now.getTime() - input.lastNudgeAt.getTime() < DAY_MS) return 'sent_recently';
  if (input.busy) return 'busy';
  return null;
}

/** A plain reason for a disabled button. The same words are used whether the owner never turned notes on
 *  or turned them off later, so a supporter cannot tell the two apart. */
export function nudgeReasonText(block: NudgeBlock, name: string): string | null {
  switch (block) {
    case 'not_allowed':
      return `${name} has not turned on gentle notes, so they are not available.`;
    case 'sent_recently':
      return 'You sent a note today. You can send another tomorrow.';
    case 'busy':
      return 'Sending...';
    default:
      return null;
  }
}

export const NUDGE_SENT_TEXT = 'Your note is on its way. There is nothing more to do.';
export const NUDGE_SAVED_LATER_TEXT = 'Your note is saved. It will be sent at a gentler time of day.';
