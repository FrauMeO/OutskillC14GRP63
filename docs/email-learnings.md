# Email in Build Your Pillars: what we built, what we learned, what to copy into LettieNotes

Written 12 October 2026. Status: all code written and tested locally; **nothing deployed, no migration applied, no email sent, no DNS or secret changed.** Items marked **UNVERIFIED** could not be checked from here.

Why this exists: Miah wants the email features working in this free app so the lessons can shape the design of a separate facilities safety-monitoring service (LettieNotes, built with Lovable). So the layer is provider-agnostic and the choices are written down.

---

## 1. Choosing the provider (decided from official pages, fetched 12 Oct 2026)

| | Resend | Postmark | Amazon SES | Brevo | MailerSend |
|---|---|---|---|---|---|
| Free tier | 3,000/month, **100/day cap** | 100/month, no overage allowed | New accounts: up to $200 credits within 12 months, or a 6-month free plan | 300/day (secondary sources only, **UNVERIFIED**: official page would not load as text) | 500/month, 100 API requests/day |
| After free | Pro $20/mo for 50,000 incl.; $0.90 per extra 1,000 (pay-as-you-go on) | Basic $15/mo for 10,000; $1.80 per extra 1,000 | $0.10 per 1,000 | Starter about $9/mo for 5,000 up to about $69 for 100,000 (secondary, **UNVERIFIED**) | Hobby $7/mo for 5,000; $0.90 to $1.50 per extra 1,000; the page contradicts itself on the 100k figure |
| REST API (Deno friendly) | Yes, one POST with a bearer key, `Idempotency-Key` header | Yes | Yes, but request signing (SigV4) is heavy in an edge function | Yes | Yes |
| Bounce and complaint webhooks | Yes: `email.bounced`, `email.complained`, **signed (Svix)**; free plan 1 endpoint | Yes (bounce, spam complaint) but **not signed**: Basic Auth in the URL or IP allow-list | Via SNS notifications (more plumbing; not fetched) | `hard_bounce`, `spam` events; signing not on the page I read | Webhooks exist (1 on free); events not checked |
| Supabase Auth custom SMTP | Documented | Documented | Documented | Documented | Not in Supabase's list (SMTP is standard, so probably works) |
| Lovable first-party support | **Yes: a documented Resend connector** (docs.lovable.dev/integrations/resend). It sends mail, but cannot verify domains or receive webhooks | Not on Lovable's integrations page | Not on the page | Not on the page | Not on the page |
| Own-domain DKIM/SPF/DMARC | Yes, 3 domains free | Yes | Yes | Yes | Yes |
| Rate limit | 10 requests/second per team, 429 with `retry-after` | not checked | account quota | not checked | not checked |

**Cost per month at three volumes** (transactional only, one email = one message):

| Emails/month | Resend | Postmark | SES | Brevo | MailerSend |
|---|---|---|---|---|---|
| 1,000 | **$0** (stay under 100 a day) | $15 (free tier is only 100) | about $0.10 | $0 (if the 300/day figure holds) | $7 (free tier is 500) |
| 10,000 | **$20** (Pro) | $15 | about $1 | about $9 or more (UNVERIFIED) | next tier up from $7 (UNVERIFIED) |
| 100,000 | **$35** (Pro 100k tier on the pricing page; Scale lists $90) | about $177 Basic, about $133.50 Pro (the page does not list 100k; these are computed from base plus overage) | about $10 | about $69 (UNVERIFIED) | about $68 (FAQ figure, conflicting) |

**Decision: Resend.** Reasons, in order: (1) free tier fits a free app at launch scale and the paid step is a flat $20; (2) one `fetch` call from a Deno edge function, no SDK needed; (3) Supabase documents it for Auth SMTP and Resend documents Supabase Edge Functions; (4) Lovable documents a Resend connector, which matters for LettieNotes; (5) signed webhooks. Costs to know: the **100 emails a day** cap on the free plan (the function caps itself at 90 so account emails still get through), Postmark is the usual pick when deliverability matters above price (a reputation claim, not verified here), and SES is the cheapest at scale but costs engineering time.

