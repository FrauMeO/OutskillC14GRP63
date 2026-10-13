// Supabase Edge Function: email-webhook. Receives Resend delivery events and records hard bounces and
// spam complaints in email_suppressions so we never email those addresses again. NOT DEPLOYED here.
//
// Deploy WITHOUT the Supabase JWT check, because Resend cannot send one; the signature below is the
// authentication and a request that fails it gets nothing:
//   supabase functions deploy email-webhook --no-verify-jwt
//
// Secrets (Supabase > Edge Functions > Secrets):
//   RESEND_WEBHOOK_SECRET   the "Signing secret" shown on the webhook in the Resend dashboard (starts whsec_)
//   EMAIL_HASH_KEY          the same value send-email uses (addresses are stored only as keyed hashes)
// In Resend: Webhooks > Add endpoint > https://<project-ref>.supabase.co/functions/v1/email-webhook,
// events: email.bounced, email.complained (nothing else is needed; delivery/open/click events are ignored).
//
// Resend signs with Svix: headers svix-id, svix-timestamp, svix-signature ("v1,<base64>" , space separated),
// signed content "<svix-id>.<svix-timestamp>.<raw body>", HMAC-SHA256 with the base64-decoded secret.
// Replays older than 5 minutes are refused. Idempotent: the svix-id is recorded in email_webhook_events, and
// the suppression insert ignores an address that is already listed. Bodies and addresses are never logged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hashEmail } from '../_shared/email/tokens.ts';
import { verifyWebhook } from '../_shared/email/webhookSignature.ts';

const MAX_BODY = 64 * 1024;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
  const hashKey = Deno.env.get('EMAIL_HASH_KEY') ?? '';
  if (!secret || !hashKey) return new Response('Not set up.', { status: 503 });

  const id = req.headers.get('svix-id') ?? '';
  const timestamp = req.headers.get('svix-timestamp') ?? '';
  const sigHeader = req.headers.get('svix-signature') ?? '';
  if (!id || !timestamp || !sigHeader) return new Response('Unauthorized.', { status: 401 });

  const raw = await req.text(); // the raw body: re-serialising JSON would break the signature
  if (raw.length > MAX_BODY) return new Response('Too large.', { status: 413 });
  if (!(await verifyWebhook(secret, id, timestamp, raw, sigHeader, Date.now()))) return new Response('Unauthorized.', { status: 401 });

  let event: { type?: string; data?: { to?: unknown; bounce?: { type?: string } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('Bad request.', { status: 400 });
  }

  const type = String(event.type ?? '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Already handled this delivery? Say OK so Resend stops retrying.
  const seen = await admin.from('email_webhook_events').select('event_id').eq('event_id', id).maybeSingle();
  if (seen.data) return new Response('ok');

  let reason: 'bounce' | 'complaint' | null = null;
  // Only permanent bounces suppress; a full mailbox or a temporary failure is not a reason to stop.
  if (type === 'email.bounced' && event.data?.bounce?.type === 'Permanent') reason = 'bounce';
  if (type === 'email.complained') reason = 'complaint';

  if (reason) {
    const to = Array.isArray(event.data?.to) ? (event.data!.to as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50) : [];
    for (const address of to) {
      const email_hash = await hashEmail(address, hashKey);
      // ignoreDuplicates: an address already on the list keeps its first reason.
      const { error } = await admin.from('email_suppressions').upsert({ email_hash, reason }, { onConflict: 'email_hash', ignoreDuplicates: true });
      if (error) return new Response('Try again.', { status: 500 }); // not recorded, so Resend will retry
    }
    console.log(`email-webhook: ${type} recorded for ${to.length} address(es)`);
  }

  const rec = await admin.from('email_webhook_events').insert({ event_id: id, event_type: type.slice(0, 100) });
  if (rec.error && rec.error.code !== '23505') return new Response('Try again.', { status: 500 });
  return new Response('ok');
});
