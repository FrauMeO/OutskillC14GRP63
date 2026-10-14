# BYP remediation R1 — October 14, 2026

Historical control: BYP-A0-2026-10-14, commit `43c232152a7081b943b68e84dc54f3bed249959c`. A0 remains unchanged. R1 is a remediation candidate, not a completed user study or an automatically approved A1 control.

## Changes against findings

| Finding | Remediation | Verification / limits |
|---|---|---|
| F01 atomic migration | Confirmed missing in live metadata, inspected dependencies, tested locally, applied 0021 to the authorized project | Live migration `20261014204109`; functions authenticated-only, empty search path. No real health records accessed. |
| F02 stale open supporter screen | 15-second access checks clear data while revalidating; hide on background/offline; request generations, account/owner binding and cancellation prevent stale replies from restoring details; native background events connected | Hook and mounted-page regressions pass. Browser timers are best-effort; copies/screenshots cannot be recalled. Real two-device acceptance remains required before a participant control is declared. |
| F03 invitations | Saved invitation invokes transactional email, pending rows have retry, failed/unconfirmed sending provides manual handoff; provider acceptance is not called inbox delivery; dry-run never reports a real send | `send-email` was absent and is now deployed v1 with JWT verification. No emails sent by this task. Provider secrets, sender-domain readiness and inbox delivery unverified. |
| F04 mixed scopes/monthly | Each existing share can be configured independently with off/presence/summary/detail per pillar and live/last-completed-month cadence; Balance presence returns only whether mood/feelings were logged; server masks before returning data | 0022 applied as `20261014204132`. Legacy daily/goals/weekly and weekly-email paths cannot bypass mixed/monthly permissions. Local rollback tests pass. |
| F05 visit preparation | Optional concerns before report; three deterministic local questions use recognized concern topics and available entries; no model or external transmission; written concerns print only with explicit checkbox | Blank-data and concern-topic tests pass. Questions are preparation prompts, not clinical analysis. |
| F06 report failure | Disable and guard print on loading/error; catch rejected reads; clear stale data; explicit retry; print-visible error if user invokes browser Print directly | Component regressions pass. |
| F07 coverage | Both periods' counts and dates alongside comparisons; explicit missing-day caveat; remove “Clearly” confidence wording | Coverage regression passes. Existing minimum count retained, not claimed clinically validated. |
| F08 instructions | Correct current fonts/milestones/backend and document current decisions, Box location and immutable A0 | AGENTS.md updated. |

## How to use the new sharing choices

Create an invitation with the existing consent flow. For privacy while preparing mixed permissions, start with presence only. Under **People you share with**, open **Choose a different level for each pillar**. Choose each level and the report period, tick the recipient-specific agreement, and save. **Preview saved choices** renders the same server-filtered report privately for the owner. Pausing and ending sharing remain available.

A friend can receive Sleep detail and Balance presence. Another recipient can receive the last completed month only. Monthly detail contains averages and counts, never daily values or the current month. Monthly reports update in the app; automatic monthly email delivery is not implemented. Summary in this new control explicitly means counts of logged days, not AI interpretation. Existing uniform weekly-summary sharing remains available on unconverted shares.

Delegated editing/management and dementia-related restrictions remain unresolved policy features, not silently enabled. The system continues to provide read-only access and user revocation.

## Validation

- 737 tests passed across 58 files; zero failures.
- TypeScript, Vite production build and six prerendered public routes passed.
- Apple Health import/seed verification passed; deliberate corruption positive controls caught.
- Isolated Postgres 17: migrations applied to disposable local cluster with minimal Supabase auth stubs; atomic-sharing and scoped-sharing suites reached their deliberate rollback PASS exceptions. Existing care-sharing v2 suite produced expected positive/negative controls. This is not a complete Supabase deployment emulator.
- Live read-only metadata verified functions, grants, empty search paths and owner-only habit/goals policies. Migrations 0021 and 0022 then applied successfully; migration inventory verified.
- Security advisor run: new request ledger intentionally has RLS with no client policies and no client grants. Authenticated SECURITY DEFINER functions are intentional, with ownership checks and locked search paths. Existing public token/waitlist warnings were not treated as blanket permission to change their API. Leaked-password protection remains disabled in Auth settings; [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No blanket clean-security claim.

## Remaining release evidence

Frontend is not merged to production by this task. Verify the candidate preview with two synthetic browser/device sessions, keyboard/screen reader, 200% text and 320px reflow. Verify provider configuration and a deliberately authorized test invitation before claiming automated delivery. No messages were sent and no new beta participants enrolled. Native device build was not run.

Then freeze an eligible A1 control and candidate B with exact frontend, database and feature versions in the existing rubric. Do not compare A0 on an old incompatible schema or expose people to known risks. Participant scores remain unmeasured (n=0). R1 changes capabilities, so preregister which tasks are equivalent and which are exploratory.
