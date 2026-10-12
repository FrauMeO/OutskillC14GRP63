# Consent and rights UX: engineering spec (12 October 2026)

For the code agent that implements this next. Standard: `docs/privacy-standard.md` (Washington MHMDA for everyone; stricter GDPR, PIPEDA or DPDP rule wins). Public wording lives in `src/pages/HealthDataPrivacy.tsx`; the dialogs below must say the same thing. **Not legal advice. Every LEGAL REVIEW tag needs a lawyer before launch.** Nothing here has been built or applied. No migration file exists yet; section 3 is a sketch only.

Rules for the implementer: follow `CLAUDE.md` (principles, schema policy, tests with positive controls). Text at 18px for public pages; in-app dialogs at least `text-lg`. 44px tap targets. `role="alert"` for errors, `role="status"` for confirmations. No `window.confirm`. Reduced motion respected. Copy below is written at about a 6th to 8th grade reading level; keep it that way when edited.

---

## 1. What exists today (so you know what to change)

| Thing | Where | Problem |
|---|---|---|
| Sign-up checkbox "I agree ... store and use the health information" | `src/pages/AuthPage.tsx:210-226`; sent as metadata `health_consent` (`:75`); trigger sets `profiles.health_consent_at` (`0013_email_consent.sql:30-50`, `0016:25,55`) | Client-asserted, editable by the user (`docs/security-review-2026-10-12.md` L3), no version, no text, no withdrawal. `AuthPage.tsx` is a founders' file; the change below needs their approval. |
| Marketing checkbox | `AuthPage.tsx:227-235`, `src/components/EmailPreferences.tsx:28-40` | Only a boolean and a timestamp. |
| AI consent | `src/lib/aiConsent.ts` (localStorage `byp.aiConsent.<userId>`, `CONSENT_VERSION = 1`), `src/features/aiReflection/AiConsentDialog.tsx`, `src/components/AiConsentSetting.tsx` | Browser only. Not on the server. The edge function (`supabase/functions/daily-reflection/index.ts:45-89`) does not check it. |
| Caregiver invite | `src/components/SharingSettings.tsx:237-276,378-400` | No consent step, no record. |
| Withdraw | AI switch, gentle check-ins switch (`Settings.tsx:50-62`), marketing tick, end/pause share | No way to withdraw "keep my data" except deleting the account. |
| Download | `Settings.tsx:62-99` | Fine. Add the new tables. |
| Delete | `src/components/DeleteAccount.tsx`, `supabase/migrations/0012_delete_my_account.sql` | Does not say what remains. No re-sign-in (security review L4). |

---

## 2. Consent catalogue

Four purposes. Each has its own text, its own version, its own record. Withdrawing one never affects another, except that withdrawing `collect_use` ends saving new entries (section 6).

| Purpose key | Asked when | Required for | Default |
|---|---|---|---|
| `collect_use` | Sign-up (also re-asked on any version bump) | Having an account; saving any entry | Unticked |
| `share_caregiver` | Each time the owner presses "Send invitation" (one per share) | That one invitation | Unticked / dialog not confirmed |
| `ai_processing` | First time AI help would be used, or when switched on in Settings | Any call to Claude | Off |
| `email_marketing` | Sign-up (optional box), or Settings | News emails | Unticked |

Consent text is stored by version. A change of wording or of the categories, purposes or recipients **must** bump that purpose's version, and everyone is asked again before the new use starts (RCW 19.373.020(2)). Never pre-tick, never bundle, never hide behind "I agree to the Terms".

### Consent texts (exact copy)

Use these strings exactly; they are what gets hashed. Keep them in one file, `src/lib/consentTexts.ts`, as `{ purpose, version, text }`, and mirror them in the database table `consent_texts` (section 3) by a migration, so the hash can be checked on the server.

**`collect_use` v1. Sign-up checkbox label (one sentence) plus the text shown above it:**

Heading: **Keeping what you enter**

Body (shown, not hidden): "To work, this app has to keep the health information you choose to enter. That means things like sleep, water, steps, mood, feelings, and notes. We use it to show you your own days, goals, and trends. We do not sell it. We do not use it for ads. You can see it, download it, or delete it any time in Settings. Read the Consumer Health Data Privacy Policy."

Checkbox: "I agree that Build Your Pillars may keep and use the health information I enter, to run the app for me."

