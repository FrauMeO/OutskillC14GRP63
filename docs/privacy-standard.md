# Build Your Pillars: the privacy standard (12 October 2026)

**Decision (Miah, 2026-10-12).** The Washington My Health My Data Act (MHMDA, chapter 19.373 RCW) is our privacy standard for **every user everywhere**. Where the GDPR, Canada's PIPEDA or India's DPDP Act 2023 is **stricter** on a point and the rule is workable for a two-person team, we follow the stricter rule for everyone. HIPAA does not apply (consumer app, no covered-entity contracts). **We never claim HIPAA compliance anywhere.**

**This is not legal advice. Every legal-judgement point is marked LEGAL REVIEW.** Written from the code on 12 October 2026 (uncommitted work included).

## Sources and how well each was checked

| Source | URL | Status |
|---|---|---|
| MHMDA, chapter 19.373 RCW (all sections) | https://app.leg.wa.gov/RCW/default.aspx?cite=19.373 (and `&full=true`; per-section `?cite=19.373.010` ... `.040`) | Primary. Fetched 12 Oct 2026 through a page-summarising tool, so timelines were re-fetched section by section and quoted. Re-read the raw text before the lawyer does. |
| Washington AG, MHMDA guidance and FAQ | https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy | Primary. Does not define "necessary", does not say who is protected beyond Washington, does not explain complaint filing. |
| PIPEDA (S.C. 2000, c. 5) | https://laws-lois.justice.gc.ca/eng/acts/p-8.6/FullText.html | Primary. Sections 6.1, 5(3), 8(3)-(5), 10.1, 10.3, 28 and Schedule 1 clauses 4.1.3, 4.3.4, 4.3.6, 4.3.8, 4.5.3, 4.9 confirmed. |
| GDPR, Regulation (EU) 2016/679 | https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng | **Unverified against the page.** Both EUR-Lex fetches returned empty or note-style content. Article numbers and the points below are from the regulation as I know it. Treat every GDPR cell as unverified until someone reads EUR-Lex. |
| DPDP Act 2023 (No. 22 of 2023) | https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf (also indiacode.nic.in, prsindia.org) | **Partly verified.** The MeitY PDF returned HTTP 403. Only search excerpts of ss. 6, 8(1), 8(5), 8(6), 8(9), 9(1) were seen. Rest is **unverified**. |
| Supabase backups | https://supabase.com/docs/guides/platform/backups | Primary vendor docs, fetched. |

---

## (a) What MHMDA requires of a regulated entity

Build Your Pillars is a **regulated entity** (RCW 19.373.010: conducts business in Washington or targets Washington consumers, and decides the purposes and means of processing). It may also be a **small business** (under 100,000 consumers a year); small businesses had to comply from 30 June 2024. Because we apply the standard to everyone, the distinction does not matter to us. LEGAL REVIEW: whether we "target" Washington consumers at all; Miah's decision makes this moot in practice.

### Definitions that matter (RCW 19.373.010)

| Term | What it says (short) | What it means for us |
|---|---|---|
| **Consumer health data** | Personal information linked or reasonably linkable to a consumer that identifies past, present or future physical or mental health status, including "bodily functions, vital signs, symptoms, or measurements", and inferences. | Everything in the daily log (sleep, water, steps, exercise, calories, mood, energy, stress, feelings, notes), check-in scores, goals, and any location tied to a logged day. Treat all of it as consumer health data. LEGAL REVIEW: whether rounded location and birth month/year are themselves "health data" (we treat them as protected anyway). |
| **Collect** | Buy, rent, access, retain, receive, acquire, infer, derive or otherwise process in any manner. | Storing it counts. So does computing Insights. |
| **Share** | Release, disclose, make available, provide access to a third party or affiliate. Excludes disclosure to a **processor** consistent with the original purpose. | Care sharing with a caregiver is **sharing**. Anthropic and Supabase are **processors**, so technically excluded, but we still ask separately for AI (see (c)). |
| **Sell** | Exchange for monetary or other valuable consideration. | We never do. |
| **Processor** | Processes on behalf of a regulated entity. | Supabase, Anthropic (AI call), Vercel (hosting). Needs a binding contract (19.373.060). |
| **Consent** | A clear affirmative act that is freely given, specific, informed, opt-in, voluntary and unambiguous. Not by accepting broad terms of use, hovering, muting, pausing, closing, or deceptive design. | Unticked boxes, one purpose each, not buried in Terms. |
| **Valid authorization** (19.373.070) | Signed, dated document required to **sell**: names and contacts of seller and buyer, the data, purpose, "cannot be conditioned", revocation, redisclosure warning, expires in one year, copy kept six years. | Not needed. We never sell. |
| **Precise location information** | Within a radius of 1,750 feet (about 533 m). | Our location is rounded to 0.1 degree (about 11 km), far coarser. Good. |
| **Geofence** | Virtual boundary of 2,000 feet or less. | We use none. |

