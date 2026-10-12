// Best-effort copy of the person's AI consent choice to the server (migration 0019: profiles.ai_consent_at,
// ai_consent_version, set_ai_consent). The Edge Function refuses to call the model without it, so this
// is the proof of consent that a regulator or an app-store reviewer can be shown.
//
// Rules: never block the screen, never throw, never crash if the database function does not exist yet
// (migration not applied), and never touch what the person sees: the browser copy stays the fast gate.
import { CONSENT_VERSION } from './aiConsent';

export type ConsentRpc = (granted: boolean, version: number) => PromiseLike<{ error: unknown }>;

// Returns true when the server accepted the change. Any failure (offline, function missing, signed
// out) returns false and is swallowed.
export async function syncConsentToServer(call: ConsentRpc, granted: boolean, version = CONSENT_VERSION): Promise<boolean> {
  try {
    const { error } = await call(granted, version);
    return !error;
  } catch {
    return false;
  }
}

// One sync per person per page load for the choice already stored in this browser (people who said yes
// before migration 0019 have no server record until this runs). A change made now always syncs.
const syncedThisLoad = new Map<string, boolean>();

export function shouldSyncStored(userId: string, granted: boolean): boolean {
  if (syncedThisLoad.get(userId) === granted) return false;
  syncedThisLoad.set(userId, granted);
  return true;
}

export function noteSynced(userId: string, granted: boolean): void {
  syncedThisLoad.set(userId, granted);
}

export function resetSyncState(): void {
  syncedThisLoad.clear();
}