Sources: https://resend.com/pricing, https://resend.com/docs/api-reference/rate-limit, https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests, https://resend.com/docs/dashboard/webhooks/event-types, https://resend.com/docs/webhooks/emails/bounced, https://resend.com/docs/api-reference/emails/send-email, https://resend.com/docs/send-with-smtp, https://resend.com/docs/send-with-supabase-edge-functions, https://postmarkapp.com/pricing, https://postmarkapp.com/developer/webhooks/webhooks-overview, https://aws.amazon.com/ses/pricing/, https://developers.brevo.com/docs/transactional-webhooks, https://www.mailersend.com/pricing, https://supabase.com/docs/guides/auth/auth-smtp, https://docs.lovable.dev/integrations/introduction, https://docs.lovable.dev/integrations/resend. Brevo pricing: https://www.brevo.com/pricing/ (would not render as text; secondary sources only).

**Swapping providers** touches one function: `sendViaResend` in `supabase/functions/send-email/index.ts`, plus the signature check in `src/lib/email/webhookSignature.ts` (Postmark would use Basic Auth instead). Templates, rules, tokens, tables and UI do not know the provider's name.

---

## 2. What was built

```
src/lib/email/
  tokens.ts            random tokens, SHA-256, keyed address hash, stable link tokens (Web Crypto; Deno + Node + browser)
  rules.ts             kinds, presets, limits, quiet hours, dedupe key, evaluateSend() (pure)
  templates.ts         renderEmail(): subject + HTML + plain text for the four emails (pure)
  webhookSignature.ts  Svix-style signature check (pure)
  magicLink.ts         wording and error handling for "Email me a sign-in link" (pure)
  nudgeState.ts        when the nudge buttons are off, and the plain reason (pure)
  client.ts            sendEmail(): browser to edge function (best effort, never throws)
  prefs.ts             reads/writes the choices (untyped Supabase view until database.types.ts is updated)
  *.test.ts            61 new tests, each rule with a control case that must fail/pass the other way
src/components/  NudgeButtons.tsx  EmailPrefsPanel.tsx  MagicLinkLogin.tsx  EmailLinkLanding.tsx
supabase/functions/send-email/index.ts     the only sender (verify_jwt ON)
supabase/functions/email-webhook/index.ts  bounces and complaints (deploy --no-verify-jwt; the signature is the auth)
supabase/functions/_shared/email/          byte-identical copies of the four pure modules (a test fails if they drift)
supabase/migrations/0017_email.sql         tables, RLS, definer functions
supabase/tests/email_test_after_0017.sql   rolled-back SQL test (needs 0015 applied)
scripts/preview-emails.ts                  render every email to files: `npx vite-node scripts/preview-emails.ts`
```

Why duplicated copies in `_shared`: Supabase bundles imports inside `supabase/functions`; imports that climb out to `src/` are not reliable across CLI versions. The pure modules import nothing, so a plain copy is safe, and `ui.test.ts` fails the build if a copy differs. After editing a file in `src/lib/email/`, run `cp src/lib/email/{tokens,rules,templates,webhookSignature}.ts supabase/functions/_shared/email/`.

### The four emails and who triggers them

| Kind | Trigger | Recipient comes from | Gate |
|---|---|---|---|
| `care_invite` | Owner's browser calls send-email with the share id right after `create_care_share` | the share row (`viewer_email`), never the request | caller must own the share; share pending and under 14 days; one per share ever |
| `care_nudge` | Supporter's browser calls `send_care_nudge` (database makes the row and checks every rule), then send-email with the nudge id | owner's confirmed auth email | caller must be the sender; owner opted in; share active and not paused; preset only; 1 per share per rolling 24 h; quiet hours (held, sent later by `flush_nudges`) |
| `weekly_digest` | A scheduler (service role) calls `{"kind":"weekly_digest","cron":true}` hourly | supporter's confirmed auth email | supporter opted in; share active, not paused; their local Sunday and not quiet hours; at least 1 logged day (silent otherwise); level limits content |
| `waitlist_confirm` | Sign-up form calls send-email with `{email, ios, android, consent:true}` using only the anon key | the address typed | see "Waitlist route" below |

**Waitlist route (anonymous, designed safely).** `verify_jwt` is on, but the project's anon key is itself a valid JWT, so the gateway lets it through. That is the one place an anonymous caller reaches the function, so it is boxed in: the request carries only the address (no subject, no body, no other recipient); the text is fixed in code; one email per address per 24 h and 30 per hour across the whole route; suppressed addresses get nothing; optional Cloudflare Turnstile if `TURNSTILE_SECRET` is set; the caller always gets the same `{ok:true}` so the list cannot be probed; and **no list entry or consent exists until the emailed link is used** (double opt-in, fixes security review M1). Token: 32 random bytes, only its SHA-256 stored, 48 hours, one use, consent time never overwritten by a repeat sign-up.
**Caveat (UNVERIFIED):** if the project uses the new `sb_publishable_` keys, they are not JWTs and the gateway will refuse the signed-out call while `verify_jwt` is on. Fix: deploy a second copy of the function as `waitlist-confirm` with `--no-verify-jwt` and keep only the waitlist route in it.