Link: "Consumer Health Data Privacy Policy" goes to `/health-data-privacy` (opens in a new tab, `rel="noopener noreferrer"`).

**`share_caregiver` v1. Dialog; see section 4.2.**

**`ai_processing` v1. Dialog; see section 4.3.**

**`email_marketing` v1.** Checkbox: "Email me occasional news about Build Your Pillars. I can turn this off any time in Settings, or with the link in each email." Note: never combined with health data, never sent to anyone else. (LEGAL REVIEW: CASL and CAN-SPAM wording.)

---

## 3. Consent ledger: table design (sketch only, do not write the migration file here)

Next free migration number is 0017 (confirm against `supabase/migrations/` and the live list before writing; schema policy rule 2). Additive only. Policy rule 7: RLS in the same migration.

```sql
-- SKETCH ONLY. Not applied. Finalise in a new numbered migration.

-- The exact words of each version, readable by everyone (they are public anyway).
create table public.consent_texts (
  purpose     text not null check (purpose in ('collect_use','share_caregiver','ai_processing','email_marketing')),
  version     int  not null check (version >= 1),
  text        text not null,                 -- the full text shown (all fields concatenated, normalised)
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz not null default now(),
  primary key (purpose, version)
);
alter table public.consent_texts enable row level security;
create policy consent_texts_read on public.consent_texts for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.consent_texts from anon, authenticated;

-- Append-only ledger: one row per grant or withdrawal.
create table public.consent_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  purpose     text not null,
  action      text not null check (action in ('granted','withdrawn')),
  version     int  not null,
  text_sha256 text not null,                 -- must equal consent_texts.text_sha256 for (purpose, version)
  subject_id  uuid,                          -- for share_caregiver: the care_shares.id; otherwise null
  details     jsonb not null default '{}',   -- e.g. {"categories":["eat","sleep"],"level":"summary","recipient_email":"..."}
  surface     text not null check (surface in ('signup','settings','invite_dialog','ai_dialog','email_request','system')),
  created_at  timestamptz not null default now(),
  foreign key (purpose, version) references public.consent_texts (purpose, version)
);
create index consent_events_user_idx on public.consent_events (user_id, purpose, created_at desc);
alter table public.consent_events enable row level security;
create policy consent_events_select_own on public.consent_events for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.consent_events from anon;
revoke insert, update, delete, truncate, references, trigger on public.consent_events from authenticated;
grant select on public.consent_events to authenticated;

-- The only way to write: checks the hash against the stored text for that version, stamps now().
create or replace function public.record_consent(
  p_purpose text, p_action text, p_version int, p_text_sha256 text,
  p_subject uuid default null, p_details jsonb default '{}', p_surface text default 'settings')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if not exists (select 1 from public.consent_texts t
                  where t.purpose = p_purpose and t.version = p_version and t.text_sha256 = p_text_sha256) then
    raise exception 'That consent wording is not current.' using errcode = '22023';
  end if;
  insert into public.consent_events (user_id, purpose, action, version, text_sha256, subject_id, details, surface)
  values (auth.uid(), p_purpose, p_action, p_version, p_text_sha256, p_subject, coalesce(p_details,'{}'), p_surface);
end $$;
revoke all on function public.record_consent(text,text,int,text,uuid,jsonb,text) from public, anon;
grant execute on function public.record_consent(text,text,int,text,uuid,jsonb,text) to authenticated;

-- Current state = the latest event for (user, purpose, subject) is 'granted' at the CURRENT version.
create or replace function public.has_consent(p_purpose text, p_subject uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.action = 'granted'
       and e.version = (select max(version) from public.consent_texts t where t.purpose = p_purpose)
      from public.consent_events e
     where e.user_id = auth.uid() and e.purpose = p_purpose and e.subject_id is not distinct from p_subject
     order by e.created_at desc, e.id desc limit 1), false);
$$;
revoke all on function public.has_consent(text,uuid) from public, anon;
grant execute on function public.has_consent(text,uuid) to authenticated;
```

Notes and decisions for the implementer:

