export const FOUNDERS = ['Miah Shull Olmsted', 'Robert Olmsted'] as const;

export const ABOUT_STORY =
  'Build Your Pillars was started by a husband and wife who wanted a simple way to share their health journey, without confusion or pressure. It is not tied to any insurer or medical provider, and it has no ads. It is free for everyone 60 and over.';

export function foundersLine(names: readonly string[] = FOUNDERS): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