### Requirements, with sections

| # | Requirement | RCW |
|---|---|---|
| 1 | Keep a **Consumer Health Data Privacy Policy** that clearly and conspicuously states: categories collected, purposes and use; categories of sources; categories **shared**; categories of third parties and specific affiliates receiving data; how to exercise rights. **Prominently publish a link to it on the homepage.** The AG says the link must be "separate and distinct" and the policy may not include information the Act does not require. | .020(1) |
| 2 | No collecting, using or sharing **additional categories or purposes** not in the policy without first updating it and getting affirmative consent. | .020(2) |
| 3 | **Collect** only (a) with consent for a specified purpose or (b) to the extent **necessary** to provide a product or service the consumer requested. | .030(1)(a) |
| 4 | **Share** only (a) with consent that is **separate and distinct** from the collection consent, or (b) as necessary for a requested service. | .030(1)(b) |
| 5 | The consent request must clearly and conspicuously disclose the categories, the purpose and specific uses, the categories of recipients, and **how to withdraw**. | .030(1)(c) |
| 6 | No unlawful discrimination for exercising rights. | .030(1)(d) |
| 7 | Rights: **confirm** you collect their data and **access** it, including a **list of all third parties and affiliates** it was shared or sold to; **withdraw consent**; **delete**. | .040(1)(a) |
| 8 | Deletion reaches **all systems including archives and backups**; **notify** all affiliates, processors, contractors and other third parties, who must delete too. Backup deletion may be delayed, **not beyond six months** from authenticating the request. | .040(1)(c) |
| 9 | Request methods: secure, described in the policy, available any time; may require use of an existing account but not a new one. May ask for more information to authenticate. | .040(1) |
| 10 | Respond **within 45 days** of receipt; extend **once by 45 days** when reasonably necessary, telling the consumer inside the first 45 days. | .040(1)(g) |
| 11 | Must provide an **appeal** process. Written answer **within 45 days of receipt of the appeal** (the statute gives no appeal extension). If the appeal is denied, tell the consumer how to **contact the Attorney General** to complain. | .040(1)(h) |
| 12 | First two requests per year per consumer free; manifestly unfounded or excessive ones may be charged or refused, the entity proving why. | .040 |
| 13 | **Security**: restrict access to people who need it; safeguards at least at the industry's reasonable standard of care. | .050 |
| 14 | **Processors** only under a binding contract with instructions, and must help us meet our duties. | .060 |
| 15 | **Selling** requires a signed valid authorization, separate from other consents. | .070 |
| 16 | **No geofence** within 2,000 feet of in-person health care to identify, track, collect data from, or message consumers. | .080 |
| 17 | **Enforcement**: a violation is a per se unfair or deceptive act under the Consumer Protection Act (chapter 19.86 RCW); the AG enforces and **private parties can sue**. | .090; AG FAQ |
| 18 | Exemptions (HIPAA data and others); the entity must prove an exemption. | .100 |

Note the instruction in the brief said "60-day appeal response". **The statute says 45 days** (.040(1)(h)). We use the stricter 30 days (see (c)).

---

## (b) Side by side

Cells marked *u* are unverified (see source table).

