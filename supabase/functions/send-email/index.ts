// Supabase Edge Function: send-email. The ONLY place mail is sent from. Provider: Resend (REST).
// NOT DEPLOYED by this change. Deploy with verify_jwt = true (the default):
//   supabase functions deploy send-email
//
// Secrets, set in Supabase (Edge Functions > Secrets), never in the app or the repo:
//   RESEND_API_KEY       required. A Resend "sending access" key for the sending domain only.
//   EMAIL_FROM           required. e.g.  Build Your Pillars <notes@mail.buildyourpillars.com>
//   EMAIL_HASH_KEY       required. Long random string; keys the address hashes in email_log / email_suppressions.
//   EMAIL_LINK_SECRET    required. Long random string; derives the mute and unsubscribe link tokens.
//   APP_URL              optional. Default https://buildyourpillars.com (https origin only; links are built from it).
//   EMAIL_REPLY_TO       optional. Default hello@buildyourpillars.com
//   EMAIL_DAILY_CAP      optional. Default 90 (Resend free plan allows 100 a day).
//   EMAIL_DRY_RUN        optional. "1" = run every rule, render, but do NOT call the provider or write the log.
//   ALLOWED_ORIGINS      optional. Comma list for CORS. Default: APP_URL and http://localhost:5173.
//   TURNSTILE_SECRET     optional. If set, the waiting-list route requires a Cloudflare Turnstile token.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every function by Supabase.
//
// WHO MAY CALL WHAT (verify_jwt is on, so the gateway has already checked the token's signature):
//   care_invite       a signed-in user who OWNS the share. The address comes from the share row, never the request.
//   care_nudge        a signed-in user who is the SENDER of the nudge row (made by send_care_nudge, which
//                     enforced: owner opted in, preset only, active and not paused, 1 per day).
//   weekly_digest     service role only (a scheduler). flush_nudges: service role only.
//   waitlist_confirm  anyone holding the project's anon key (the sign-up form has no login). SAFE because the
//                     request carries only the address the person typed, the content is FIXED text, the address
//                     can get at most 1 email a day and the whole route at most 30 an hour, suppressed addresses
//                     get nothing, and no list entry or consent exists until the link in that email is used
//                     (double opt-in). The caller can never choose subject, body or any other recipient.
// Nothing is sent on revoke or pause: no code path here reacts to either.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { derivedLinkToken, generateToken, hashEmail, hashToken, normalizeEmail } from '../_shared/email/tokens.ts';
import {
  DEFAULT_DAILY_CAP,
  NUDGE_WINDOW_MS,
  dedupeKey,
  evaluateSend,
  isEmailKind,
  isNudgePreset,
  localDate,
  isQuietHour,
  utcDay,
  type EmailKind,
  type ShareState,
} from '../_shared/email/rules.ts';
import { renderEmail, FORBIDDEN_WORDING, type TemplateData } from '../_shared/email/templates.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const env = (k: string) => Deno.env.get(k) ?? '';
const appUrl = () => (env('APP_URL') || 'https://buildyourpillars.com').replace(/\/+$/, '');

