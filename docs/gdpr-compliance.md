# Build Your Pillars: GDPR compliance foundation

Prepared 12 October 2026 from the code on branch `feat/founders-credit` (uncommitted work included). **This is not legal advice.** Every item marked **[LEGAL]** needs a lawyer or privacy professional to confirm. "Could not verify" means the code and repo do not show it; it needs a check in a dashboard or contract.

Founders: Miah Shull Olmsted and Robert Olmsted. Contact: hello@buildyourpillars.com (`src/lib/waitlist.ts:10`).
Target markets: US, Canada, India, UAE, Germany. The app handles health data, which is special-category data under GDPR Art. 9.

Assumption: `delete_my_account()` plus a Settings "Delete my account" button will exist and delete the auth user and all rows by cascade (as stated by the founders). Not verified in code, because it is not written yet.

---

## 1. Facts: what the code actually does

### 1.1 Data collected

| Data | Where collected | Evidence |
|---|---|---|
| Account email, password (handled by Supabase Auth), full name, optional home city (name, country code, lat/long rounded to 0.1 degree) | Sign-up form | `src/pages/AuthPage.tsx:47-58`; trigger copies to `profiles`: `supabase/migrations/0004_checkin_location_conditions.sql:78-107` |
| Daily log: exercise minutes, sleep hours, water, steps, stand hours, active calories, time in bed, minutes awake, calories eaten, free-text notes, source (manual or Apple Health import) | Log Habits page, import script | `0001_init.sql:20-30`, `0006_dashboard_metrics.sql:8-16` |
| Mood, energy, stress (1-5) and "feelings" (13 labels, e.g. anxious, lonely, overwhelmed) | Log Habits page | `0004:17-23`, `0008_more_feelings.sql`; label list `supabase/functions/daily-reflection/logic.ts:33-37` |
| Location for each logged day: city name, lat/long rounded to 0.1 degree (about 11 km), source (device or home) | Log Habits (browser geolocation if allowed, else home city) | `src/lib/location.ts:1-2,19-21,86-101`; `0004:24-27` |
| Cached weather, air quality, pollen and moon data per logged day, tied to the user and the rounded location | Fetched by the browser, saved | `0004:37-63`; `src/lib/conditionsCore.ts:162-168` |
| Goals (type, target, unit) | Goals page | `0001_init.sql:11-18` |
| "Gentle check-in" results: date offered, date taken, PHQ-2 score, PHQ-9 total, PHQ-9 item 9 score (the self-harm question) | Reflect page | `0007_reflections.sql:14-27`; `src/pages/Reflect.tsx:125,134` |
| Settings flags: `gentle_checkin_enabled` (default on), `auto_reflection` (default off) | Settings | `0007:9-10`, `0009_auto_reflection.sql:6-7` |
| Care sharing: the invitee's email address (a third party who may not be a user), chosen pillars, status, timestamps | Settings, sharing | `0010_care_shares.sql:14-30,90-92` |
| Waitlist: email, iOS/Android choice, timestamps. No account needed | Landing and sign-up pages | `0011_waitlist.sql:6-16`; `src/components/WaitlistForm.tsx:21` |

The AI reflection (1.3) does not store anything.

### 1.2 Where it is stored

- One Supabase project, "PersonalHealthManager", ref `gzsawayrorlcjmpssalc`, **region us-east-1 (United States)**, in Miah's personal Supabase organization (`CLAUDE.md`, "Supabase project"; URL at `docs/handover.md:212`). Row Level Security (RLS) is on for every table: `profiles`, `goals`, `habit_logs` (own rows only: `0001:36-66`), `daily_conditions` (`0004:65-74`), `reflections` (`0007:31-40`), `care_shares` (read by the two parties, writes only through checked functions: `0010:37-48`), `waitlist` (RLS on, no policies, browser roles revoked: `0011:18-20`).
- The site is a static Vite build on Vercel (`vercel.json:1-6`). The only server code of ours is the Supabase edge function. Vercel region: could not verify.
- Backups and point-in-time recovery: could not verify (Supabase plan not visible in the repo).