1. **Hash.** SHA-256 of the UTF-8 text exactly as stored in `consent_texts.text` (concatenate heading, body, checkbox label with `\n` between; no HTML). Compute in the browser with `crypto.subtle.digest` and again in the migration test. A mismatch is a hard error, never silently ignored.
2. **Sign-up.** `signUp()` has no session when email confirmation is on (`AuthPage.tsx:90-94`), so the ledger row cannot be written from the browser at that moment. Keep passing `health_consent` metadata, but also pass `consent_version` and `consent_text_sha256`; make `handle_new_user` insert the `consent_events` row itself (surface `signup`) after checking the hash against `consent_texts`. Stop trusting `profiles.health_consent_at` as the source of truth. Keep the column for now, make it derived, and revoke client UPDATE on it (security review L3).
3. **Enforcement.** Add to `habit_logs`, `goals` and `reflections` insert policies: `with check (public.has_consent('collect_use'))`. Reads and deletes stay allowed so a person who withdrew can still see, download and delete. Positive control in the test: insert fails after a withdrawal, succeeds after a re-grant.
4. **AI.** The edge function calls `has_consent('ai_processing')` with the caller's JWT before reading any row; if false, return 403 `{error:'ai_consent_required'}`. `src/lib/aiConsent.ts` becomes a cache of the server answer; the server is the truth. Remove the reliance on `localStorage` as the gate.
5. **Caregiver.** `create_care_share(...)` gets an optional `p_consent_sha256`/`p_consent_version`, or the client calls `record_consent` right after, with `subject_id = care_shares.id` and `details` holding the recipient's email, pillars and level at that moment. If it fails, call `end_care_share` so no share exists without a record. Ending a share writes a `withdrawn` event for the same subject. Each change to pillars or level that adds data writes a new `granted` event (new categories need new consent).
6. **Retention of the ledger.** Rows cascade with the account (strictest). LEGAL REVIEW: whether to keep an anonymised count only. No row survives deletion.
7. **Export.** Add `consent_events` (and `privacy_requests` rows for the signed-in email) to `src/lib/export.ts` `ExportData` and `Settings.tsx` download, with an `about` line: "Your consent choices: what you agreed to or took back, and when."
8. **Types and docs.** Update `src/lib/database.types.ts` and `docs/schema-log.md` in the same change. Add `supabase/tests/consent_ledger_test_after_0017.sql` (rolled-back DO block ending in `RAISE EXCEPTION 'RESULT ...'`) with a control for every rule: wrong hash rejected; non-current version gives `has_consent` false; withdraw then insert into `habit_logs` rejected; another user cannot read my events; client cannot insert directly; deleting the user removes events.

### Request tracker (for the 30-day clock, section 8)

```sql
-- SKETCH ONLY. Founder-only: no client grants at all. Read and written in the Supabase dashboard or SQL editor.
create table public.privacy_requests (
  id            uuid primary key default gen_random_uuid(),
  received_at   timestamptz not null default now(),
  due_at        timestamptz generated always as (received_at + interval '30 days') stored,
  channel       text not null default 'email',
  requester_email text not null,
  user_id       uuid references auth.users (id) on delete set null,
  kind          text not null check (kind in ('access','third_party_list','correct','delete','withdraw','appeal','other')),
  appeal_of     uuid references public.privacy_requests (id),
  identity_checked_at timestamptz,
  extended_at   timestamptz,                 -- set once; notice must go out before due_at
  extended_due_at timestamptz,               -- at most received_at + 60 days
  answered_at   timestamptz,
  outcome       text check (outcome in ('done','partly','declined','withdrawn_by_requester')),
  notes         text
);
alter table public.privacy_requests enable row level security;   -- no policies = no client access
revoke all on public.privacy_requests from anon, authenticated;
```

Delete the requester's email from closed rows after 24 months (founders to confirm; LEGAL REVIEW).

---

## 4. Screens and exact copy

General: every consent screen has a link to the Consumer Health Data Privacy Policy, shows what, why, who, and how to stop. The safe button is first in the tab order and has focus when a dialog opens (copy the pattern in `AiConsentDialog.tsx:16-23`). Escape means "No / Not now". Nothing happens on a dismiss.

### 4.1 Sign-up (replaces `AuthPage.tsx:207-237`; founders' file, ask Miah)

