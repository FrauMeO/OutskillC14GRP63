import { OFFER_LINE } from './brandCopy';

// Credit line: "Bob Olmsted and Miah Shull Olmsted."
export const FOUNDERS = ['Bob Olmsted', 'Miah Shull Olmsted'] as const;

export const ABOUT_STORY =
  'Build Your Pillars began as Miah Shull Olmsted’s 48-hour hackathon project after she learned to build software with Claude at 60, without a traditional coding background. She and her husband wanted a warm way to notice the rhythms of their lives, reflect privately or share with someone special. It is independent, has no ads, and is not tied to an insurer or medical provider. ' + OFFER_LINE;

export function foundersLine(names: readonly string[] = FOUNDERS): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