**Invite expiry (M2).** The invitation email says 14 days, matching the 14-day check that 0014 already enforces in `accept_care_share`; `evaluateSend` also refuses to send an invite for a share older than 14 days.

### Safety and tone (from the caregiver brief)
- Everything defaults OFF (both new flags `false`). Turning off, pausing, ending: **no email, by construction** (no code path reacts to them; `send_care_nudge`, the function and the digest all re-check `active` and not paused).
- Nudges: two fixed phrases, checked in the database (`check` constraint), in `rules.ts`, and in the template (unknown text throws). No free text exists anywhere.
- No read receipts: no tracking pixel, no click tracking (keep **open and click tracking OFF** in the Resend domain settings), the owner is never told a note was opened, and muting does not notify the supporter.
- The supporter sees the same disabled button and words whether the owner never enabled notes or muted them later, so a mute is not visible as a refusal.
- Nothing says "missed", no red, no urgency; a week with zero logged days sends nothing at all. A test scans every email for alarm words.
- Every email says why you got it and how to stop it. Invites: "If you were not expecting this, ignore it: nothing is shared until you accept and log in."
- Emails never contain health values or the owner's surname. The digest has day counts and trend words only.
- Coercion risk: the owner's switch and the mute link are the only control over notes; the owner is never emailed about the supporter's choices; the 90-day "still happy sharing?" prompt belongs to 0015/C2.

### Quiet hours
No sends 21:00 to 08:00 **recipient local time** for nudges and digests (invites and confirmations are exempt: the person just acted). Zone comes from the browser when the person flips the switch (`set_nudge_pref` / `set_digest_pref` store it). If unknown: UTC 02:00 to 13:00 is quiet (night in the Americas, evening to morning elsewhere). A quiet-hour nudge is saved and sent by the hourly `flush_nudges` job within 24 h; after that it is dropped.

---

## 3. Steps for Miah (names only; nothing here has been done)

**Order:** review 0017, apply it after 0015; set secrets; add DNS; deploy the two functions; add the Resend webhook; set Supabase Auth SMTP; schedule the jobs; mount the UI.

1. **Resend:** create an account, add the sending domain, create an API key with *sending access* limited to that domain.
2. **DNS** (you add these in your DNS host; I added none). Recommended sending name: `mail.buildyourpillars.com`, so mail reputation and your normal `hello@` mail stay separate. Resend generates the exact values when you add the domain; copy them, do not retype from memory:
   - **SPF**: a TXT record on the sending subdomain (Resend shows it, together with an MX record for bounce handling).
   - **DKIM**: a TXT record named like `resend._domainkey.mail` holding the public key Resend shows.
   - **DMARC**: a TXT record `_dmarc.buildyourpillars.com` starting `v=DMARC1; p=none; rua=mailto:<an address you read>`. Start with `p=none` for two weeks, read the reports, then move to `quarantine`.
   - Wait for Resend to show all records Verified before sending anything.
3. **Supabase secrets** (Edge Functions > Secrets): `RESEND_API_KEY`, `EMAIL_FROM` (for example `Build Your Pillars <notes@mail.buildyourpillars.com>`), `EMAIL_HASH_KEY` (long random), `EMAIL_LINK_SECRET` (long random, different), `RESEND_WEBHOOK_SECRET` (after step 5). Optional: `APP_URL`, `EMAIL_REPLY_TO`, `EMAIL_DAILY_CAP`, `ALLOWED_ORIGINS`, `TURNSTILE_SECRET`, `EMAIL_DRY_RUN`. Keep `EMAIL_HASH_KEY` safe: changing it orphans the suppression list.
4. **Deploy:** `supabase functions deploy send-email` and `supabase functions deploy email-webhook --no-verify-jwt`.
5. **Resend webhook:** endpoint `https://gzsawayrorlcjmpssalc.supabase.co/functions/v1/email-webhook`, events `email.bounced` and `email.complained`; copy its signing secret into `RESEND_WEBHOOK_SECRET`.
6. **Supabase Auth custom SMTP** (so sign-in, sign-up confirmation and password-reset mail also go through Resend; the built-in sender allows only 2 messages an hour):
   Dashboard > Authentication > Emails > SMTP Settings > turn on Custom SMTP. Sender email `no-reply@mail.buildyourpillars.com`, sender name `Build Your Pillars`, host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key (a separate key just for Auth is cleaner). Save. Then Authentication > Rate Limits and raise the email limit from the default 30 an hour to something your plan allows. Also Authentication > URL Configuration must list the real site URL (and `https://buildyourpillars.com/**`) so sign-in links return to the app. Consider shortening Email OTP expiry (Authentication > Providers > Email) for the sign-in link.
