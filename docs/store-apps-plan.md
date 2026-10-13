# Store apps plan: Apple App Store and Google Play

Researched 2026-10-12. Sources are Apple, Google and Capacitor pages fetched today, plus npm/GitHub metadata. Anything from a blog or from my own estimate is marked **unverified** or **estimate**. Day counts are estimates, not sourced.

## 0. Bottom line

- Recommend **Capacitor 8 wrapper with real native features** (route a). Do not submit a bare wrapper.
- Apple's fastest route is not a different technology. It is (1) enrol as an **individual** now (no D-U-N-S wait), (2) submit a build that has real native features, and (3) have the compliance items in section 2 done before first submission.
- **Biggest finding: Google Play says health apps must register as an Organization.** (Section 3.) Check this before paying the $25 or starting testing.
- **Gaps in the app today (from the code):** no in-app account deletion (Settings only deletes reflection history; `src/pages/Settings.tsx`), and I found no privacy-policy page in `src/pages`. Both block approval. Reflections send data to Claude (Anthropic); Apple's 5.1.2(i) requires explicit disclosure and permission for sharing personal data with third-party AI.

## 1. Routes compared

| Route | Effort (estimate) | 4.2 rejection risk | Verdict |
|---|---|---|---|
| (a) Capacitor wrapper + HealthKit / Health Connect | 8-15 working days to a submittable build (setup, safe areas, auth redirect, HealthKit read of sleep/steps/water/exercise, Android permission UI, icons, delete-account, privacy page) | Low-moderate if HealthKit sync, local notifications and in-app delete are real and demonstrable. High if it is just the website in a frame | **Recommended** |
| (b) PWA only | 1-2 days | n/a for stores. Not in either store | Interim only. Cannot read HealthKit at all. Android Play can list a PWA only via TWA, which still needs the Play account steps |
| (c) React Native or native rewrite | 40-80+ days (estimate) | Lowest | Not justified. The risk (a) removes is 4.2, and native features fix that |