function cors(req: Request): Record<string, string> {
  const allowed = (env('ALLOWED_ORIGINS') || `${appUrl()},http://localhost:5173`).split(',').map((s) => s.trim());
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

// Never log addresses, names or message text. Kind plus a short reason code only.
const note = (kind: string, what: string) => console.log(`send-email: ${kind} ${what}`);

function jwtClaims(authHeader: string | null): { role: string; sub: string | null; token: string } | null {
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return { role: String(json.role ?? ''), sub: json.sub ? String(json.sub) : null, token };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- provider
async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string | null;
  kind: EmailKind;
  idempotencyKey: string;
}): Promise<{ ok: true; id: string } | { ok: false; retryable: boolean }> {
  const key = env('RESEND_API_KEY'); // read only here, only from Deno.env
  const from = env('EMAIL_FROM');
  if (!key || !from) return { ok: false, retryable: false };
  const headers: Record<string, string> = {};
  if (args.unsubscribeUrl) headers['List-Unsubscribe'] = `<${args.unsubscribeUrl}>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': args.idempotencyKey.slice(0, 250),
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        reply_to: env('EMAIL_REPLY_TO') || 'hello@buildyourpillars.com',
        subject: args.subject,
        html: args.html,
        text: args.text,
        headers,
        tags: [{ name: 'kind', value: args.kind }],
      }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: true, id: String(j?.id ?? '') };
    }
    note(args.kind, `provider status ${res.status}`); // status code only, never the body
    return { ok: false, retryable: res.status === 429 || res.status >= 500 };
  } catch {
    note(args.kind, 'provider unreachable');
    return { ok: false, retryable: true };
  }
}

// ---------------------------------------------------------------- shared delivery
type Outcome = { sent: boolean; deferred?: boolean; reason: string };

async function deliver(
  admin: Admin,
  o: {
    kind: EmailKind;
    to: string;
    shareId: string | null;
    scope: string; // dedupe scope: a day, or "once"
    subjectId: string; // dedupe subject: the share id, or the address hash
    now: Date;
    recipientTz?: string | null;
    share?: ShareState;
    optedIn?: boolean;
    data: (recipientHash: string) => Promise<TemplateData> | TemplateData;
  },
): Promise<Outcome> {
  const hashKey = env('EMAIL_HASH_KEY');
  const to = normalizeEmail(o.to);
  if (!EMAIL_RE.test(to) || to.length > 254) return { sent: false, reason: 'bad_address' };
  const recipientHash = await hashEmail(to, hashKey);
  const key = dedupeKey(o.kind, o.subjectId, o.scope);
  const since24 = new Date(o.now.getTime() - 86_400_000).toISOString();
  const since1h = new Date(o.now.getTime() - 3_600_000).toISOString();
  const dayStart = `${utcDay(o.now)}T00:00:00Z`;
  const live = ['queued', 'sent'];

  const count = async (q: Admin) => (await q).count ?? 0;
  const [supp, dup, rAll, rKind, today, wl] = await Promise.all([
    admin.from('email_suppressions').select('id', { count: 'exact', head: true }).eq('email_hash', recipientHash),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('dedupe_key', key),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('recipient_hash', recipientHash).in('status', live).gte('created_at', since24),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('recipient_hash', recipientHash).eq('kind', o.kind).in('status', live).gte('created_at', since24),
    admin.from('email_log').select('id', { count: 'exact', head: true }).in('status', live).gte('created_at', dayStart),
    o.kind === 'waitlist_confirm'
      ? admin.from('email_log').select('id', { count: 'exact', head: true }).eq('kind', 'waitlist_confirm').in('status', live).gte('created_at', since1h)
      : Promise.resolve({ count: 0 }),
  ]);
  if ([supp, dup, rAll, rKind, today, wl].some((r) => (r as Admin).error)) return { sent: false, reason: 'db_error' };

  const decision = evaluateSend({
    kind: o.kind,
    now: o.now,
    recipientTz: o.recipientTz,
    suppressed: (await count(supp)) > 0,
    share: o.share,
    optedIn: o.optedIn,
    duplicate: (await count(dup)) > 0,
    recipientSent24h: await count(rAll),
    recipientKindSent24h: await count(rKind),
    waitlistSentLastHour: await count(wl),
    sentToday: await count(today),
    dailyCap: Number(env('EMAIL_DAILY_CAP')) || DEFAULT_DAILY_CAP,
  });
  if (!decision.send) {
    note(o.kind, `skipped: ${decision.reason}`);
    return { sent: false, deferred: decision.defer, reason: decision.reason };
  }

  const data = await o.data(recipientHash);
  const mail = renderEmail(data, appUrl());
  if (FORBIDDEN_WORDING.test(mail.text) || FORBIDDEN_WORDING.test(mail.subject)) {
    note(o.kind, 'blocked: wording check');
    return { sent: false, reason: 'wording' };
  }

  const dry = env('EMAIL_DRY_RUN') === '1';
  if (dry) {
    note(o.kind, 'dry run: rules passed, nothing sent, nothing logged');
    return { sent: true, reason: 'dry_run' };
  }

  // Claim first (unique dedupe key), then send, then record the result.
  const claim = await admin
    .from('email_log')
    .insert({ kind: o.kind, recipient_hash: recipientHash, share_id: o.shareId, status: 'queued', dedupe_key: key })
    .select('id')
    .single();
  if (claim.error || !claim.data) return { sent: false, reason: 'duplicate' };

  const result = await sendViaResend({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    unsubscribeUrl: mail.unsubscribeUrl,
    kind: o.kind,
    idempotencyKey: key,
  });
  if (!result.ok) {
    // Clear the key so a later attempt may claim it again.
    await admin.from('email_log').update({ status: 'failed', dedupe_key: null }).eq('id', claim.data.id);
    return { sent: false, deferred: result.retryable, reason: 'provider' };
  }
  await admin.from('email_log').update({ status: 'sent', provider_id: result.id }).eq('id', claim.data.id);
  return { sent: true, reason: 'ok' };
}

const toShareState = (s: { status: string; paused_at: string | null; created_at: string }): ShareState => ({
  status: s.status as ShareState['status'],
  paused: s.paused_at !== null,
  createdAt: new Date(s.created_at),
});

async function profileName(admin: Admin, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  return (data?.full_name as string | null) ?? null;
}

async function userEmail(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const u = data?.user;
  return u?.email && u.email_confirmed_at ? u.email : null;
}

/** Link token for a share and purpose; its hash is stored so the database can honour the link. */
async function ensureLinkToken(admin: Admin, shareId: string, column: 'mute_token_hash' | 'digest_token_hash', purpose: string): Promise<string> {
  const token = await derivedLinkToken(env('EMAIL_LINK_SECRET'), purpose, shareId);
  const hash = await hashToken(token);
  await admin.from('care_share_email_prefs').update({ [column]: hash }).eq('share_id', shareId);
  return token;
}

// ---------------------------------------------------------------- kinds
async function sendInvite(admin: Admin, userId: string, shareId: string, now: Date): Promise<Outcome> {
  const { data: s } = await admin
    .from('care_shares')
    .select('id, owner_id, viewer_email, status, paused_at, created_at')
    .eq('id', shareId)
    .maybeSingle();
  if (!s || s.owner_id !== userId) return { sent: false, reason: 'not_found' };
  const owner = await profileName(admin, s.owner_id);
  return deliver(admin, {
    kind: 'care_invite',
    to: s.viewer_email,
    shareId: s.id,
    subjectId: s.id,
    scope: 'once', // one invitation email per share, ever
    now,
    share: toShareState(s),
    data: () => ({ kind: 'care_invite', ownerName: owner }),
  });
}

async function sendNudge(admin: Admin, nudgeId: string, actingUser: string | null, now: Date): Promise<Outcome> {
  const { data: n } = await admin.from('care_nudges').select('id, share_id, sender_id, preset, created_at, emailed_at').eq('id', nudgeId).maybeSingle();
  if (!n || (actingUser !== null && n.sender_id !== actingUser)) return { sent: false, reason: 'not_found' };
  if (n.emailed_at) return { sent: false, reason: 'already_sent' };
  if (!isNudgePreset(n.preset)) return { sent: false, reason: 'bad_preset' };
  if (now.getTime() - new Date(n.created_at).getTime() > NUDGE_WINDOW_MS) return { sent: false, reason: 'stale' };
  const { data: s } = await admin.from('care_shares').select('id, owner_id, viewer_id, status, paused_at, created_at').eq('id', n.share_id).maybeSingle();
  if (!s || s.viewer_id !== n.sender_id) return { sent: false, reason: 'not_found' };
  const { data: prefs } = await admin.from('care_share_email_prefs').select('owner_allows_nudges, owner_tz').eq('share_id', s.id).maybeSingle();
  const ownerEmail = await userEmail(admin, s.owner_id);
  if (!ownerEmail) return { sent: false, reason: 'no_address' };
  const supporter = await profileName(admin, s.viewer_id);

  const out = await deliver(admin, {
    kind: 'care_nudge',
    to: ownerEmail,
    shareId: s.id,
    subjectId: s.id,
    scope: utcDay(now),
    now,
    recipientTz: prefs?.owner_tz ?? null,
    share: toShareState(s),
    optedIn: prefs?.owner_allows_nudges === true,
    data: async () => ({
      kind: 'care_nudge',
      supporterName: supporter,
      preset: n.preset,
      muteToken: await ensureLinkToken(admin, s.id, 'mute_token_hash', 'owner-mute'),
    }),
  });
  if (out.sent) await admin.from('care_nudges').update({ emailed_at: now.toISOString() }).eq('id', n.id);
  return out;
}

async function flushNudges(admin: Admin, now: Date): Promise<{ sent: number; tried: number }> {
  const since = new Date(now.getTime() - NUDGE_WINDOW_MS).toISOString();
  const { data } = await admin.from('care_nudges').select('id').is('emailed_at', null).gte('created_at', since).order('created_at').limit(50);
  let sent = 0;
  for (const row of data ?? []) {
    const out = await sendNudge(admin, row.id, null, now);
    if (out.sent) sent++;
  }
  return { sent, tried: (data ?? []).length };
}

async function runDigests(admin: Admin, now: Date): Promise<{ sent: number; considered: number }> {
  const { data: rows, error } = await admin.rpc('email_digest_inputs');
  if (error) return { sent: 0, considered: 0 };
  let sent = 0;
  for (const r of rows ?? []) {
    const tz: string | null = r.supporter_tz ?? null;
    const local = localDate(now, tz);
    // Sunday only, in the supporter's own time, and never in quiet hours. Run the job every hour.
    if (local.weekday !== 0 || isQuietHour(now, tz)) continue;
    if (r.days_logged < 1) continue; // nothing to say: stay silent rather than report an empty week
    const { data: s } = await admin.from('care_shares').select('id, status, paused_at, created_at').eq('id', r.share_id).maybeSingle();
    if (!s) continue;
    let pillars: { pillar: 'eat' | 'sleep' | 'move' | 'balance'; trend: 'about_usual' | 'a_little_lower' | 'a_little_higher' | 'not_enough_days' }[] = [];
    if (r.level === 'summary') {
      const t = await admin.rpc('email_week_trends', { p_share_id: r.share_id });
      pillars = (t.data ?? []).map((x: { pillar: 'eat'; trend: 'about_usual' }) => ({ pillar: x.pillar, trend: x.trend }));
    }
    const out = await deliver(admin, {
      kind: 'weekly_digest',
      to: r.viewer_email,
      shareId: r.share_id,
      subjectId: r.share_id,
      scope: local.date, // the supporter's local Sunday: one digest per share per local day
      now,
      recipientTz: tz,
      share: toShareState(s),
      optedIn: true,
      data: async () => ({
        kind: 'weekly_digest',
        ownerName: r.owner_name,
        level: r.level === 'presence' ? 'presence' : 'summary',
        daysLogged: r.days_logged,
        pillars,
        unsubscribeToken: await ensureLinkToken(admin, r.share_id, 'digest_token_hash', 'supporter-unsub'),
      }),
    });
    if (out.sent) sent++;
  }
  return { sent, considered: (rows ?? []).length };
}

async function turnstileOk(token: unknown): Promise<boolean> {
  const secret = env('TURNSTILE_SECRET');
  if (!secret) return true; // not configured: rely on the caps above
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
    });
    const j = await res.json();
    return j?.success === true;
  } catch {
    return false;
  }
}

async function waitlistConfirm(admin: Admin, body: Record<string, unknown>, now: Date): Promise<Outcome> {
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return { sent: false, reason: 'bad_address' };
  if (body.consent !== true) return { sent: false, reason: 'no_consent' };
  const ios = body.ios === true;
  const android = body.android === true;
  if (!ios && !android) return { sent: false, reason: 'no_store' };
  if (!(await turnstileOk(body.turnstile))) return { sent: false, reason: 'challenge' };

  // Already confirmed earlier: say nothing different to the caller, send nothing.
  const { data: existing } = await admin.from('waitlist').select('id').eq('email', email).maybeSingle();
  if (existing) return { sent: false, reason: 'already_listed' };

  const token = generateToken(); // 32 random bytes; only its SHA-256 is stored
  const tokenHash = await hashToken(token);
  const out = await deliver(admin, {
    kind: 'waitlist_confirm',
    to: email,
    shareId: null,
    subjectId: await hashEmail(email, env('EMAIL_HASH_KEY')),
    scope: utcDay(now),
    now,
    data: async () => {
      // The row is written only once every rule has passed and we are about to send.
      if (env('EMAIL_DRY_RUN') !== '1') {
        const ins = await admin.from('waitlist_confirmations').insert({ token_hash: tokenHash, email, want_ios: ios, want_android: android });
        if (ins.error) throw new Error('confirmation row failed');
      }
      return { kind: 'waitlist_confirm', confirmToken: token };
    },
  });
  if (!out.sent && out.reason === 'provider') {
    await admin.from('waitlist_confirmations').delete().eq('token_hash', tokenHash); // nothing was sent: drop the row
  }
  return out;
}

// ---------------------------------------------------------------- entry point
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { error: 'Use POST.' }, 405);

  const claims = jwtClaims(req.headers.get('Authorization'));
  if (!claims) return reply(req, { error: 'Please log in.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(req, { error: 'Bad request.' }, 400);
  }
  const kind = body?.kind;
  const isCron = kind === 'flush_nudges' || (kind === 'weekly_digest' && body?.cron === true);
  if (!isCron && !isEmailKind(kind)) return reply(req, { error: 'Bad request.' }, 400);

  if (!env('RESEND_API_KEY') || !env('EMAIL_FROM') || !env('EMAIL_HASH_KEY') || !env('EMAIL_LINK_SECRET')) {
    return reply(req, { error: 'Email is not set up yet.' }, 503);
  }
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const now = new Date();

  try {
    // --- scheduler routes: service role only ---
    if (isCron) {
      if (claims.role !== 'service_role') return reply(req, { error: 'Not allowed.' }, 403);
      if (kind === 'flush_nudges') return reply(req, { ok: true, ...(await flushNudges(admin, now)) });
      return reply(req, { ok: true, ...(await runDigests(admin, now)) });
    }

    // --- the public sign-up route: anon key accepted, fixed content, see the header comment ---
    if (kind === 'waitlist_confirm') {
      if (claims.role !== 'anon' && claims.role !== 'authenticated') return reply(req, { error: 'Not allowed.' }, 403);
      await waitlistConfirm(admin, body, now);
      return reply(req, { ok: true }); // the same answer whatever happened: no one can probe the list
    }

    // --- everything else needs a real signed-in user ---
    if (claims.role !== 'authenticated' || !claims.sub) return reply(req, { error: 'Please log in.' }, 401);
    const { data: who } = await admin.auth.getUser(claims.token);
    if (!who?.user || who.user.id !== claims.sub) return reply(req, { error: 'Please log in.' }, 401);

    if (kind === 'care_invite') {
      const id = String(body.share_id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(req, { error: 'Bad request.' }, 400);
      const out = await sendInvite(admin, who.user.id, id, now);
      return reply(req, { ok: true, sent: out.sent && out.reason !== 'dry_run' });
    }
    if (kind === 'care_nudge') {
      const id = String(body.nudge_id ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply(req, { error: 'Bad request.' }, 400);
      const out = await sendNudge(admin, id, who.user.id, now);
      return reply(req, { ok: true, sent: out.sent, deferred: out.deferred === true });
    }
    // weekly_digest without the cron flag is not available to users
    return reply(req, { error: 'Not allowed.' }, 403);
  } catch {
    note(String(kind), 'unexpected error');
    return reply(req, { error: 'Something went wrong.' }, 500);
  }
});
