# Build Your Pillars: progress brief for review (12 October 2026, evening)

For: Perplexity (review and feedback). Prepared by: Claude (Claude Code session) with Miah Shull Olmsted.
Purpose: Miah is applying tonight (deadline 11:59 pm) to AARP's AgeTech Collaborative "AgeTech After Dark" pitch competition (prompt: "How does your tech solution help make aging easier?"). Please review where the product stands, test it against what AARP/AgeTech judges and older adults care about, and tell us what is weak, risky or missing. This brief is self-contained: you cannot open our files, so the essentials are below.

## 1. What the product is
Build Your Pillars (buildyourpillars.com): a gentle, private health tracker across four pillars: Eat, Sleep, Move and Balance (mental health as an equal pillar). It never shames: no streaks, a missed day is a gap (never a zero or a red mark), insights say "what tends to go together", never "causes". Founders: Miah Shull Olmsted (60) and Robert Olmsted (72), a husband and wife who wanted a simple, pressure-free way to share their health journey. It began as a hackathon entry; the other hackathon team members contributed little and left.
Stack: React/TypeScript web app, Supabase (database/sign-in), Vercel (hosting), Open-Meteo (weather), Claude (optional AI reflection). Not HIPAA-covered (consumer app, no provider/insurer contracts; we do not claim HIPAA compliance).