**Guideline 4.2 (primary text):** "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." (https://developer.apple.com/app-store/review/guidelines/). Also 4.2.2: apps "shouldn't primarily be marketing materials ... web clippings ... or a collection of links."

**Native features that credibly satisfy 4.2** (my judgement, not an Apple list): HealthKit read of sleep, steps, exercise and water pre-filling the daily log (the app's own `docs/health-mapping.md` already maps these); local reminder notifications; haptics; offline access; biometric lock. HealthKit is the strongest because it is the thing the web cannot do.

### Plugins (checked via npm registry and GitHub API, 2026-10-12)

| Plugin | Version / last release | Licence | Capacitor | Notes |
|---|---|---|---|---|
| `@capgo/capacitor-health` (Cap-go) | 8.11.10, released 2026-10-12 (daily releases) | **MPL-2.0** | `@capacitor/core >=8.0.0` | iOS HealthKit + Android Health Connect in one API. README lists `sleep`, `steps`, `exerciseTime` (iOS only), `dietaryWater`, `mindfulness`, `workouts`. 1 open issue. Open request #87 to add State of Mind (iOS 18+), so **mood is not supported yet**. Vendor-backed (Capgo sells services), so check the commercial angle. MPL-2.0 is file-level copyleft: fine to use unmodified |
| `capacitor-health` (mley) | 8.4.0, 2026-09-23 | MIT | `>=8.0.0` | Active. 6 open issues. Documented types are steps, workouts, nutrition, body composition, mindfulness. **No documented sleep or water** in README grep, one open request for sleep (#8, June 2026). Weaker fit |
| `@perfood/capacitor-healthkit` | 1.3.2, 2025-02-13 | none declared | `^4.0.0` peer | **Stale.** Capacitor 4 era, 13 open issues. Do not use |
| `capacitor-health-connect` (ubie-oss) | 0.7.0, 2024-08-29 | Apache-2.0 | `^5.0.0` peer | **Stale.** Do not use |

Capacitor itself: v8 is current ("Active, released December 8, 2025"); v7 extended support ends 2026-12-08. v8 needs Node 22, Xcode 26.0, Android Studio 2025.2.1; min iOS 15, min Android 7 (API 24). (https://capacitorjs.com/docs/main/reference/support-policy). npm shows `@capacitor/core` 8.5.3 today.

Known problems: Health Connect needs min SDK 26 and the plugin README says a user-facing rationale and privacy-policy screen are mandatory. Neither plugin was tested by me on a device. Mood/energy/stress and PHQ-9 stay app-only on Android (per your health-mapping doc), and on iOS the plugin does not read State of Mind yet (#87 open).

## 2. Apple requirements for this app

**Enrolment.** US$99/year; individual or organisation. Individual: your legal name is the seller, no D-U-N-S, "Sole proprietors and single-person businesses enroll as individuals"; use your own card, otherwise delays and possible government photo ID. Organisation: legal entity only (no DBA), binding authority, work email on the domain, "publicly available, functional website"; D-U-N-S required and Apple verifies it and your authority; organisations "can purchase only after Apple Developer Support verifies the enrollment". D-U-N-S is free: "up to 5 business days" to receive, then "up to 2 business days" before Apple sees it (https://developer.apple.com/help/account/membership/program-enrollment/ and .../D-U-N-S). Apple publishes no overall approval time; only "if you don't receive a membership confirmation within 24 hours [of purchase], contact Apple Developer Support".

**Individual vs organisation trade-off.** Individual is fastest, but the seller name shown in the store is Miah's or Robert's legal name, and moving an app to an organisation later is possible but is extra work (unverified for this app; check Apple's app transfer docs). If Create(HER)Media / Impact Arts is a legal entity, organisation costs about a week for D-U-N-S.

**Guidelines that bite (all quoted from https://developer.apple.com/app-store/review/guidelines/, "Last Updated: June 8, 2026"):**
- **5.1.1(i):** privacy policy link in the App Store Connect field "and within the app in an easily accessible manner". Required.
- **5.1.1(v):** "If your app supports account creation, you must also offer account deletion within the app." Apple's FAQ: delete "the entire account record, along with associated personal data"; deactivation alone is insufficient; do not require phone/email/chat support; manual processing with a stated timeline is acceptable (https://developer.apple.com/support/offering-account-deletion-in-your-app/). **Not built today.**
- **5.1.1(ii)/(iii):** consent for data collection; only request data relevant to core function. Ask for only the HealthKit types you use.
- **5.1.2(i):** "You must clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so." (added in the November 2025 revision per Apple news). The Settings text already says only feelings, not name/email/location/notes, go to Claude. Add an explicit opt-in before the first reflection, and name Anthropic in the privacy policy and review notes.
- **5.1.3 Health:** no use of HealthKit or health data for "advertising, marketing, or other use-based data mining"; must not "write false or inaccurate data into HealthKit"; "may not store personal health information in iCloud".
- **1.4.1:** medical apps "that could provide inaccurate data ... or that could be used for diagnosing or treating patients may be reviewed with greater scrutiny"; "Apps should remind users to check with a doctor". Put a clear "not medical advice, not a diagnosis" line next to the check-in and Reflections.
- **PHQ-9 / mental-health assessments and AI content:** I found **no Apple guideline that specifically names mental-health screening or generative-AI content** in the text I could read (the page text I fetched was complete only through 5.3.4 plus 5.4-5.6 and the footer; sections between were not fully read). Treat PHQ-9 as 1.4.1 territory. Practical mitigations (my advice, unverified as Apple expectation): do not label results as a diagnosis, show a crisis line (988 US, 9-8-8 Canada) when the item-9 answer is non-zero, keep the check-in optional, and say in review notes it is "informational, optional, not a medical device".
- **4.8 Sign in with Apple:** applies only if you use a third-party/social login. Email+password through your own Supabase auth is exempt ("exclusively use your company's own account setup and sign-in systems"). Do not add Google login without adding Sign in with Apple.
- **2.1(a):** "include demo account info (and turn on your back-end service!)". Supply a pre-populated demo login.
- **Regulated medical device status:** since March 2026, apps with Health & Fitness or Medical as primary/secondary category must declare status in App Store Connect; new apps now, existing apps by early 2027. Select **No** if not a regulated device (https://developer.apple.com/news/?id=nyqbfz1y, summarised by search; the full news page was not read).
- **Privacy labels:** declare Health and Fitness data if it leaves the device ("Collection means transmitting data off the device"). Your Supabase storage means yes, linked to the user, purpose App Functionality; not used for tracking. Privacy Policy URL required (https://developer.apple.com/app-store/app-privacy-details/).
- **HealthKit entitlement and strings:** add the HealthKit capability in Xcode; `NSHealthShareUsageDescription` (read) and `NSHealthUpdateUsageDescription` (write, only if you write). The Apple page itself would not load for me, so entitlement name `com.apple.developer.healthkit` and the plist keys come from the Capgo README (plugin docs, secondary) and general knowledge. **Verify in Xcode.** HealthKit sends nothing off-device by itself; you decide what to upload.
- **Age rating:** answer the App Store Connect questionnaire. Apple has changed it repeatedly in 2026 (new social-media question required from September 2026; Australia 15+ removed). If you mark "frequent medical or treatment information", it also triggers the medical-device declaration. Likely result is 4+ to 12+, but I cannot confirm the outcome without running the questionnaire. Do not pick "Made for Kids".
- **Build requirement:** since 2026-04-28 uploads must use the iOS 26 SDK; from April 2027 the iOS 27 SDK. Capacitor 8 on Xcode 26 meets the current one.

**Common first-submission rejections for health apps** (drawn from the guideline text above, not from a statistics source): missing/unreachable privacy policy; no in-app account deletion; demo account missing or back end down; HealthKit usage string vague or requesting types not used (5.1.1(iii)); 4.2 "just a website"; health claims without disclaimers (1.4.1); undisclosed third-party AI data sharing; metadata not matching functionality. Anecdotes on frequency are unverified.

## 3. Google Play

- **Account type: organisation is required for health apps.** Primary text: choose an Organization account if you provide "Health apps, such as Medical apps and Human Subjects Research apps" (https://support.google.com/googleplay/android-developer/answer/13634885). Google's policy page says all four named categories (financial, health, VPN, government) must register as Organization. Whether a **wellness tracker** counts as a "health app" in that sense is not explicit: Google's own categories (https://support.google.com/googleplay/android-developer/answer/13996367) put "fitness, nutrition, wellness, and sleep" and stress management under health and fitness, and Medical under providers like HIPAA-covered entities. The PHQ-9 feature leans medical. **Ask Play Console support before committing to a personal account.** A personal account later converted to organisation requires a new payment profile; organisation to personal is not possible.
- **Organisation needs a D-U-N-S**, free from Dun & Bradstreet. Google says it "can take up to 30 days so you should plan ahead" (https://support.google.com/googleplay/android-developer/answer/13628312); Apple's page says up to 5 business days. Also needs organisation phone, website, and an ID document from a representative.
- **Fee:** US$25 one-time is my recollection; no fetched Google page confirmed it today. **Unverified.**
- **Personal-account closed-testing rule (current):** "a minimum of 12 testers" opted in "continuously for at least 14 days", then "Apply for production" (https://support.google.com/googleplay/android-developer/answer/14151465). The page scopes this to "personal developer accounts created after November 13, 2023" and does not mention organisations. Google review of the production application "usually takes seven days or less, but can occasionally take longer". An organisation account therefore likely avoids it (inferred, not stated).
- **Target API:** "Android 16 (API level 36) ... required for new apps and app updates from August 31, 2026" (extension possible to Nov 1, 2026). Capacitor 8's default target SDK should be checked in `android/variables.gradle` after `cap add android`; bump it if below 36 (https://support.google.com/googleplay/android-developer/answer/11926878).
- **Android developer verification:** Play Console pages say all Play package names must be registered by **September 30, 2026** and unregistered apps are removed (via search summary of Google's pages; not fully read). New package names are registered in Play Console after identity verification. Do this at sign-up.
- **Health Connect:** declare the exact data types in Play Console, matching the manifest permissions, with "a clear and detailed justification" for each; minimum data types only; privacy policy on the store page must be the same one shown in Health Connect; the app must handle `ACTION_SHOW_PERMISSIONS_RATIONALE` / `VIEW_PERMISSION_USAGE`; Health Connect reads only the 30 days before permission by default (https://developer.android.com/health-and-fitness/health-connect/get-started and .../publish). Google does not publish a review time for the declaration. A search summary said "up to several weeks" and I could not confirm it on the page: **unverified**.
- **Health apps declaration:** required for every published app: Play Console, Policy, App content, Health apps. Features to declare would be Activity and Fitness, Sleep Management, Stress Management, and probably Mental and Behavioral Health for the PHQ-based check-in. Non-medical-device apps need a description disclaimer: "not a medical device and does not diagnose, treat, cure, or prevent any medical condition" (https://support.google.com/googleplay/android-developer/answer/14738291 and .../16679511).
- **Data safety form:** required; privacy policy required to complete it; declare Health info and Fitness info; provide a way for users to request data deletion (https://support.google.com/googleplay/android-developer/answer/10787469). Google's AI-generated-content policy was not read: **unverified**.

## 4. Timeline from 2026-10-12

Published figures:
- Apple: App Review "typically review[s] at least 50% of submissions in less than 24 hours and 90% in less than 48 hours" (https://developer.apple.com/distribute/app-review/). Incomplete submissions are delayed.
- Google: new personal accounts need 14 days of closed testing with 12 testers; production review "seven days or less, but can occasionally take longer"; "up to seven days or longer in exceptional cases" for some accounts (https://support.google.com/googleplay/android-developer/answer/6334282).
- D-U-N-S: Apple up to 5 + 2 business days; Google says up to 30 days.

| Step | Apple best / likely | Google best / likely |
|---|---|---|
| Account approved | Individual: same day to 2 days / 2-5 days (estimate; Apple gives no figure). Organisation: add ~1-2 weeks D-U-N-S | Organisation: 1-2 weeks / 3-5 weeks incl. D-U-N-S and ID check (estimate) |
| First build | 10 working days / 3 weeks (estimate, includes delete-account, privacy page, HealthKit) | same codebase, +3 days / +1 week |
| Internal test | TestFlight internal builds: usually minutes to hours after processing (unverified); external TestFlight beta needs Beta App Review | Internal track: immediate. Closed test: 14 days if personal; none if organisation (inferred) |
| Store review | 1-2 days / one rejection round, +3-7 days | 1 week / 1-3 weeks incl. Health Connect declaration (anecdotal) |
| **Submit to live** | **~3.5 weeks (late Nov) / ~6-8 weeks (early Dec to mid Dec)** | **~4 weeks / ~8-10 weeks** |

Anecdotal numbers (my estimates and typical forum experience) are in the "likely" columns. Do not promise dates to users. Apple is not slower in practice for individual enrolment, but one rejection round is the most likely single delay.

## 5. This week: founders' checklist (non-engineering)

**Decisions**
1. Legal seller: individual or entity? Which entity (Impact Arts / Create(HER)Media / other)? Same answer must work for Apple and Google. If entity: look up or request the **D-U-N-S** at https://developer.apple.com/enroll/duns-lookup/ today (free).
2. Ask Google Play support (or the Play Console help form) whether a wellness tracker with PHQ-style check-in must use an organisation account. Keep the reply.
3. Pick the final bundle ID / package name (e.g. `com.buildyourpillars.app`) now. It cannot change later.

**Sign-ups**
4. Apple Developer Program (US$99). Apple Account with two-factor on; legal name exactly as on ID; your own card.
5. Google Play Console. Fee and organisation details per section 3. Register the package name for Android developer verification.
6. Crisis-resource and support contact: a monitored support email.

**Assets to prepare**
7. **Privacy policy URL** on buildyourpillars.com (plain English, matching the app): what health data, Supabase storage, Claude/Anthropic reflection sharing, retention, deletion, contact. Same URL for both stores and the Health Connect screen.
8. **Support URL** (page or mailto landing) and marketing URL.
9. **Icon:** 1024x1024 PNG, no transparency (the repo has `public/byp-app-icon-1024.png`).
10. **Screenshots:** Apple needs iPhone 6.9-inch (1320x2868 or 1290x2796) and iPad if the app supports iPad; 1-10 per size. These sizes came from a model recollection because the Apple page 404'd for me: **verify in App Store Connect**. Google: phone screenshots and a 1024x500 feature graphic (unverified; check Play Console).
11. Short and long description, subtitle, keywords, "What's new". Include the disclaimer: not a medical device, does not diagnose; talk to a doctor.
12. **Demo account for reviewers:** a dedicated email + password with a few weeks of sample data, working with the back end switched on. The repo already has demo seed scripts (`npm run sample:seed`). Do not use Miah's real data.
13. **Review notes text** (paste into App Store Connect and Play): "Build Your Pillars is a private daily tracker for adults 50+ (water, sleep, movement, mood). Demo login: [email / password]. HealthKit / Health Connect are used only to pre-fill sleep, steps, exercise and water, read-only, on request. Optional 'gentle check-in' is a reflection prompt based on PHQ questions (confirm the PHQ licence wording before submission), offered only after a trend of check-ins, is not a diagnosis, shows crisis resources, and is not a medical device. Optional daily reflection sends only feelings and ratings (no name, email, location or notes) to Anthropic's Claude after the user opts in; nothing is saved by Anthropic per our API terms [verify]. Account deletion: Settings > Delete my account."
14. Answer in advance: age rating questionnaire, privacy nutrition label (Health + Fitness, linked, not tracking), Google Data safety and Health apps declaration, regulated-medical-device status = No.

**Engineering prerequisites to hand to the build team (not founder tasks):** in-app **delete account** (auth + data), privacy page route, opt-in screen before the first Claude reflection, `capacitor.config`, HealthKit capability, API level 36.

Note: CLAUDE.md says the interface never uses the word "screening". Keep that in store listings and review notes too; say "gentle check-in" and "reflection".

## Source gaps (could not verify)
- Apple guideline text between 5.3.4 and 5.4 was cut off by the fetch tool; no Apple rule on PHQ-9 or generative AI content found in the portions read.
- Apple screenshot and age-rating tier pages returned 404 or no detail.
- Play registration fee, Play Console screenshot specs, Google AI-generated content policy, Health Connect declaration review duration: not confirmed from a Google primary page.
- Plugins not tested on a device.