### 1.3 Third parties and exactly what they receive

| Third party | What it receives | Evidence |
|---|---|---|
| **Supabase** (database, auth, edge function host), US | Everything in 1.1 | above |
| **Vercel** (hosting) | Every visitor's IP address, user agent and requested URL (normal hosting logs). No personal content: the app is static and calls Supabase directly | `vercel.json`; log retention could not verify |
| **Anthropic** (Claude API), called only from the edge function | Exact payload below | `supabase/functions/daily-reflection/index.ts:94-118` |
| **Open-Meteo** (weather, air quality, city search), called **from the user's browser** | Rounded lat/long (0.1 degree) and a date range for weather: `src/lib/conditionsCore.ts:162-168`. The text typed when searching for a city: `src/lib/location.ts:57`. The browser's IP address (direct browser call) | as cited |
| **BigDataCloud** (reverse geocoding), called **from the user's browser** | Rounded device lat/long (0.1 degree) when logging today with device location, to get a city name; plus IP address. `src/pages/LogHabits.tsx:259-260`, `src/lib/location.ts:71-72`. **Not mentioned in earlier product copy. Add it to the processor list.** | as cited |
| **Google Fonts** (fonts.googleapis.com, fonts.gstatic.com), loaded on every page | Every visitor's IP address and browser details | `index.html:19-21`. **A known GDPR problem: a German court (LG Muenchen I, January 2022) held that loading Google Fonts from Google's servers without consent breached GDPR. [LEGAL] confirm. Fix: self-host the fonts (small code change).** |
| findahelpline.com | Only if the person clicks a normal outbound link | `src/lib/reflection.ts:197` |

**Exact AI payload (daily mode).** The edge function reads the person's own `habit_logs` row with their session, so RLS applies (`index.ts:59-62`), selecting 14 columns (`index.ts:38-39`). It sends Claude only the text built by `describeDay` (`logic.ts:63-85`) and `userMessage` (`logic.ts:101-103`): the date, then plain sentences for water litres, calories eaten, sleep hours, hours in bed, minutes awake, exercise minutes, steps, stand hours, active calories, mood, energy and stress as words ("mood sad", "stress high"), and feelings as words ("felt anxious, lonely"). **Not sent**: name, email, user id, notes, location, weather, check-in answers (`logic.ts:62`; `index.ts:7`). The system prompt is fixed text (`logic.ts:87-98`).
**Weekly coach mode** (`index.ts:65-78`, `logic.ts:162-174`): the same lines for the last seven days with dates, plus the person's goals as words (for example "sleep: 8 hours a night"). Calorie goals are never sent (`logic.ts:122`).
**Hard days and hard weeks are never sent.** Mood 1, or low mood with high stress, or low mood with "overwhelmed" or "lonely" returns a fixed message instead (`logic.ts:46-54,139-144`; `index.ts:73-76,84-87`).
**Retention by us**: nothing stored; the function logs only the model name and errors, not the person's data (`index.ts:120,132`). Supabase's own function logs: could not verify.
**Retention by Anthropic**: could not verify. Depends on the Anthropic account's terms (API data retention, any zero-data-retention agreement). **[LEGAL]/founders: check.** The call uses a server-side fallback beta (`index.ts:116-117`), so a request may be re-run on another Anthropic model; confirm the terms cover this.
**Model and region**: default `claude-opus-5-5`, overridable by secret (`index.ts:98`). Anthropic processing region: could not verify.
**Accuracy of current marketing**: `src/pages/Landing.tsx:33` says "Any AI help sees numbers only, never your words." The payload includes feeling words chosen from a list and mood/stress as words. Notes and free text are never sent, but "numbers only" is not exactly true. Reword (gap 6).
**Is it on?** The AI card shows only when `VITE_AI_REFLECTION === 'on'` (`src/features/aiReflection/AiReflectionCard.tsx:10,60`). Whether that is set in production: could not verify. Nothing is sent until the person presses a button or switches on the automatic option (`AiReflectionCard.tsx:3-4,51-58`; default off: `0009:6-7`). The feature is marked TEMPORARY for the hackathon (`logic.ts:1-4`). If it is removed, remove the AI parts of the policy.