Place the `collect_use` text in section 2 above the checkbox, in a bordered block. Checkbox is `required`, unticked. Marketing checkbox stays below it, optional, with its own text. Also add under the birth-year select: "You must be 18 or older." (age rule 18, see standard gap 6) and change `MIN_AGE` (`src/lib/signup.ts:6`) plus a new migration for the trigger check (`0016:40`). Error if the box is not ticked: "Please tick the box to let us keep what you enter. Without it, we cannot make an account."

### 4.2 Caregiver share dialog (shown when the owner presses "Send invitation")

Opens after the form validates (`SharingSettings.tsx:240`), before `create_care_share`.

- **Title:** "Share with {email}?"
- **Body:**
  "If you say yes, {email} will be able to look at some of your health information.
  **What they will see:** {list of the pillars ticked, e.g. 'Sleep and Move'}. {level sentence}.
  **What they will never see:** your notes, your feelings list, your places, or your check-in answers.
  **Why:** so someone you trust can follow along. That is the only reason.
  **They can only look.** They cannot change anything. They will see your first name.
  **You are in charge.** You can pause or stop sharing any time in Settings. It stops at once. You can also see on which days they looked.
  The invitation ends by itself after 14 days if they do not accept. We do not send them an email, so please tell them yourself."
- Level sentences (use the same words as the level radio buttons): presence: "They will only see which days you logged." summary: "They will see a weekly summary in words, with no numbers." detail: "They will see your day-by-day numbers for those pillars."
- If Balance is ticked, add: "Balance means your mood, energy, and stress scores."
- **Checkbox inside the dialog (unticked):** "I agree to share this with {email}."
- **Buttons:** "Not now" (outline, default focus) and "Send invitation" (disabled until the box is ticked).
- On Yes: `create_care_share` -> `set_care_share_options` -> `record_consent('share_caregiver','granted', ..., subject = new share id, details)`. If any step fails: `role="alert"` "We could not save your invitation, so nothing was shared. Please try again." and call `end_care_share` for any half-made share.
- Editing a share to add a pillar or raise the level reopens the same dialog with "You are changing what {email} can see." and a fresh checkbox. Lowering or pausing never asks.
- On Stop/End: no dialog beyond the existing inline confirm; write a `withdrawn` event. Message: "Sharing with {email} has ended. They cannot see anything now."

### 4.3 AI help dialog (replaces the text in `AiConsentDialog.tsx`; bump `ai_processing` to v2)

Keep the structure and the existing facts; add the four things that are missing: that it is a separate choice, the model company named as a company that receives your information, the retention honesty, and how to stop. Do not state Anthropic's retention as a fact until the founders confirm Anthropic's terms (`docs/gdpr-compliance.md` 1.3). Until then use the second wording.

- **Title:** "Would you like AI help with your reflections?"
- **Body:** "This is a separate choice. It is not part of making your account.
  If you say yes, an AI called Claude writes a few gentle sentences about your day or your week. Claude is made by a company called Anthropic, in the United States.
  **What we send:** the date; what you logged, in words (sleep, water, food calories, exercise, steps, standing hours, active calories, time in bed); your mood, energy, and stress as words; the feelings you picked. For the week note, the same for seven days, plus your goals.
  **What we never send:** your name, your email, where you are, your notes, or your check-in answers. On a hard day we send nothing. You get a fixed, kind message.
  **What we keep:** nothing. We do not save the reflection or what we sent. {Anthropic handles the request under its own rules.}
  **You can stop any time** in Settings. It stops at once."
- **Buttons:** "Not now" (default focus) and "Yes, use AI help". `Not now` records nothing (current behaviour: `useAiConsent.ts:38-43`), so we never nag within a session and never store a refusal.
- On Yes: `record_consent('ai_processing','granted', v2, hash, surface 'ai_dialog')`, then update the cache. If the record call fails: "We could not save your choice, so AI help is still off. Please try again." and stay off.
- Settings row (`AiConsentSetting.tsx`) keeps the switch. Switching off calls `record_consent(..., 'withdrawn')` first, then turns the cache off. Hint text when on: "On. The words and numbers listed here go to Claude (Anthropic, United States) when you ask for a reflection. We save nothing." (Edit the current hint at `AiConsentSetting.tsx:30` only to match.)

### 4.4 Email news

Checkbox label per section 2. Settings (`EmailPreferences.tsx`) changes also write a ledger event. Success texts stay as they are. Every email must have a one-click unsubscribe link that works without logging in (a signed token page; LEGAL REVIEW).