| Topic | MHMDA | GDPR (*u*) | PIPEDA | DPDP 2023 (*u* unless noted) |
|---|---|---|---|---|
| **Consent standard** | Clear affirmative act; free, specific, informed, opt-in, unambiguous; not via broad terms (.010) | Art. 4(11), 7; **explicit** consent for health data, Art. 9(2)(a); unbundled, 7(2) | Valid only if the person understands nature, purpose, consequences (s. 6.1); **express** consent for sensitive information (cl. 4.3.4, 4.3.6) | Free, specific, informed, unconditional, unambiguous, clear affirmative action, with a notice first (s. 6; partly verified) |
| **Separate consent to share** | **Yes**, separate from collection (.030(1)(b)) | Purpose-specific; each purpose separately (Art. 7, recitals) | Each purpose and disclosure needs its own valid consent (4.3) | Consent is per specified purpose (s. 6) |
| **Withdrawal** | Right to withdraw (.040(1)(a)); request must say how | **As easy to withdraw as to give**, Art. 7(3) | At any time, subject to legal limits and reasonable notice; explain consequences (cl. 4.3.8) | Right to withdraw; ease comparable to giving it (s. 6(4)); processing must stop after withdrawal (s. 6(6)) |
| **Access** | Confirm, access, **list of third parties** shared or sold to; 45 days | Art. 15: copy, recipients, purposes; one month | Cl. 4.9, s. 8: **30 days** (s. 8(3)), limited extensions (s. 8(4)) | s. 11: summary of data and the identities of fiduciaries and processors it was shared with |
| **Deletion** | All systems incl. backups; notify processors and third parties; backups **at most 6 months** (.040(1)(c)) | Art. 17 "without undue delay"; 17(2) tell other controllers; Art. 19 notify recipients | Destroy, erase or anonymise when no longer needed (cl. 4.5.3); on withdrawal | s. 12 erasure on request; s. 8(7) erase when purpose served or consent withdrawn |
| **Portability** | Not explicit (access right) | **Art. 20**: structured, machine-readable | Not explicit | Not explicit |
| **Retention** | No fixed term; collect only what is necessary (.030) | Storage limitation, Art. 5(1)(e) | Keep only as long as needed (cl. 4.5) | Erase once purpose is served (s. 8(7)) |
| **Sale** | Needs signed **valid authorization**, 1-year expiry (.070) | No special regime; needs a legal basis and Art. 9 condition | Consent needed for each disclosure | Consent for specified purpose |
| **Geofencing** | Banned near health care (.080) | No specific ban | None | None |
| **Privacy policy placement** | Separate "consumer health data privacy policy", prominent homepage link (.020) | Arts. 12-14: concise, transparent, easily accessible | Principle 4.8 openness; readily available | Notice before or with every consent request (s. 5) |
| **Children** | No age rule of its own | **Art. 8**: 16 (states may set 13 to 16) | No set age; judged by capacity (OPC guidance *u*) | **Under 18**: verifiable parental consent, no tracking or behavioural monitoring of children (s. 9; s. 9(1) verified) |
| **Breach notification** | None in MHMDA (Washington's separate breach law, RCW 19.255: *u*) | Authority within **72 hours** (Art. 33); individuals if high risk (Art. 34) | To the Commissioner and individuals "as soon as feasible" if real risk of significant harm (s. 10.1); keep records (s. 10.3) | Notify the Board and each affected person (s. 8(6), verified); timing set by Rules (*u*) |
| **Enforcement** | AG plus **private lawsuits** under the Consumer Protection Act (.090) | Fines up to EUR 20m or 4% of turnover (Art. 83(5)) | Fines up to CAD 100,000 on indictment for certain offences (s. 28); Commissioner complaints | Penalties up to INR 250 crore schedule; INR 200 crore for breach-notice and child-data failures (partly verified) |
| **DPIA** | None | **Art. 35** for high-risk processing; health data at scale, vulnerable people, new tech | Not required (privacy impact assessments encouraged by the OPC, *u*) | Only for "Significant Data Fiduciaries" (s. 10) |
| **Records of processing** | None | **Art. 30**; the small-organisation exemption does not apply to special-category data | None | None |

---

## (c) THE ONE STANDARD

Each rule is the strictest that two people can run. "Everyone, everywhere."

| Row | The single rule we follow |
|---|---|
| Consent standard | Unticked box, one purpose per box, plain words, never inside the Terms. Explicit, informed, recorded on the server with the version and a fingerprint of the exact words shown. No consent, no collecting. |
| Separate consent to share | **Four separate yeses**: (1) keep and use my data to run the app, (2) share with a named caregiver (asked again for every invitation), (3) AI help, (4) marketing email. None is a condition of another except (1) for having an account. Services we send data to that are not our processors for the same purpose (weather lookups) are disclosed in the policy and are limited to rounded location. |
| Withdrawal | One tap in Settings, as easy as giving it, effective at once, no reason asked, no email needed. Withdrawing (1) stops saving new entries and offers deletion. |
| Access | Self-service download (JSON and CSV) plus a "Who has my data" list of every third party and processor. Email requests answered within **30 days** (GDPR one month, PIPEDA 30 days; stricter than MHMDA's 45). |
| Deletion | Self-service, the live copy is gone immediately. We tell processors (Supabase, Anthropic) through their contract terms and by removing the data they hold on our side. Backups expire by themselves, in no more than the provider's window (7 to 28 days on paid plans, to be confirmed for our plan), **never later than 30 days**, and a deleted account is never restored from a backup (MHMDA allows six months). |
| Portability | JSON and CSV, structured and readable (GDPR Art. 20). |
| Retention | Keep health data only while the account lives. Ended care-share records purged after 30 days. Waitlist emails removed 30 days after launch. Founders to decide on deleting long-inactive accounts (proposal: after 24 months with a warning). |
| Sale | **Never.** No valid-authorization flow is built, because none is needed. |
| Geofencing | **Never.** We do not use location to find or message anyone near a health care place. |
| Privacy policy placement | A **separate** Consumer Health Data Privacy Policy page, linked prominently on the homepage footer area, and linked from every consent screen. The general policy keeps GDPR and other content and points to it. |
| Children | **18 and older.** (DPDP treats under 18 as children; GDPR sets 16. The product is for adults 50 and over, so this costs nothing.) Today the code enforces 16 (`src/lib/signup.ts:6`, `supabase/migrations/0016_signup_name_and_birth.sql:40`). |
| Breach notification | Triage within 24 hours. Tell affected people and the relevant authorities **within 72 hours** of becoming aware, wherever any of these laws could apply (GDPR is the strictest clock; PIPEDA and DPDP also require telling people). Keep a breach log. |
| Enforcement | Treat each regime's complaint route as live. The policy names the Washington AG and the person's local authority. |
| DPIA | Do one short DPIA before wider launch (outline in `docs/gdpr-compliance.md` section 7). |
| Records of processing | Keep the Art. 30 table (`docs/gdpr-compliance.md` section 11) up to date. |
| Appeals | Written answer within **30 days** (MHMDA: 45), by email, with the AG complaint route if denied. |
| Request response clock | **30 days.** If we truly need more time, we tell the person inside the first 30 days why and extend once by up to 30 days (total 60, which is inside MHMDA's 45+45 and GDPR's one month plus extension). LEGAL REVIEW: the extension wording. |

### Special points

**Separate consent to COLLECT vs to SHARE.** Collecting is covered by the sign-up consent plus the "necessary to provide the service" ground (.030(1)(a)). Sharing is never covered by it:
- **Care sharing with a caregiver = sharing.** Own consent, shown when the owner creates the invite, naming the recipient, categories (pillars chosen, level of detail), purpose, and how to stop it.
- **AI reflection via Anthropic.** Anthropic acts as our processor, so MHMDA's "share" definition excludes it. We still ask separately because GDPR Art. 9 needs explicit consent for sending health data out, Apple 5.1.2(i) expects it, and it is simply honest.
- **Weather lookups send rounded coordinates to Open-Meteo** (`src/lib/conditionsCore.ts:162-168`), and a city name or rounded coordinates to BigDataCloud (`src/lib/location.ts:57,72`), from the person's browser. The services also see the IP address. They do not receive health data. Rounded to 11 km is not "precise location" (1,750 ft). Rule: disclose both in the health policy, ask before device location is used (the browser prompt plus our one-line note), and move the calls behind our own edge function so the person's IP is not exposed (gap 8). LEGAL REVIEW: whether these two are "third parties" or whether disclosing a coarse location for a requested weather feature falls under "necessary".
- **Google Fonts** is being removed by another agent. It receives IP only, never health data. The health policy does not list it; the general policy still does until the removal ships.
- **Stripe** will receive the email address and payment details for billing (under-60 plan, $2.99 a month, shown on the landing page). **It never receives health data.** Billing and the health tables stay separate, and the Stripe customer record holds no health or usage data. Not in the code yet; the health policy has one sentence saying so and must be rechecked at build time.

**What counts as strictly necessary** (our reading of .030(1)(a); the statute and the AG FAQ do not define it; LEGAL REVIEW):

| Necessary to run what the person asked for | Needs its own consent, or is optional |
|---|---|
| Email and password (sign-in), display name, birth month and year (sets the plan and enforces the age rule), the entries the person chooses to log, goals, check-in results *if the person takes a check-in*, rounded location per logged day, cached weather for those days | AI help (Anthropic), caregiver sharing, marketing email, device location (browser prompt), home city (optional), Apple Health import (device prompt), reminders (device prompt) |

Everything optional has an off position that leaves the app working.

**The duty not to use non-necessary data beyond consent** (.020(2), .030). Health data is used only to show the person their own days, trends and Insights, and (with a yes) for AI reflections and caregiver views. No analytics, no product research, no model training, no advertising, no profiling on health data. A new category or purpose means: update the policy first, ask for a fresh yes, then use it. In the ledger this is a new consent *version*.

**The 45-day clock.** We run a stricter 30-day clock. Each emailed request is logged with a received date and a due date at day 30 (see the spec). MHMDA's own limit is 45 days plus one 45-day extension with notice in the first 45.

**Deletion including backups and processors.** Live database: `delete_my_account()` deletes the auth user and every owned row cascades (`supabase/migrations/0012_delete_my_account.sql:14`; confirmed by `docs/security-review-2026-10-12.md`, "Cascades"). Not covered by the cascade: the waitlist (no user link), Supabase provider backups, Vercel/Supabase platform logs (retention unverified), Anthropic request retention (unverified), emails already sent. Supabase documented backups: Pro 7 days of daily backups, Team 14, Enterprise up to 30; PITR is an add-on with 7, 14 or 28 days; no stated way to purge a single user from a backup; deleting the *project* removes its backups (https://supabase.com/docs/guides/platform/backups). The free plan states no retention. **Unverified: which plan our project is on.** The project sits in Miah's personal org. Our promise of "no later than 30 days" holds on every paid plan; confirm the plan before the page says a number.

**Right to withdraw as easy as to give.** Giving is one tick. Withdrawing must be one switch (Settings), with the same dialog size and no extra friction. Today only AI (`src/components/AiConsentSetting.tsx`), gentle check-ins and marketing can be switched off in the app; health-data consent can only be removed by deleting the account (Gap 2).

**No sale, no geofence.** Stated on the policy page; nothing in the code does either.

**Access to a list of third parties.** The policy page names every recipient; Settings gets a "Who has my data" panel (spec section 5); email requests get the same list.

### How the other items fit

| Item | Where it fits |
|---|---|
| **Birth month and year** (`src/pages/AuthPage.tsx:121-157`, stored on `profiles`, migration 0016) | Not health data on its own, but linked to health data so it is protected the same way. Necessary: sets the plan (free from 60) and enforces the age limit. Month and year only, never the day (data minimisation, GDPR Art. 5(1)(c)). Not shared with caregivers or AI. Disclosed on the health page. |
| **Single display name** (`AuthPage.tsx:103-119`, `src/lib/signup.ts:17-23`) | Not health data. Necessary to address the person and to label the caregiver view. Shown to a caregiver the person invites. One name, 40 characters, no need for a real name. |
| **Location rounded to 11 km** (`src/lib/location.ts:19-21`) | Far coarser than MHMDA's "precise" (1,750 ft). Treated as protected because it is tied to a dated health entry. Sent to Open-Meteo/BigDataCloud for weather. Never shared with caregivers (`0010_care_shares.sql:5-8`) and never sent to AI (`supabase/functions/daily-reflection/logic.ts:63-85`). |
| **Optional email marketing opt-in** (`AuthPage.tsx:227-235`, `src/components/EmailPreferences.tsx`) | Not health data and never combined with health data. Its own unticked box, its own consent record, one tap to turn off, an unsubscribe link in each email. LEGAL REVIEW: Canada's anti-spam law (CASL) and CAN-SPAM wording, which I did not research. |

---

## (d) Gap table: each rule against the app today

Tags: **code**, **copy**, **founders**, **lawyer**. Effort: S under half a day, M one to two days, L more. Rank 1 is the biggest.

| Rank | Rule | Current app (file) | Concrete change | Tags | Effort |
|---|---|---|---|---|---|
| 1 | AI consent is a real, recorded, server-checked yes | Stored only in the browser (`src/lib/aiConsent.ts:1-5`, key `byp.aiConsent.<id>` in localStorage). The edge function never checks it (`supabase/functions/daily-reflection/index.ts:45-89`): anyone with a session can call it. Not recorded server-side, so no proof and it vanishes on a new device. | Consent ledger (spec section 3). Edge function calls `has_consent('ai_processing')` before reading any data. Browser store becomes a cache. | code | M |
| 2 | Collect-and-use consent is recorded, versioned, tamper-proof, and can be withdrawn | One sign-up checkbox (`AuthPage.tsx:210-226`) writes `health_consent_at` through client-supplied metadata (`0013_email_consent.sql:30-50`); users can rewrite it (security review L3); no version or text hash; no withdrawal other than deleting the account. | Ledger plus `record_consent()`; lock the column; gate `habit_logs` inserts on `has_consent('collect_use')`; add "Pause saving my data" in Settings. | code | M-L |
| 3 | Caregiver sharing has its own consent naming recipient, categories, purpose and how to stop | Invite form has an email field, pillar boxes and a level (`src/components/SharingSettings.tsx:378-400`), no consent step, no record. | Consent dialog on "Send invitation" (spec section 4.2) and a ledger row per share. (`SharingSettings.tsx` is not mine to edit; spec only.) | code | M |
| 4 | Separate Consumer Health Data Privacy Policy, linked from the homepage | Only a section inside `src/pages/Privacy.tsx`. | **Done in this task:** `src/pages/HealthDataPrivacy.tsx`, footer and callout in `src/components/PublicLayout.tsx`, pointer in `Privacy.tsx`. **Still to do:** route in `src/App.tsx` (one line), links from every consent screen. | copy, code | S |
| 5 | 30-day clock, appeal path and request log | Policy said "one month" (`Privacy.tsx:245`); no log, no appeal path, no due dates. | Policy now says 30 days with the appeal path (done). Add `privacy_requests` table and a weekly founder check (spec section 8). | copy (done), code, founders | S then M |
| 6 | Minimum age 18 | 16 in `src/lib/signup.ts:6`, trigger `0016_signup_name_and_birth.sql:40`, `Privacy.tsx:319`, `Terms.tsx`. | Raise to 18 in all four places (new migration for the trigger; the code agent must not edit 0016). | code, copy, lawyer | S |
| 7 | Breach plan, DPAs, DPIA, Art. 27 representative | Drafts exist in `docs/gdpr-compliance.md` (sections 5 to 9). No signed DPAs verified. | Sign Supabase, Vercel, Anthropic DPAs; confirm Anthropic retention and training terms; run the DPIA; decide the EU representative. | founders, lawyer | M |
| 8 | Third parties do not see IP addresses for weather and place names | Browser calls Open-Meteo and BigDataCloud directly (`src/lib/conditionsCore.ts:162-168`, `src/lib/location.ts:57,72`). | Proxy through an edge function (server IP, not the person's), or drop BigDataCloud. | code | M |
| 9 | Retention rules | Ended shares keep the invitee email forever (`0010_care_shares.sql`); waitlist forever (`0011_waitlist.sql`). | Scheduled purge of ended shares after 30 days and waitlist 30 days after launch. Decide on inactive accounts. | code, founders | M |
| 10 | Backups and processors on deletion | `delete_my_account()` cascades live rows only. | Confirm the Supabase plan and its backup window; add the "what remains" text to the delete dialog (spec section 7); never restore deleted accounts. | founders, copy | S |
| 11 | Marketing consent is recorded and unsubscribable | `profiles.marketing_opt_in` and `_at` only; waitlist double opt-in missing (security review M1, partly fixed in `0014_review_fixes.sql`). | Ledger row per change; unsubscribe link; double opt-in for the waitlist. | code | S-M |
| 12 | Delete needs a recent sign-in | Typing a word is enough (`src/components/DeleteAccount.tsx:15`; security review L4). | Re-enter the password, or check a fresh session in the RPC. | code | S |
| 13 | Edge function CORS is `*` | `index.ts:30` | Restrict to the real origins. | code | S |
| 14 | Strong passwords | UI says 8 (`AuthPage.tsx:198`); leaked-password check is off (security review M3). | Turn on leaked-password protection in the Supabase dashboard; raise the minimum to 10. | founders | S |
| 15 | Export covers every personal data table | `care_shares` included (`src/pages/Settings.tsx:70-71`, `src/lib/export.ts:7-14`); the new consent ledger and requests are not. | Add `consent_events` to the export. | code | S |

### Where other regimes are stricter than MHMDA, and what we do

| Point | Stricter rule | Our action |
|---|---|---|
| Response time | PIPEDA 30 days; GDPR one month | 30 days (and 30 for appeals) |
| Withdrawal ease | GDPR Art. 7(3) | One switch, same effort as giving |
| Explicit consent | GDPR Art. 9(2)(a); PIPEDA express consent for sensitive data | Always explicit, never implied |
| Children | DPDP: under 18 | 18+ for everyone |
| Breach notification | GDPR 72 hours; PIPEDA/DPDP notify individuals | 72 hours to authorities and people |
| Portability | GDPR Art. 20 | JSON and CSV |
| DPIA, records of processing | GDPR Arts. 35, 30 | Do both |
| Backups | MHMDA allows six months | 30 days at most |

---

## Could not verify (kept off the public page)

1. GDPR wording against EUR-Lex (both fetches failed or returned notes). All GDPR cells.
2. DPDP full text (403). Sections 6(4), 6(6), 8(6) timing, 8(7), 9(2)-(3), 10, 11, 12, the penalty schedule, the age of a child.
3. PIPEDA s. 8(4) extension length and the Commissioner's guidance on minors.
4. Washington's breach statute (RCW 19.255), CASL and CAN-SPAM requirements, and the AG's complaint page https://www.atg.wa.gov/file-complaint (named in the AG's site, not opened).
5. Which Supabase plan we are on, and so the real backup window; Supabase/Vercel log retention.
6. Whether a DPA is signed with Supabase, Vercel, Anthropic; Anthropic retention, training use, region (`docs/gdpr-compliance.md` section 1.3).
7. Whether `VITE_AI_REFLECTION` is on in production (`src/features/aiReflection/AiReflectionCard.tsx:10`). If it is off, the AI paragraphs of the policy describe a feature nobody sees.
8. Whether Open-Meteo's free tier allows commercial use; whether BigDataCloud or Open-Meteo count as "third parties" receiving "consumer health data".
9. Stripe: not in the code yet.
10. The Supabase Auth email sender and its retention.

## LEGAL REVIEW list

1. Whether we are a "regulated entity" or "small business", and whether to apply the Act to non-Washington users (Miah decided yes; confirm the wording does not over-promise).
2. Whether rounded location, birth month/year and display name are "consumer health data".
3. Our reading of "necessary" (.030(1)(a)).
4. Whether Anthropic and Supabase are processors (excluded from "share") and whether a contract meets .060.
5. Whether Open-Meteo/BigDataCloud are third parties and whether our disclosure is enough.
6. 30-day clock and the one-time 30-day extension wording; appeal wording and the AG complaint route.
7. Backup promise (30 days, never restored) against the real Supabase plan.
8. Minimum age 18 and the effect on India (DPDP) and the EU (Art. 8).
9. Whether keeping a consent record after account deletion is allowed or required; we delete it with the account.
10. Whether a 24-month "inactive account" deletion is wise, and email-marketing law (CASL, CAN-SPAM).
11. The statement that we do not claim HIPAA compliance and that HIPAA does not apply.
12. EU representative (GDPR Art. 27) and EU/Canada/India supervisory authorities named in the policy.