7. **Schedule two jobs** (pg_cron + pg_net, service-role key kept in Vault, never pasted into SQL you commit): hourly `POST /functions/v1/send-email` with body `{"kind":"weekly_digest","cron":true}`, and hourly `{"kind":"flush_nudges"}`, both with `Authorization: Bearer <service role key>`.
8. **Waiting list cut-over:** switch `WaitlistForm` to call `sendEmail({kind:'waitlist_confirm',...})` and show "Check your email to confirm". Only then run the commented `revoke execute on function public.join_waitlist(...)` at the foot of 0017, which closes M1's open path.
9. **Update types:** add the 0017 tables and functions to `src/lib/database.types.ts` and `docs/schema-log.md` (not done here to avoid colliding with the 0015 work), then drop the cast in `src/lib/email/prefs.ts`.

### Where to mount the UI (I did not edit these files)
- `src/pages/AuthPage.tsx`, inside the **login** form under the password button: `<MagicLinkLogin />` (import from `../components/MagicLinkLogin`). Optional `defaultEmail={email}`.
- `src/pages/FollowingPerson.tsx` (supporter view of one person): `<NudgeButtons shareId={share.share_id} ownerName={share.owner_name} />`.
- `src/pages/Settings.tsx` (or just under `SharingSettings`): `<EmailPrefsPanel />`. It shows nothing unless the person shares with someone or follows someone.
- `src/App.tsx`, a **public** route (no login, no layout): `<Route path="/email" element={<EmailLinkLanding />} />`. This is the page behind every confirm, mute and unsubscribe link.
- `src/components/SharingSettings.tsx`, right after `create_care_share` returns the id: `void sendEmail({ kind: 'care_invite', share_id: id })` (import from `../lib/email/client`). Best effort: a failed email must not undo the share, and the owner's screen should keep saying "waiting for <email>".

---

## 4. Consent, legal basis, retention (not legal advice; **[LEGAL]** to confirm)