## 2. Business rules (decided today)
- Free for anyone 60 or over (self-declared month and year of birth; never the day).
- $2.99 a month for everyone under 60.
- Caregivers: $34.99 a year, only when the older person has accepted them as a supporter (the elder's plan is never affected).
- Beta: billing code is built but switched off; everyone is free for now. Stripe account not yet created (test mode planned).
- Sign-up asks for ONE name (not traceable, "like Sam"), birth month and year only, an email, and two separate consents (health-data processing, required; marketing email, optional). Minimum age 18 (being implemented).

## 3. What exists today (state of the code)
All work is on a git branch (feat/founders-credit, ~20 commits, private GitHub repo); production still shows the old login-only site until we merge to main (decision pending a signed-in test). A Vercel preview exists behind a Vercel login.
Merged on the branch and tested (about 500 automated tests pass; production build passes):
- Public front door: landing page, "Why we built it" (founders' story), Privacy, Terms, Consumer Health Data Privacy page (Washington MHMDA style), pricing section, installable web app (add to home screen).
- Care sharing (read-only supporter view): owner invites by email; supporter must accept with a confirmed email; owner picks pillars (all unticked by default) and how much is seen: "presence" (just that they logged), "summary" (weekly trend words, no numbers), or "detail" (day values). Pause/resume/end at any time with no notification, a "Shared with:" line on the owner's dashboard, supporter preview, owner-visible access log (counts per day, never times), and a 90-day "still happy sharing?" prompt. Notes, feelings, locations and gentle check-in answers are never shared. Deleting the owner account ends access immediately.
- Doctor-visit summary: a one-page printable/PDF summary of the last 30/90 days from the person's own data only (no AI, nothing leaves the device).
- Privacy controls: download all data, delete my account (cascades everything), email opt-in toggle, AI-consent dialog before any AI call (a plain statement of exactly what is sent).
- Low-data / offline design for elderly users on small cellular plans: Google Fonts removed, pages load on demand, signed-out landing about 144 KB and first dashboard load about 174 KB (gzip, measured), a "Data saver" mode that skips weather and AI until tapped, offline logging that uploads when the connection returns, last 30 days cached for reading offline.
- Mobile shell: Capacitor project for iPhone and Android from the same code (opt-in gentle daily reminder; optional Health import behind a flag). Not yet built or run on a device: this Mac had no Xcode/Android SDK until tonight; Apple Developer account is registered; Xcode is installed and the simulator is being set up. Android builds are planned in cloud CI (needs a GitHub permission). Native apps show "manage your plan on buildyourpillars.com" instead of prices (Apple/Google in-app payment rules).
- Demo data: Miah's own anonymised Apple Health year, extended to today (381 days) so the supporter view is not empty.
Database changes already applied to the live Supabase project and tested in rolled-back SQL (care sharing v1 and v2, waiting list, delete account, consent flags, signup name/birth, billing tables with enforcement off, security-review fixes). Written but not yet applied: email layer (Resend: invites, preset "thinking of you" notes, weekly supporter summary, magic-link sign-in, double opt-in waitlist; needs a Resend account and DNS), AI-consent server check, a consent ledger and privacy-request tracker (30-day clock).

## 4. Safety, privacy and compliance work done today
- Independent adversarial security review of the new database/screens: no high-severity findings; medium/low issues (invite expiry, token-email matching, parallel limit, grants) fixed and re-tested.
- Privacy standard: Washington My Health My Data Act applied to everyone, plus GDPR/PIPEDA/India DPDP where stricter (30-day response, withdrawal as easy as giving, explicit consent, minimum age 18, 72-hour breach notice). Legal review still needed; some GDPR/DPDP source texts could not be fetched.
- EU AI Act and AI safety: a 69-case synthetic adversarial test set showed our AI reply filter failed 47 cases (diet/weight talk, medication advice, look-alike characters, no crisis line on hard days, consent only checked in the browser). A fix is in progress (stronger filter, input sanity checks, server-side consent, crisis line, a test that fails the build on regressions). NVIDIA's garak scanner is recommended for pre-release red-teaming; we are not adding a runtime NVIDIA guard.
- Known unresolved regulatory risk: the optional gentle check-in uses PHQ-2/PHQ-9 questions and shows severity levels, which may look like depression screening (possible medical-device and Apple review issue). Decision pending.

## 5. Not done / honest gaps
- Not live: nothing above is deployed to production yet. The only public AgeTech claim we can make today rests on the branch and preview.
- Apple Health / Google Health Connect sync: code behind a flag, untested on a device.
- Caregiver subscription gating is not wired into the sharing functions (billing is off).
- Email features cannot send until Resend and DNS are set up. Passwordless sign-in, nudges and weekly digest are therefore unavailable.
- No user testing with older adults yet; no accessibility audit by an outside reviewer; no legal review; no store submissions; no Stripe account.

## 6. What we want Perplexity to review (please answer each, with primary sources where you cite facts)
1. AgeTech After Dark fit: given the program's stated aims, how would judges score this? What is our strongest differentiator and our biggest vulnerability? Which 2-3 things should the 3-minute pitch and the written answer lead with? Which claims should we avoid because they are not yet verifiable?
2. Positioning versus real competitors for adults 50+ (health tracking, caregiver coordination, fall/safety monitoring apps). Where is the white space for "connection-first, consent-first, no-pressure, low-data"?
3. Caregiver feature check: compare what we built (section 3) against your own caregiver brief. What is still missing, what is over-built, and what would older adults or caregivers likely distrust?
4. Pricing: free for 60+, $2.99/month under 60, $34.99/year caregiver. Sanity-check against comparable apps and AgeTech buyer norms (including whether making older adults free and charging caregivers is a sound model, and the risk that self-declared age is gamed).
5. Low-data design: are our budgets (about 144-174 KB first load, offline logging, data-saver mode) adequate for older adults on restricted cellular plans and in remote areas? What else matters (SMS/voice fallbacks, large type, offline-first sync conflicts)?
6. Regulatory read: confirm or correct our position that HIPAA does not apply to a consumer app that shares nothing with providers; list what does apply (FTC Health Breach Notification Rule, state consumer health data laws, GDPR, Canada, India); flag the PHQ-9 severity-level issue and what a safe design looks like; and how EU AI Act Article 5 (exploiting age-related vulnerability) and Article 50 (transparency) should shape our AI reflection copy.
7. App store strategy: Capacitor wrapper with native features versus other routes; realistic review timelines; the Google Play organisation/D-U-N-S requirement for health apps; Apple's rules on selling subscriptions inside apps.
8. Risks we have not named: ethical risks around surveillance/coercion by caregivers, dementia and capacity, data left on shared phones, scams that target older adults, and anything the AARP/AgeTech community would flag.
9. A prioritised list: what must be true before the pitch (tonight), before a public launch, and before charging anyone.

## 7. Output format requested
A short summary first (10 lines), then a table: issue, why it matters, evidence/source with link and date, severity (high/medium/low), suggested fix, effort (hours/days). End with "what I could not verify". Please mark anything that comes only from secondary sources.
