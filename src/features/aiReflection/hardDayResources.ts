// Crisis help shown under the fixed hard-day and hard-week messages. It reuses the lists already in the
// gentle check-in (resourcesFor in src/lib/reflection.ts), so no phone number is written twice. With a
// country we know, the national line and the emergency number come first. With none, the local-emergency
// line and findahelpline.com are shown (CLAUDE.md: findahelpline.com is the fallback).
import { resourcesFor, type Resource } from '../../lib/reflection';

// Reasons the function returns with a hard-day or hard-week message.
export const HARD_REASONS: ReadonlySet<string> = new Set(['hard-day', 'hard-week']);

export const needsSupportLines = (reason: string | null | undefined): boolean => !!reason && HARD_REASONS.has(reason);

// item9 = 1 asks resourcesFor for the crisis list (the same list shown when a person answers the
// last check-in question above zero).
export function hardDayResources(countryCode: string | null | undefined): Resource[] {
  return resourcesFor(countryCode ?? null, 'calm', 1).crisis;
}