### 4.5 Device location

Before the browser's own location prompt (first time only, in the log form), show one line (inline, not a dialog): "To show the weather where you are, your device may ask for your location. We round it to about 11 kilometres, we never keep your exact spot, and you can say no. Then we use your home city." This is notice, not a consent ledger event (the browser permission is the consent). LEGAL REVIEW.

---

## 5. Data-access UX

### 5.1 "Download my data" (exists)

Keep `Settings.tsx:62-99`. Add `consent_events` to the file. Change the blurb (`Settings.tsx:296-300`) only to add: "your consent choices".

### 5.2 New: "Who has my data" (Settings, new section under the download block)

A calm card, `aria-labelledby`, no jargon.

- **Heading:** "Who has my data"
- **Intro:** "This is everyone who can receive your health information, and what they get. It matches our Consumer Health Data Privacy Policy."
- **Rows** (static list generated from one constant `src/lib/dataRecipients.ts`, which is the only place recipients are defined, and which the HealthDataPrivacy page should import in a later cleanup so the two never differ):

| Who | What they get | Why | Your choice |
|---|---|---|---|
| Supabase (United States) | Everything you enter | To store it for you | Delete your account |
| Vercel (United States) | Your internet address when you open a page; no entries | To host the website | None; it is the website |
| Anthropic (United States) | Words and numbers for one day or week, goals | AI help | Switch off in Settings |
| Open-Meteo | Rounded map position, dates, city text you type, internet address | Weather | Skip location; no weather lookup |
| BigDataCloud | Rounded map position, internet address | City name from your location | Say no to location |
| People you invited | The pillars you ticked, at the level you chose | Following along | End or pause sharing |

- Then a live list from `care_shares` (own, active/pending/paused/ended) and `care_share_views`: "Anna can see Sleep and Move (weekly summary). Looked on 3 days this month." with a "Stop sharing" button.
- Footer: "Want this in an email? Write to hello@buildyourpillars.com."

### 5.3 Consent history

A collapsed "My choices over time" list under it, from `consent_events`: "12 Oct 2026: You agreed to let us keep what you enter." etc. Dates only in the person's locale, no hashes shown.

### 5.4 Email requests (rights not in the app)

Rights that stay email-only: third-party list copy, restriction, objection, waitlist removal. Founders' procedure: section 8.

---

## 6. Withdrawal UX in Settings (as easy as giving)

New card "Your choices" at the top of Settings (it moves the switches together; do not remove the existing ones until this works). One row per purpose; same control, same size, same place; no extra confirm for AI, news, or sharing (one tap, then a status line).

| Row | Control | Label | Effect | Status message (`role="status"`) |
|---|---|---|---|---|
| Keep and use my data | Switch (on/off) | "Keep what I enter" | Off opens the dialog below | see below |
| AI help | Switch | "Use AI help for reflections" | Immediate; ledger `withdrawn`; clears any reflection on screen | "AI help is off. Nothing will be sent." |
| News emails | Switch | "Email me news" | Immediate; ledger | "You will not get news by email." |
| Sharing | Per person: "Pause", "Stop" | | Immediate | "Sharing with {email} has ended. They cannot see anything now." |

**Withdrawing `collect_use`: dialog.**

- **Title:** "Stop keeping what you enter?"
- **Body:** "If you turn this off, we stop saving new entries. Nothing is lost yet. What you already saved stays here, and you can still look at it, download it, or delete it. You can turn this back on any time."
- **Three buttons:** "Keep as it is" (default focus, outline), "Stop saving, keep my past entries" (ledger `withdrawn`; the insert policy blocks new rows; the log page shows: "Saving is paused. Turn it on in Settings when you want to log again."), "Delete my account instead" (opens the delete flow).
- It also ends no caregiver shares by itself, but shows: "People you share with will still see what you already logged. To stop that, pause or stop sharing first." Better: ask in the same dialog with a checkbox "Also pause all sharing", ticked by default. LEGAL REVIEW: whether withdrawal must auto-pause shares; the safe choice is to pause.

Cached AI result, `lastAuto`, and any in-memory data are cleared on withdrawal (existing behaviour at `AiReflectionCard.tsx` on `!allowed`).

---

## 7. Deletion semantics

### What "Delete my account" removes now

