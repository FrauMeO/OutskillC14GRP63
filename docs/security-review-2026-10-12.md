# Security review, 2026-10-12 (read-only; PersonalHealthManager gzsawayrorlcjmpssalc)

Method: read migrations 0010-0013 and the listed frontend files; ran SELECT-only queries on pg_proc (proacl, proconfig), pg_policies, pg_constraint, role_table_grants, storage; ran Supabase security advisors. No data or schema changed.

## Verified clean
- All 7 care-share RPCs + delete_my_account + handle_new_user: SECURITY DEFINER with search_path="" and fully qualified names (pg_proc.proconfig). EXECUTE: care RPCs and delete_my_account only postgres/authenticated/service_role (no anon, no PUBLIC); care_pillar_goal_types not granted to authenticated; handle_new_user not callable by clients; join_waitlist is the only anon-callable one (intended).
- care_shares: RLS on, only a SELECT policy, no INSERT/UPDATE/DELETE grant for anon/authenticated (role_table_grants shows authenticated has only SELECT plus TRUNCATE/REFERENCES/TRIGGER, see I1). A viewer cannot widen access: update_care_share filters owner_id = auth.uid().
- shared_days/shared_goals return nothing unless an ACTIVE row matches (owner, auth.uid()); notes, feelings, location, lat/long, source are never selected. Revoked => immediately no data (checked on every call). Range capped at 93 days. Random owner ids return empty set: no owner enumeration.
- Email case/whitespace: create lowercases+btrims, accept compares to lower(jwt email), CHECK enforces lowercase. Plus-addresses are treated as distinct addresses (invite must match exactly; no spoof, just usability).
- Cascades: every FK to auth.users that holds user data is ON DELETE CASCADE (profiles, goals, habit_logs, daily_conditions, reflections, care_shares owner and viewer). Only auth.scim_users is SET NULL (unused). storage has 0 buckets / 0 objects. daily-reflection edge function only reads habit_logs/goals with the caller's JWT and writes nothing of its own. delete_my_account has no id argument: deletes only auth.uid().
- Frontend: no dangerouslySetInnerHTML anywhere; owner_name is rendered as React text (escaped); ownerId route param is only used to find a row in followed_people() (active only) before any RPC, and the DB re-checks; `from` redirect is router state (internal), no open redirect; no localStorage/console logging of shared data; sw.js has no fetch handler (never intercepts authenticated requests); join_waitlist returns void and the UI shows the same message for new/existing address.
- Advisors: rls_enabled_no_policy on waitlist (INFO, intended); anon_security_definer_function_executable join_waitlist (WARN, intended); authenticated_security_definer_function_executable x9 (WARN, all intended, each checks auth.uid()); auth_leaked_password_protection disabled (WARN, see M3).

## Findings

### M1 (medium, verified by code) Waitlist signup has no proof of address ownership
0013_email_consent.sql join_waitlist: anyone can enter a third party's email with p_consent=true; the row records consent_at=now() for a person who never consented, and a repeat call overwrites consent_at. No rate limit or CAPTCHA, so also unbounded row growth/spam from anon. Fix: double opt-in (store pending, email a token, only then set consent_at); add rate limiting (edge function with Turnstile, or Supabase auth-style limits) and do not overwrite consent_at on conflict.

### M2 (medium, verified by code) Pending invitations never expire and are claimed by whoever controls the address
0010 create_care_share/accept_care_share: a typo'd or dormant address (e.g. old work email re-issued) lets whoever later signs up and confirms that email accept and see the owner's shared pillars. accept checks auth.users.email_confirmed_at but matches against the JWT email claim, not auth.users.email. Fix: add expires_at (e.g. 14 days) and reject in accept/followed_people; in accept_care_share compare against (select email from auth.users where id = me) instead of the JWT claim (stale tokens after an email change); show the owner a clear "waiting for <email>" so typos are noticed (UI already does).

### L1 (low, verified by code) 5-share limit is racy
create_care_share counts then inserts with no lock; parallel calls can exceed 5. Fix: pg_advisory_xact_lock(hashtext(me::text)) before the count, or a trigger.

### L2 (low, verified) Invitee sees an owner-chosen display name
followed_people returns profiles.full_name, which sign-up metadata sets with no length cap (profiles has no CHECK on full_name/home_city; handle_new_user does not trim length). A stranger can invite any email and show text of their choosing (harassment/phishing wording, very long strings). React escapes it, so not XSS. Fix: CHECK (length(full_name) <= 80) on profiles, truncate in handle_new_user (left(...,80)); consider showing the owner's email alongside the name.

### L3 (low, verified) Consent record is client-asserted and editable
handle_new_user trusts metadata 'health_consent'/'marketing_opt_in' (only the string 'true' counts; nothing else is injectable: id is new.id, lat/long/country validated). profiles_update_own also lets users rewrite marketing_opt_in(_at) and health_consent_at (even backdate or null them). Design verdict: acceptable for marketing opt-in (it is the person's own choice, and withdrawal must be self-service). For health consent (GDPR Art. 9) it is weak evidence: a direct API call can sign up with true without seeing the box, and nothing server-side requires health_consent_at before logging. Fix: column-level revoke update on health_consent_at (set only via an RPC that stamps now() and a policy version), store consent text version, and gate habit_logs inserts on it if you want enforcement.

### L4 (low) delete_my_account has no re-authentication
DeleteAccount.tsx only requires typing a word; a stolen/unlocked session can irreversibly delete all data. The old access token also stays valid until expiry. Fix: require recent sign-in (reauthenticate with password or a fresh-session check inside the RPC via auth.jwt() ->> 'iat').

### L5 (low) Account enumeration via error text
src/lib/authErrors.ts shows "There is already an account for this email" (user_already_exists). Supabase only returns this when email confirmation is off/autoconfirm; with confirmation on it is obfuscated. Confirm project setting "Confirm email" is ON, otherwise this leaks. Not verified against the dashboard setting (not readable via SQL).

### M3 (medium for health data, verified by advisor) Leaked-password protection off; min length 6
Advisor auth_leaked_password_protection; authErrors.ts tells users 6 characters. Fix: enable HIBP check, set minimum length to 10+ in Auth settings.

### I1 (info, verified) Over-broad default table grants
anon and authenticated hold ALL privileges (including TRUNCATE, which bypasses RLS) on habit_logs, profiles, goals, reflections, daily_conditions; authenticated also has TRUNCATE on care_shares. PostgREST does not expose TRUNCATE, so not exploitable through the API, and RLS policies are all `to authenticated` (anon sees nothing). Fix for defense in depth: revoke truncate, references, trigger from anon/authenticated everywhere, and revoke all from anon on the health tables.

### I2 (info) Pillar balance is opt-in; mood/energy/stress sent only when share_balance true (default false). Day presence still reveals logging cadence for shared pillars, by design.

## Not checked
Dashboard-only settings (email confirmation, secure email change, rate limits, JWT expiry); Edge function deployed code vs repo; no live attack run with real second accounts (would require writes).