### 1.4 What is kept in the browser

- Our code does not use `localStorage`, `sessionStorage`, `document.cookie` or `indexedDB` (searched `src/`, `public/`, `index.html`: no matches).
- The Supabase client is created with default options (`src/lib/supabase.ts:13`). The library default (`persistSession: true`, seen in `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`) keeps the signed-in session in the browser's local storage. That is the only browser storage expected. **Not observed in a live browser: check in dev tools before launch.**
- The last AI reflection is held in memory only (`AiReflectionCard.tsx:15-17`).
- Service worker caches nothing and does not touch requests (`public/sw.js:1-7`), registered in `index.html:28-33`.
- `package.json` dependencies are react, react-dom, react-is, react-router-dom, recharts and supabase-js only; `index.html` loads no tracking scripts. So no analytics, advertising or social trackers in our code. Vercel Web Analytics or Speed Insights could be switched on in the Vercel project without code; could not verify.
- Cookies set by Vercel or Supabase servers: could not verify. The app sets none itself.

### 1.5 Retention, deletion, export, correction today

| Topic | Today | Evidence |
|---|---|---|
| Retention | No automatic deletion anywhere. Data stays until the user deletes rows. Waitlist emails stay forever. Ended (revoked) care shares keep the invitee email forever (soft end). Cached weather stays | no purge job in `supabase/`; `0010:153-157` |
| Whole-account deletion | **Does not exist yet** (being added). The site already says "delete everything whenever you like" | `SignupWelcome.tsx:19`, `Landing.tsx:32`, `Why.tsx:28`; also `docs/store-apps-plan.md:10` |
| Deleting parts | Reflection history can be deleted (`Settings.tsx:110-115`). Logs and goals have delete policies (`0001:56,66`); whether the UI offers per-day delete: could not verify | |
| Cascades | User tables reference `auth.users ... on delete cascade` (`0001:6,13,21`, `0004:39`, `0007:16`, `0010:15,20`), so deleting the auth user removes them. `waitlist` has no user link, so it is **not** removed | |
| Export | "Download all my data" JSON, plus a daily-log CSV, in Settings. Covers profile, habit_logs, goals, daily_conditions, reflections. **Does not include care_shares** | `Settings.tsx:58-91`, `src/lib/export.ts:7-13` |
| Rectification | Name and home city editable (`Settings.tsx:124,142`); a day's log can be re-saved (upsert, `0001:29`). Email change: no UI found | |
| Restriction, objection | None; by email only | |
| Withdraw consent | Toggles for gentle check-ins (`Settings.tsx:48`) and automatic AI (`Settings.tsx:98`); end sharing (`end_care_share`, `0010:143-159`). No consent records exist | |
| Care sharing | The viewer gets only ticked pillars, only logged days, never notes, feelings, locations or check-in answers (`0010:5-8,207-231`). Balance (mood/energy/stress) is off by default (`0010:25`). The viewer also sees the owner's full name (`0010:173`). Invitations are not emailed (`SharingSettings.tsx:106`) | |

---

## 2. (a) Data map