`delete_my_account()` (`0012_delete_my_account.sql:7-16`) deletes the caller from `auth.users`. By cascade (verified in `docs/security-review-2026-10-12.md`, "Cascades"): `profiles`, `goals`, `habit_logs`, `daily_conditions`, `reflections`, `care_shares` (as owner and as viewer), and, once built, `consent_events`. `care_share_views` goes with its share. Storage has no objects. The edge function stores nothing.

Note the viewer side: if a person who was *invited* deletes their account, the owner's `care_shares` row for them is deleted too (cascade on `viewer_id`), so the owner loses that history. Acceptable; say it in the owner-facing text if it comes up.

### What remains, and for how long

| Item | Stays? | For how long | Who controls it |
|---|---|---|---|
| Live database rows | No | Gone at once | Us |
| Supabase backups | Yes, until they expire | Pro: 7 days of daily backups; Team 14; Enterprise up to 30. PITR (an add-on): 7, 14 or 28 days. The free plan states no period. Source: https://supabase.com/docs/guides/platform/backups. **Our plan is unverified.** Supabase documents no way to purge one person from a backup. Deleting the whole project removes its backups. | Supabase |
| Our promise | | **No more than 30 days, and we never restore a deleted account.** MHMDA allows six months. | Founders |
| Supabase auth and function logs, Vercel logs | Possibly | Unverified | Providers |
| Anthropic request records | Unverified | Depends on Anthropic's terms for our account | Anthropic |
| Waitlist row | Yes, it has no user link | Until launch plus 30 days, or removed on email request | Us |
| Emails already sent | Yes | Ours to ignore; theirs to keep | Recipients |
| Data a caregiver already saw | Cannot be recalled | | |
| Request log (`privacy_requests`) | Yes | 24 months (founders and LEGAL REVIEW) | Us |

**Processor notice (MHMDA .040(1)(c)).** Supabase deletes at our instruction; Anthropic holds nothing we can delete (we store no request ID; confirm its retention). Record this in the DPA checklist; no code is needed unless Anthropic retention proves non-zero, in which case ask Anthropic to delete on request, by email, and write it into the founders' procedure.

### What to tell the user (copy for `DeleteAccount.tsx`, replacing the blurb at line 32-35)

"This permanently deletes your sign-in and everything saved: your logs, goals, check-ins, weather records, and sharing. It cannot be undone. People you shared with lose access at once.
Our database provider keeps short-lived backup copies. They are erased automatically, within 30 days. We never put a deleted account back.
Download your data first if you want a copy."

Add (security review L4): ask for the password again before the final button ("For safety, type your password"), or check recent sign-in inside the RPC. Add to the confirmation screen after sign-out: "Your account is deleted. Backup copies will be gone within 30 days."

Also change the owner-side wording on the waitlist: "To be removed, email hello@buildyourpillars.com" stays; log it as a `privacy_requests` row of kind `delete`.

---

## 8. 45-day (our 30-day) SLA for email requests

Statute: respond within 45 days of receipt, extend once by 45 days if told within the first 45 (RCW 19.373.040(1)(g)); appeals answered in writing within 45 days (.040(1)(h)). GDPR one month; PIPEDA 30 days. **Our clock: 30 days, one extension of up to 30 days with notice inside the first 30; appeals 30 days.**

Procedure (founders; Miah or Robert on Mondays):

1. Day 0: any email to hello@buildyourpillars.com that asks for access, a list, correction, deletion, withdrawal, restriction, objection, or an appeal gets a row in `privacy_requests` (section 3), with `requester_email`. Reply within 2 working days: "Thank you. We got your request on {date}. We will answer by {date + 30 days}. To make sure it is you, please reply from the email address on your account."
2. Check identity: the reply must come from the account email. If there is no account (waitlist), match the waitlist address. Ask for nothing more than needed. Never ask for ID documents.
3. Do it, using the app's own tools where possible. Record `answered_at` and `outcome`.
4. If more time is needed, before day 30: send "We need up to 30 more days because {reason}. We will answer by {date}." and set `extended_at`/`extended_due_at` (never later than day 60).
5. If declined, say why and explain the appeal: "You can appeal by replying with the word Appeal. We will answer within 30 days. If you are still not happy, you can complain to the Washington State Attorney General at atg.wa.gov/file-complaint, or to your local privacy authority."
6. A weekly query (one SQL snippet kept in `docs/`) lists rows where `answered_at is null and due_at < now() + interval '7 days'`. LEGAL REVIEW: the extension wording and whether free requests are limited to two a year (the statute allows charging after two).

