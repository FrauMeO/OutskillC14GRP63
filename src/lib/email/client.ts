// Browser side of the email layer. The browser never holds a provider key and never chooses a recipient
// or any wording: it sends an id (a share or a nudge) and the edge function looks up the rest.
import { supabase } from '../supabase';

export type EmailRequest =
  | { kind: 'care_invite'; share_id: string } // owner, right after create_care_share returns the id
  | { kind: 'care_nudge'; nudge_id: string } // supporter, right after send_care_nudge returns the id
  | { kind: 'waitlist_confirm'; email: string; ios: boolean; android: boolean; consent: true; turnstile?: string };

export interface EmailResult {
  ok: boolean;
  sent: boolean;
  deferred: boolean;
}

/** Best effort: never throws. A failed email must not undo a share, a nudge or a sign-up. */
export async function sendEmail(request: EmailRequest): Promise<EmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', { body: request });
    if (error) return { ok: false, sent: false, deferred: false };
    return { ok: true, sent: data?.sent === true, deferred: data?.deferred === true };
  } catch {
    return { ok: false, sent: false, deferred: false };
  }
}