| # | Data | Category | Purpose | Store | Recipients | Retention now | Retention proposed |
|---|---|---|---|---|---|---|---|
| 1 | Email, password hash, sign-in data | Identity | Run the account | Supabase Auth, us-east-1 | Supabase | Until account deleted | Until deletion |
| 2 | Full name, home city, rounded coordinates | Identity, location | Personalise, weather | `profiles` | Supabase; name shown to people you share with | Until deleted | Until deletion |
| 3 | Habit numbers, notes | **Health (Art. 9)** | The service | `habit_logs` | Supabase; ticked pillars to invitees; words to Claude if AI used | Until deleted | Until deletion; consider an "older than" cleanup tool |
| 4 | Mood, energy, stress, feelings | **Health (Art. 9)** | The service | `habit_logs` | Supabase; invitees if Balance ticked; Claude (words) if AI used | Until deleted | Same |
| 5 | Gentle check-in scores incl. PHQ-9 item 9 | **Health (Art. 9), highly sensitive** | Optional self-reflection | `reflections` | Supabase only. Never shared, never sent to AI (`logic.ts:62`) | Until deleted | Until deletion |
| 6 | Per-day location (city, 0.1 degree) | Personal data (coarse) | Attach weather | `habit_logs`, `daily_conditions` | Supabase; Open-Meteo and BigDataCloud get coordinates | Until deleted | Until deletion |
| 7 | Weather cache | Derived | Insights | `daily_conditions` | Supabase | Until deleted | Until deletion |
| 8 | Goals | Health-adjacent | The service | `goals` | Supabase; invitees (relevant pillars) | Until deleted | Until deletion |
| 9 | Invitee email, pillar choices | Third-party personal data | Match invitation | `care_shares` | Supabase | **Forever, even after ending** | Delete ended rows after about 30 days |
| 10 | Waitlist email, store choice | Contact | Launch notice | `waitlist` | Supabase | **Forever** | Delete at launch plus about 30 days |
| 11 | IP address, user agent | Online identifier | Hosting, security | Vercel, Supabase, Open-Meteo, BigDataCloud, Google Fonts | Those providers | Provider-controlled, could not verify | Reduce: self-host fonts |
| 12 | AI request (date, habit and mood words, goals) | **Health (Art. 9)** | Reflection text | Not stored by us; Anthropic retention could not verify | Anthropic | None by us | Verify Anthropic terms |

---

## 3. (b) Lawful basis per purpose and consent UX

| Purpose | Art. 6 basis | Art. 9 condition | Notes |
|---|---|---|---|
| Create and run the account (email, name, password) | 6(1)(b) contract | none (not health data) | |
| Store habits, mood, feelings, notes, location, goals, check-in results | 6(1)(b) contract and 6(1)(a) consent | **9(2)(a) explicit consent**. Contract alone is not enough for health data | Recorded, specific, unticked consent at sign-up |
| Weather lookup (Open-Meteo, BigDataCloud) | 6(1)(b) contract (feature the user asked for); browser location prompt as additional consent | n/a for rounded coordinates alone; treat together with health logs | Disclose both services |
| AI reflection (Anthropic) | 6(1)(a) consent | **9(2)(a) explicit consent**, separate from account consent | Own opt-in before first use (Apple 5.1.2(i) also requires it, `docs/store-apps-plan.md:47`) |
| Care sharing | 6(1)(a) consent of the owner | 9(2)(a) | Invitee email is third-party data: 6(1)(f) legitimate interest to match the invitation **[LEGAL]** |
| Waitlist emails | 6(1)(a) consent | n/a | Clear consent line and a removal route. Current text says what is kept (`waitlist.ts:12`) |
| Security and abuse prevention, logs | 6(1)(f) legitimate interest | n/a | Short balancing note, keep logs short |
| Legal obligations (tax records etc.) | 6(1)(c) | n/a | Only if payments are added |

### Consent UX needed (code work)