Optional later: a scheduled function that emails the founders when a request is within 5 days of its due date.

---

## 9. Test plan

Follow `CLAUDE.md`: every check has a positive control that fails on a known-bad case first.

**SQL (rolled-back DO block, `supabase/tests/consent_ledger_test_after_0017.sql`)**
1. `record_consent` with the right hash writes a row; with a wrong hash raises (control).
2. `has_consent` is false with no row; true after grant; false after withdraw; false after a version bump until re-granted.
3. After a `collect_use` withdrawal, inserting into `habit_logs`, `goals`, `reflections` fails; selecting and deleting still work (control: the same insert succeeds after re-grant).
4. User B cannot select user A's `consent_events`; the client cannot insert/update/delete directly.
5. Sign-up trigger writes a `signup` event only when metadata hash matches; a forged `health_consent=true` with a wrong hash writes none and makes the account unable to log (control).
6. `delete_my_account()` removes the user's `consent_events`, `care_shares`, `care_share_views`, `habit_logs`, `reflections`, `goals`, `daily_conditions`, `profiles` (count each before and after).
7. A share without a `share_caregiver` event cannot become active (if you enforce it in `accept_care_share`).

**Edge function**
8. Call `daily-reflection` with a valid JWT and no AI consent: 403 and no row read (check the function does not query). With consent: 200. Withdraw: 403 again.
9. Hard day returns the fixed message and sends nothing (existing test in `supabase/functions/daily-reflection/logic.test.ts`; keep).

**Unit tests (vitest, `src/lib/consentTexts.test.ts`, `src/lib/consent.test.ts`)**
10. Hash of each text equals the stored constant; changing one character changes the hash (control).
11. Consent state machine: grant, withdraw, version bump, offline failure leaves the setting OFF.
12. `dataRecipients` list equals the recipients named in `HealthDataPrivacy.tsx` (a test that reads both; control: remove one and it fails).

**UI (component tests or Playwright)**
13. Sign-up: submit disabled or blocked with the box unticked; error text matches; ticked sends hash metadata.
14. Caregiver dialog: "Send invitation" disabled until ticked; "Not now" creates nothing; Escape cancels; a failed ledger write ends the share and shows the alert.
15. AI dialog: focus starts on "Not now"; Yes records; failure keeps AI off; Settings switch off records a withdrawal and clears the reflection on screen.
16. Withdraw `collect_use`: three-button dialog; "Stop saving, keep past entries" blocks a new log with the message in section 6, allows download and delete.
17. "Who has my data": lists all six recipients; shows owner's active shares and "looked on N days".
18. Delete: password re-entry required; blurb matches section 7; after deletion the user is signed out.
19. Accessibility: keyboard order, focus trap, `role="dialog"`, `aria-modal`, labels, 44px targets, 200% zoom, reduced motion. Reading level of every string in this spec (target grade 6 to 8) checked with a readability tool.

**Manual before launch**
20. Dev tools: confirm what the browser stores (sign-in session; the AI answer cache) and that no third-party request carries a user id or entry.
21. Read the live Supabase plan and backup window; update section 7 and the policy.
22. Lawyer reads `HealthDataPrivacy.tsx`, `Privacy.tsx`, this spec and `docs/privacy-standard.md`.

---

## 10. Order of work for the code agent

1. Migration 0017 (ledger, texts, functions, policies, trigger change) and its SQL test. Apply only with Miah's go-ahead.
2. `consentTexts.ts`, hash helper, `useConsent` hook; AI gate on the server; edge function check.
3. Settings "Your choices" card and the `collect_use` withdrawal dialog.
4. Caregiver dialog (`SharingSettings.tsx`) and the ledger write.
5. Sign-up changes (founders' file; ask first) and age 18.
6. "Who has my data", consent history, export additions, delete-dialog wording and re-sign-in.
7. Retention jobs (ended shares, waitlist), `privacy_requests` table and the weekly query.
8. Route `/health-data-privacy` in `src/App.tsx` (one line; see the report).
