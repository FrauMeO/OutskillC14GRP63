# Care sharing v2: the contract (2026-10-12)

Source: docs/caregiver-feature-brief.md (Perplexity), compared with what 0010-0014 already built.
This file is the single agreed interface between the database agent (C1) and the screens agent (C2).
Do not rename anything here without telling Miah. Existing 0010-0014 behaviour stays: invites by
email, accept with confirmed email, view-only, notes/feelings/locations never shared, instant revoke,
5-share cap, 14-day invite expiry, delete account removes everything.

## Tone and privacy rules (from the brief and CLAUDE.md)
- Everything OFF by default. The owner chooses. No red, no "missed", no streak loss. A gap is a gap.
- Revoking or pausing sends no alarming message. Pausing hides data at once.
- Supporters never see notes, feelings, check-in answers, PHQ scores or locations.
- Text >= 18px in the supporter view; 44px tap targets; plain words (no "permissions", "sync").

## Database (migration 0015_care_sharing_v2.sql, additive; C1 writes it, Miah's session applies it)
Table `care_shares` gains:
- `level text not null default 'presence' check (level in ('presence','summary','detail'))`
    presence = "checked in" days only (log_date, all values null)
    summary  = weekly pillar summary in trend words, no raw numbers (see shared_week_summary)
    detail   = the per-day values for the pillars ticked (current shared_days behaviour)
- `paused_at timestamptz null`  (active share is paused when not null)
- `last_confirmed_at timestamptz not null default now()`  (owner re-confirms every 90 days)
New table `care_share_views (share_id uuid references care_shares on delete cascade, viewed_on date, views int not null default 1, primary key (share_id, viewed_on))`
  RLS: select for the OWNER of the share only; no client writes. Written only by the definer functions below.
New/changed functions (all SECURITY DEFINER, `set search_path = ''`, revoke from public/anon, grant to authenticated):
- `set_care_share_options(p_id uuid, p_level text, p_paused boolean) returns void`  owner only; validates level; sets/clears paused_at; rejects revoked shares.
- `confirm_care_share(p_id uuid) returns void`  owner only; sets last_confirmed_at = now().
- `shared_days(p_owner, p_from, p_to)`  (existing signature and columns) now: returns nothing if paused; level 'presence' returns one row per day with something shared logged but ALL value columns null; 'summary' returns the same as presence; 'detail' returns values as today. Records one view per viewer per day in care_share_views (so it becomes volatile, not stable).
- `shared_week_summary(p_owner uuid) returns table (pillar text, days_logged int, trend text)`  pillar in ('eat','sleep','move','balance') for the pillars the owner ticked; days_logged = days in the last 7 with something logged for that pillar; trend in ('about_usual','a_little_lower','a_little_higher','not_enough_days') comparing this week's mean for the pillar's main measure (eat: water_liters; sleep: sleep_hours; move: steps else exercise_minutes; balance: mood) with the owner's own previous 8 weeks, only when at least 4 logged days this week and 10 in the baseline, difference > 10% of baseline mean for lower/higher. Empty if paused, not active, or level is 'presence'. Raw numbers never returned. Records a view like shared_days.
- `followed_people()` gains columns `level text, paused boolean` (append at the end; keep existing columns).
- `shared_goals` returns nothing unless level = 'detail' and not paused.
Owner reads access history with `select * from care_share_views` (RLS) joined by share id; show it as "Anna looked on 3 days this month", never per-view timestamps beyond the date.
Test file: supabase/tests/care_sharing_v2_test_after_0015.sql (rolled-back DO block ending in RAISE EXCEPTION 'RESULT ...', with a control case for each rule).

## Front end (C2)
- Types: extend src/lib/database.types.ts (care_shares columns, care_share_views, the new RPCs, followed_people columns).
- Invite/edit form (src/components/SharingSettings.tsx): ALL four pillar boxes start UNticked; a "How much do they see?" choice with three plain-language radio options (presence: "Just that I logged today"; summary: "A weekly summary in words, no numbers"; detail: "Day-by-day detail for the pillars I tick"); a "Preview what {email} will see" panel computed locally from the owner's own last 28 days using the same rules, labelled as a preview; Pause / Resume and End buttons; a 90-day "Are you still happy sharing with {name}?" Yes / Change / Stop banner when last_confirmed_at is older than 90 days; an access summary from care_share_views.
- Dashboard (src/pages/Dashboard.tsx): an always-visible line "Shared with: Anna (Sleep, Move), paused: Ben" with a link to Settings, only when the owner has open shares; fail closed (hide on error).
- Supporter pages (src/pages/Following.tsx, FollowingPerson.tsx): render per level: presence = a calm "Logged on N of the last 7 days" (never a list of missed days); summary = shared_week_summary rows in words ("Sleep: about the usual for them"); detail = current view. Paused = "{name} has paused sharing for now." (neutral). Same 4-of-7 weekly rhythm wording.
- Pure logic in src/lib/careShares.ts (or a new file) with vitest tests incl. control cases that must fail.