| Email | Basis | Why | Stop |
|---|---|---|---|
| Sign-in link, sign-up confirmation, password reset (Supabase Auth) | Art. 6(1)(b) contract | the person asked | none needed; ignore it |
| `care_invite` | Art. 6(1)(f) legitimate interest (a third party's address, entered by the owner) | one email, no health data, expires, says how to ignore | do nothing; address is not used for anything else |
| `care_nudge` | Art. 6(1)(a) consent of the **recipient** (the owner switches it on) | default off, per share | mute link in every email; Settings switch |
| `weekly_digest` | Art. 6(1)(a) consent of the **recipient** (the supporter switches it on) | default off, per share | unsubscribe link and `List-Unsubscribe` header; Settings switch |
| `waitlist_confirm` and the later launch notice | Art. 6(1)(a) consent, **double opt-in** | consent recorded only after the click, with the time | ignore it (never added) or write hello@buildyourpillars.com |

The digest and nudges are about a person who has consented to share with the recipient; the owner's data stays within the level they chose.

**Retention.** `email_log`: 90 days. No job was created; to purge by hand: `delete from public.email_log where created_at < now() - interval '90 days';` (same statement is in the 0017 comments, along with `email_webhook_events` and `waitlist_confirmations` older than 7 days). `email_suppressions` keeps a keyed hash (not the address) so we never re-mail a bounce, complaint or unsubscribe; this is a legitimate-interest record and is kept until you decide otherwise. It still counts as personal data (pseudonymous): to erase one person on request, compute their hash with `EMAIL_HASH_KEY` and delete that row. Deleting an account cascades the preference rows and nudges; log rows keep only the hash and lose their share link.

---

## 5. Testing without sending
- **Read the emails:** `npx vite-node scripts/preview-emails.ts out-folder` writes every email as .html and .txt with made-up names.
- **Unit tests:** `npm test` covers templates (escaping, tone, links), rules (limits, quiet hours), tokens, webhook signature, nudge and sign-in-link logic. Each rule has a control case that proves the check can fail.
- **SQL:** `supabase/tests/email_test_after_0017.sql` (rolled back). It was run once on a scratch PostgreSQL 17 with 0001-0014 plus a stand-in for 0015's two columns and produced the expected result on every check; run it against the real database after 0015 and 0017 are applied.
- **Function dry run:** set `EMAIL_DRY_RUN=1` as a secret (or in `.env` for `supabase functions serve send-email --env-file`): every rule runs and the email is rendered, but the provider is not called and nothing is logged. Remove it to go live.
- **Provider sandbox:** Resend documents special test recipients such as `delivered@resend.dev`, `bounced@resend.dev` and `complained@resend.dev` (**UNVERIFIED** here); they let you exercise delivery and the webhook without a real inbox. `onboarding@resend.dev` only delivers to the account owner (verified on Lovable's Resend page).
- **Webhook:** use the Resend dashboard's test event to confirm the 200 and the row in `email_suppressions`.

## 6. Rate limits and what happens at them
- Resend: 10 API requests a second per team (429 with `retry-after`); free plan 100 emails a day. Our function sends one at a time, so it never gets near 10/s; the daily cap (`EMAIL_DAILY_CAP`, default 90) defers the rest. A 429 or 5xx marks the log row failed and clears its dedupe key, so a retry is possible.
- Supabase Auth: 2 messages an hour on the built-in sender, 30 an hour on custom SMTP until raised.
- Ours: 5 emails per address per 24 h, 1 nudge per share per rolling 24 h, 1 waitlist confirmation per address per 24 h, 30 an hour across the waiting-list route.

## 7. Bounces and complaints
Resend sends `email.bounced` (we suppress only `Permanent` bounces; a full mailbox is not a reason to stop) and `email.complained`. The webhook verifies the Svix signature on the **raw** body, refuses anything older than 5 minutes, records the delivery id (so retries are harmless), stores only the keyed hash, and never logs bodies or addresses. Every send checks the list first. Complaints and bounces on **Supabase Auth** mail arrive at the same endpoint, so those addresses are suppressed for our mail too.

---

## 8. What to copy into LettieNotes (and what not to)

Top three lessons:
1. **Separate the classes of email before writing any code.** Transactional ("you just did this"), consented (digests, notes) and, for a safety product, **safety-critical alerts**. Our rules (quiet hours, daily caps, "send nothing on pause") are right for gentle notes and **wrong for an alert about a resident**: those must ignore quiet hours, be repeated or escalated, and not rely on email alone (add SMS or push; email is neither immediate nor guaranteed). Give alerts their own kind with their own rules and delivery confirmation.
2. **Claim, then send, then record; hash addresses; one function sends.** A unique dedupe key in the log makes every send idempotent, failures clear the key so retries work, and the log holds no content and no plaintext addresses. Recipients come from rows the server looks up, never from the request body. This pattern ports unchanged.
3. **Wire bounce and complaint handling and the suppression check on day one**, and test the unsubscribe path before the first real send. Providers watch complaint rates; the signed webhook plus a suppression table is about 100 lines.

Also copy: the pure `rules.ts` / `templates.ts` / `tokens.ts` split (no network, fully testable); stable derived link tokens (HMAC of the share id, only the hash stored) so every email carries a working one-tap link; double opt-in with hashed 48-hour single-use tokens; `EMAIL_DRY_RUN`; the separate sending subdomain; the Lovable Resend connector is fine for sending, but **it cannot receive webhooks or verify domains**, so keep bounce handling in a Supabase edge function. Do not copy: the 90/100-per-day cap (a free-plan constraint) or the Sunday digest schedule.

## 9. Unverified or open
- Not deployed, not sent, no DNS or secrets touched. The edge functions were type-checked against stand-in Deno declarations only (no Deno here); the SQL ran on local PostgreSQL 17, not on Supabase.
- Svix signature scheme is implemented from the Svix specification; Resend's page names the headers and library only. Confirm with the dashboard's test event.
- Resend's bounce payload field names (`type`, `data.to`, `data.bounce.type`) are from Resend's bounced-event page; the complaint payload page was not read (assumed to carry `data.to` the same way).
- `email_digest_inputs` and `email_week_trends` follow the written contract for `shared_week_summary`, not 0015's final code; compare when 0015 lands. They count the 7 days ending today in database (UTC) time.
- Brevo and MailerSend prices, SES webhook plumbing, and Postmark's deliverability reputation were not verified from official pages.
- Whether the project uses publishable keys (see the waitlist caveat), and whether Resend open/click tracking is off, must be checked in the dashboards.
- Pending: the app route for `/email`, the `database.types.ts` and `schema-log.md` updates, and the waiting-list form cut-over.