1. **At sign-up**: an unticked checkbox beside Create account, in plain words: "I agree that Build Your Pillars may store the health information I choose to enter (habits, mood, feelings, notes, check-in answers) so the app can work. I can withdraw this and delete everything at any time." Link to `/privacy`. No account without it. Store consent version and timestamp (for example `profiles.health_consent_at`, `health_consent_version`). Never pre-tick.
2. **Before the first AI reflection**: a separate dialog: what is sent (the list in 1.3), who processes it (Anthropic, USA), that we do not store it, with Allow and Not now. Store `ai_consent_at`. Withdrawal switch in Settings.
3. **Device location**: the browser asks already; add a one-line note first.
4. **Waitlist**: a line under the email field: "We will email you once when the app is ready and keep your address until then. To be removed, email hello@buildyourpillars.com."
5. **Withdrawal** must be as easy as giving consent: Settings, "Withdraw consent and delete my account".
6. Link Terms and Privacy on the sign-up and waitlist screens (`AuthPage.tsx` is the founders' file).

---

## 4. (c) Data subject rights

| Right | Current status in app | Gap |
|---|---|---|
| Information (Arts. 13-14) | Privacy page written (`/privacy`); not yet routed or linked from sign-up | Route, link; legal review |
| Access (Art. 15) | "Download all my data" (JSON and CSV), `Settings.tsx:58-91` | Add `care_shares`; list recipients; export covers in-app data only, not provider logs |
| Rectification (Art. 16) | Edit name, home city, any day's log | Email change flow not found |
| Erasure (Art. 17) | **None yet** (RPC being added). Waitlist and ended shares are never erased | Ship delete account; waitlist removal by email; purge ended shares; backups lag (say so in policy) |
| Restriction (Art. 18) | None | By email; write a manual procedure |
| Portability (Art. 20) | JSON and CSV download | Fine once care_shares are added |
| Objection (Art. 21) | Only 6(1)(f) uses (security logs) | By email |
| Withdraw consent (Art. 7(3)) | Toggles for check-ins and automatic AI; end sharing. No consent records to withdraw | Add consents and a withdrawal control |
| Automated decisions (Art. 22) | None: AI text is advisory with no legal effect | Stated in policy |
| Complain to authority (Art. 77) | Stated in policy | Name the authority per country after the representative decision |

**Response time**: one month (extendable by two). Procedure for hello@buildyourpillars.com: verify identity by reply from the account email, log the request, answer within 30 days.

---

## 5. (d) Processors and transfers

All of these are in or reach the US. EU/EEA users' data leaves the EU, so a Chapter V mechanism is needed. **[LEGAL] for all.**

| Processor | Role | Data | DPA / transfer mechanism to check |
|---|---|---|---|
| **Supabase** | Processor (database, auth, functions) | All app data | Sign Supabase's standard DPA (includes SCCs). Check Supabase's EU-US Data Privacy Framework (DPF) status. Project is in us-east-1: **consider an EU region (Frankfurt) if EU users matter**; moving later means a migration |
| **Vercel** | Processor (hosting, request logs) | IP, URL, user agent | Vercel DPA with SCCs; verify DPF listing at dataprivacyframework.gov; check log retention and whether Web Analytics is on |
| **Anthropic** | Processor for the AI call | Date, habit and mood words, goals (Art. 9) | Anthropic commercial terms and DPA; confirm retention, availability of zero data retention, DPF status, SCC coverage, and that API data is not used for training (verify in the contract actually accepted) |
| **Open-Meteo** | Probably an independent recipient of IP and coordinates | Rounded coordinates, IP, city search text | Check terms: the free API is for non-commercial use, so a paid plan may be needed; a DPA is unlikely on the free tier. Option: call it from the edge function so the user's IP is not shared |
| **BigDataCloud** | Same | Rounded coordinates, IP | Free client endpoint; check terms and DPA availability. Option: drop reverse geocoding and use the Open-Meteo place search or home city |
| **Google Fonts** | Third party receiving IP | IP | No DPA route for CDN use. Self-host the two font families |
| **Auth emails** | Supabase Auth sends confirmation and reset emails | Email address | Check which sender and SMTP provider is used and its terms |

The EU-US Data Privacy Framework (adopted July 2023) lets EU data go to certified US companies. Each vendor's certification must be checked; if not certified, use SCCs and a transfer impact assessment. **[LEGAL]**

---

## 6. (e) Gap list, ranked

Owner: **C** = code, **F** = founders, **L** = lawyer. Effort: S under half a day, M one to two days, L more.

| Rank | Gap | Why it matters | Owner | Effort |
|---|---|---|---|---|
| 1 | **No account deletion** while the site promises it (`SignupWelcome.tsx:19`, `Landing.tsx:32`, `Why.tsx:28`). Must also cover care shares and be tested end to end | Art. 17; misleading statement; app store rejection | C (in progress) | M |
| 2 | **No explicit consent (Art. 9(2)(a)) at sign-up, no consent records, no separate AI opt-in before the first call** | Health data cannot rest on contract alone | C + L (wording) | M |
| 3 | **Sign DPAs, confirm transfer mechanisms** (Supabase, Vercel, Anthropic) and decide on an EU region | Chapter V, Art. 28 | F + L | M |
| 4 | **Google Fonts from Google; Open-Meteo and BigDataCloud called from the browser** leak IP addresses to third parties | German case law; weakens "no trackers" claims | C | S (fonts), M (proxy via edge function) |
| 5 | **Privacy and Terms not routed or linked** (pages written; need route, footer links done, sign-up links) | Arts. 12-14 | C (App.tsx and AuthPage are founders' files) | S |
| 6 | **Confirm Anthropic retention, training use and region**; fix the "numbers only" claim on `Landing.tsx:33` | Accuracy of the policy; Art. 5(1)(a) | F + C | S |
| 7 | **No retention rules**: waitlist forever; ended care shares keep invitee email forever; care shares missing from export | Art. 5(1)(e), Art. 15 | C | M |
| 8 | **DPIA not done** (health data, older users, self-harm item stored) | Art. 35 | F + L | M |
| 9 | **Backup lag**: confirm Supabase backup retention and state it in the policy | Art. 17 honesty | F | S |
| 10 | **Breach plan not written** (template in section 9) | Arts. 33-34 | F | S |
| 11 | **No age check at sign-up**; policy says 16+ | Art. 8 | C + L | S |
| 12 | **Art. 27 representative** if the EU is targeted on purpose | Art. 27 | F + L | S-M |
| 13 | **Restriction and objection by email only**; no procedure | Arts. 18, 21 | F | S |
| 14 | **Edge function CORS is `*`** (`index.ts:30`); tighten to the real domains | Art. 32 hygiene | C | S |
| 15 | **Session in local storage** (library default): acceptable, but keep dependencies updated and avoid third-party scripts | Art. 32 | C | S |
| 16 | **Unverified security claims**: password hashing, encryption at rest (Supabase default), 2FA on founder accounts. Policy states none of these | Art. 32 | F | S |

---

## 7. (f) DPIA

**Advisable: yes.** The processing involves health data, a vulnerable group (adults 50 and over), new technology (AI) applied to health inputs, and a stored self-harm screening answer. Under Art. 35 and typical supervisory-authority lists, health data plus vulnerable people plus AI usually triggers a DPIA. Start before EU launch. **[LEGAL] confirm necessity.**

Outline:

1. **Description**: purposes, data (section 2), flows (1.3), retention, recipients, processors.
2. **Necessity and proportionality**: why each item is needed; minimisation already done (coordinates rounded to about 11 km; calorie goals not sent to AI; notes, location and check-in answers never sent to AI; hard days not sent to AI).
3. **Risks to people** (likelihood and severity): breach exposing mental-health data; re-identification from location plus dates; social pressure or misreading from care sharing; AI text that sounds like judgement or medical advice; PHQ-9 item 9 in storage; account takeover; under-age sign-ups; loss of access.
4. **Measures**: RLS, separate AI consent, hard-day block, filtered AI replies (`logic.ts:106-114,177-182`), read-only limited sharing, export and deletion, short retention, breach plan, DPAs, two-factor sign-in on Supabase, Vercel and Anthropic accounts **[confirm]**.
5. **Residual risk and sign-off** by the founders; if high, consult the supervisory authority (Art. 36).
6. **Review** on any feature, processor or region change, and yearly.

---

## 8. (g) EU/UK representative (Art. 27)

A controller outside the EU that falls under GDPR because it offers services to people in the EU (Art. 3(2)) must appoint an EU representative, unless processing is occasional, low risk and not large-scale special-category (health data is not low risk). The founders appear to be in Canada/US, and Germany is a target market, so **a representative is probably needed once the service is actively offered to EU users** (German-language marketing, EU store listings, euro pricing). **Confirm with counsel.** The same question arises for the UK under UK GDPR. Until decided, avoid targeting the EU in marketing and store availability. **[LEGAL] confirm.**

Other regimes not covered here: Canada (PIPEDA, Quebec Law 25), India (DPDP Act 2023), UAE (PDPL), US states (for example Washington My Health My Data Act, California). **[LEGAL]**

---

## 9. (h) Breach notification (72 hours)

Art. 33: tell the supervisory authority without undue delay and, where feasible, within **72 hours** of becoming aware, unless the breach is unlikely to risk people's rights. Art. 34: tell affected people without undue delay if the risk is high (health data breaches usually are). Processors must tell you without undue delay.

1. **Contain**: revoke leaked keys (Supabase service key, Anthropic key), force sign-out, disable the affected function or route. Note when you became aware.
2. **Assess**: what data, how many people, which countries, readable or encrypted, still exposed?
3. **Record** every breach, even minor, in a log (Art. 33(5)).
4. **Within 24 hours**: name a lead founder and decide whether notification is needed.
5. **Notify the authority within 72 hours**: nature, categories and numbers, contact point, likely effects, measures. Phased reports are allowed. Which authority applies when there is no EU establishment: **[LEGAL]**.
6. **Notify people** in plain words if high risk: what happened, what data, what to do, how to reach hello@buildyourpillars.com.
7. **Other laws**: Canada's PIPEDA requires reporting breaches with a real risk of significant harm; others as applicable **[LEGAL]**.
8. **Review** within two weeks: root cause, fix, update the DPIA.

---

## 10. (i) Children

GDPR Art. 8: consent for online services is valid from age 16 unless a member state lowers it (Germany 16; others 13 to 16). One wording that works across the target markets is "not for anyone under 16". The policy says this. Sign-up has no age check, so add a line and a checkbox ("I am 16 or older"). **[LEGAL] confirm age and wording.** The product is built for adults 50 and over (`index.html:15`).

---

## 11. (j) Record of processing activities (Art. 30) draft

Art. 30 applies to smaller organisations too when processing is not occasional or includes special-category data, as here. Keep it updated. **[LEGAL] confirm.**

**Controller**: Miah Shull Olmsted and Robert Olmsted, Build Your Pillars, hello@buildyourpillars.com. Legal entity: **to be confirmed** (the Supabase organization is Miah's personal organization). EU representative: none yet.

| Activity | Purpose | Data subjects | Data | Recipients | Transfers | Retention | Security |
|---|---|---|---|---|---|---|---|
| Account | Run the service | Users | Email, name, home city | Supabase | US | Until deletion | RLS, HTTPS, Supabase Auth |
| Health logging | Self-tracking | Users | Health (Art. 9): habits, mood, feelings, notes, location, check-in | Supabase; invitees (chosen pillars) | US | Until deletion | RLS, HTTPS |
| Weather | Context for logs | Users | Rounded coordinates, IP | Open-Meteo, BigDataCloud | Various | Provider-set | Rounded to 0.1 degree |
| AI reflection | Written reflection | Users who opt in | Art. 9 words and numbers, goals | Anthropic | US | Not stored by us; Anthropic: to confirm | Hard-day block, no identifiers sent |
| Care sharing | Let a trusted person follow | Users and invitees | Invitee email, pillar choices | Supabase | US | Until ended and deleted (proposed) | RLS, function checks |
| Waitlist | Launch notice | Visitors | Email, store choice | Supabase | US | Launch plus short period (proposed) | RLS, no browser access |
| Hosting | Deliver the site | Visitors | IP, user agent, URL | Vercel (and Google Fonts today) | US | Provider-set | HTTPS |

---

## 12. Next steps, in order

1. Ship delete-account and add care shares to the export; test the cascade.
2. Add consent at sign-up and the separate AI opt-in, with stored timestamps.
3. Self-host fonts; decide on proxying Open-Meteo and BigDataCloud.
4. Add routes `/privacy` and `/terms` (footer links already added in `PublicLayout.tsx`); link at sign-up.
5. Sign DPAs; check Anthropic retention; decide on a Supabase EU region.
6. Lawyer review of `Privacy.tsx`, `Terms.tsx`, this document and the DPIA.
7. Before launch: breach plan, representative decision, retention jobs (waitlist, ended shares).
