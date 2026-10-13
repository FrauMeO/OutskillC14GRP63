# Audit: working brief vs app (branch feat/accessible-tokens)

Read-only audit, 2026-10-12. Method: grep over src/, public/, index.html, then read in context.
Caveat: the working tree is being edited by another session while this runs (src/lib/pillars.ts already
says Drink and 'p.s. live well'; Landing.tsx line 51 changed). Line numbers are from reads made during the
audit; re-grep before editing. Code comments are not listed unless noted.

## 0. State of play (already done in the tree, uncommitted)
- src/lib/pillars.ts:15 `name: 'Drink'`, subtitle 'Water and hydration'; :26 `PILLAR_PS = 'p.s. live well'`; :25 tagline 'Build your pillars of health.' These flow into Landing, AuthShell, Dashboard, careShares names.
- Still wrong: hard-coded copies of the old names and the old tagline (sections 1 and 3).

## 1. Pillar names: Drink. Sleep. Move. Balance.
Hard-coded "Eat" / old language (user-visible):
- src/components/SharingSettings.tsx:48 `{ key: 'eat', name: 'Eat' }` -> name: 'Drink' (keep key 'eat', it maps to DB column share_eat).
- src/lib/email/templates.ts:45 `{ eat: 'Eat', sleep: 'Sleep', move: 'Move', balance: 'Balance' }` -> eat: 'Drink'. Appears in supporter digest emails.
- src/pages/Why.tsx:22 "four everyday pillars: Eat, Sleep, Move and Balance, which is our word for mental health" -> "Drink, Sleep, Move and Balance. Drink is hydration, and Balance includes mental health." (public page)
- src/pages/HealthDataPrivacy.tsx:234 "the pillars you tick (Eat, Sleep, Move, Balance)" -> "(Drink, Sleep, Move, Balance)"
- index.html:16 og:description "Eat, Sleep, Move, Balance. Gentle, private self-tracking for adults 50+ ..." -> "Drink. Sleep. Move. Balance. ..."
- index.html:18 meta description "Build your pillars of health: Eat, Sleep, Move, Balance. Live Well. p.s. judge yourself a lot less." -> "Build your pillars of health. Drink. Sleep. Move. Balance." (the old p.s. must not sit in the description; signature belongs at the end of visible pages, not metadata)
- public/manifest.webmanifest:4 "Build your pillars of health: Eat, Sleep, Move, Balance. Gentle, private self-tracking." -> Drink.
Eating / food / calories / water as pillar-ish language (user-visible):
- src/components/SignupWelcome.tsx:11 "a calm place to log eating, sleep, movement and how you feel" -> "a calm place to log drink, sleep, movement and balance".
- src/pages/Landing.tsx:51 (new, in tree) "notice your drink, sleep, movement and balance" reads oddly; suggest "notice how you are drinking, sleeping, moving and feeling" (the old text said eating).
- src/pages/Landing.tsx:15 "Note movement, steps, sleep, water, how you feel..." fine as a measure name; no change needed unless you want "hydration".
- src/pages/Privacy.tsx:144 "sleep, movement, eating, mood" -> "hydration, sleep, movement, mood".
- src/lib/goals.ts:28 label 'Water intake' -> 'Water' (appears on Goals, Dashboard GoalMetric label, TrendChart tab, sharing). 
- src/lib/goals.ts:29 label 'Calories eaten' (category 'nutrition', 500 to 10000 kcal, suggested 2000) -> remove the goal or hide it: calorie goal is diet language and is not hydration.
- src/lib/appointmentSummary.ts:44 label 'Calories eaten' (and healthMapping.ts:34 same label; healthMapping.ts:26 comment "Eat: food and water").
- src/pages/Dashboard.tsx:373 `label="Net calories (eaten minus active)"` and :447 `label: 'Net calories'` (trend tab) -> remove; diet/weight-loss framing, and sits inside the Drink card.
- src/lib/dashboard.ts:33-37 netCalories (eaten minus burned) drives the above.
- src/pages/Privacy.tsx:114 "water, calories, notes"; :165 "water, calories eaten, sleep ..."; src/pages/HealthDataPrivacy.tsx:136-137 "water, calories eaten, and any notes"; src/features/aiReflection/AiConsentDialog.tsx:66 "water, food calories you logged, exercise ... active calories" -> drop calories (after the column is dropped or hidden; the privacy text must match what is really stored).
- src/pages/LogHabits.tsx: no calories input found (the field exists in the DB/checkin type: src/lib/checkin.ts has water but calories_consumed only via import/goals). Confirm before removing the DB column.
- Order: PILLAR_ORDER is Drink, Sleep, Move, Balance everywhere via PILLAR_ORDER. Comments still say Eat in careShares.ts:92,101 and appointmentSummary.ts:91 (comments only).
Also: SharingSettings/FollowingPerson/careShares keep the flag key 'eat' (API param p_eat, DB column share_eat). Leave the key, change only the label.

## 2. Unrecorded day must be "Day off"
No user-visible string anywhere says "Day off". Every unrecorded-day string uses logged/not logged wording:
- src/pages/Dashboard.tsx:68 and :105 "Not logged" (GoalMetric and Value, per-metric, every card) -> "Day off" when the whole day is empty. When only one metric is blank on a day with other entries, the brief gives no wording; suggest an em dash with sr-only text, and ask Miah.
- src/pages/Dashboard.tsx:392 "Mood not logged today." -> "Day off today." or omit.
- src/pages/Dashboard.tsx:409 "Not logged" (energy/stress) -> same as :68.
- src/components/TrendChart.tsx:110 sr-only `not logged` -> "Day off".
- src/components/TrendChart.tsx:115 "No water logged in the last 7 days." (label lowercased, e.g. "No time in bed logged ...") -> "Day off all week so far." / "Nothing to chart yet."
- src/components/MonthCalendar.tsx:73 aria-label `... : no entry` -> "day off".
- src/components/SharedLevelView.tsx:70 sr-only "no entry" -> "day off".
- src/components/SharedLevelView.tsx:86 "A dot means no entry that day." -> "A dot means a day off."
- src/pages/LogHabits.tsx:571 aria-label `... : not logged` -> "day off".
- src/lib/careShares.ts:249 weekText 'Nothing logged' -> "Day off all week" (or "A rest week").
- src/lib/careShareLevels.ts:231 'Nothing logged in the last 7 days. That is fine: rest is part of the rhythm.' -> "Day off all of the last 7 days. Rest is part of the rhythm."
- src/pages/AppointmentSummary.tsx:178 "Nothing logged here in this time." -> "Days off in this time."
- src/lib/appointmentSummary.ts:234 `You did not log any days in the last ${periodDays} days.` -> "These last ${periodDays} days were days off." (second-person "You did not" is scolding-adjacent)
- src/lib/appointmentSummary.ts:242 "You have not logged any days in this time. Once you log some, ..." -> "These were days off. When you log some, they will show up here. ..."
- src/pages/Landing.tsx:23 "a day you did not log is just a gap, never a mark against you" -> "a day you do not log is a day off, never a mark against you." (public page)
- src/pages/Why.tsx:18 "Missed days turned into red marks." -> quotes a thing the product avoids, but the word "Missed" is banned in rule; suggest "Days off turned into red marks."
- src/components/SharedLevelView.tsx:97 "Days {name} logged each week." fine. 
- src/pages/Dashboard.tsx:291 empty state "Welcome! Let's log your first day." (see section 4 for the exclamation mark).
- Streak language: no user-visible "streak"/"broken"/"lost" found. Near-misses: "full weeks in a row" (src/lib/dashboard.ts:129 `That is ${n} full weeks in a row.`; src/components/SharedLevelView.tsx:112 `{weeksInRow} full weeks in a row.`) is a streak in disguise; consider "full weeks, ${n} so far". rhythmText 'A fresh week' / "Log whenever you are ready." is fine.
- src/pages/LogHabits.tsx:390 "Save them before opening ..., or they will be lost." is about unsaved edits, not a streak; acceptable but "or they will be lost" is pressure-ish; suggest "Save them first so they are kept."
- Not user-visible but check: src/lib/native/reminderLogic.ts:90 FORBIDDEN_WORDS (a test list) and src/lib/email/templates.ts:252 FORBIDDEN_WORDING are guard lists, fine. Add 'no entry' and 'not logged' to FORBIDDEN_WORDING.

## 3. Tagline and signature
- Tagline 'Build your pillars of health.' is correct in pillars.ts:25. Appears: Landing hero (Landing.tsx:48), AuthShell (AuthShell.tsx:16).
- Signature 'p.s. live well' (PILLAR_PS) appears: Landing.tsx:49 (directly under the tagline, then the whole page follows, so it is NOT last) and AuthShell.tsx:17 (last in the side panel).
- AuthShell side panel is `hidden ... md:flex` (AuthShell.tsx:8): on a phone the sign-in and sign-up screens show neither pillars, tagline nor signature. Fix: show a compact tagline + signature at the bottom of the form column for small screens.
- Not present at all: Why.tsx (ends with "Miah and Robert" then "In short"), PublicLayout footer (PublicLayout.tsx:62-83), Terms, Privacy, HealthDataPrivacy, Dashboard/Settings, every email template (src/lib/email/templates.ts).
- Old strings to remove: index.html:18 "Live Well. p.s. judge yourself a lot less." (see section 1). The previous PILLAR_TAGLINE 'Build your pillars of health. Live Well.' is gone from pillars.ts; confirm no snapshot test uses it.
- "Never a heading": satisfied (rendered as `<p className="italic">`).
- Suggested: render signature once, as the last element in PublicLayout footer and AuthShell, remove from the Landing hero.

## 4. Avoid list: exclamation marks, 'should', diet/weight, diagnosis, pressure, 'senior'
Exclamation marks (only one user-visible):
- src/pages/Dashboard.tsx:291 "Welcome! Let's log your first day." -> "Welcome. Log your first day whenever you like."
'should' in user-visible copy:
- src/pages/AuthPage.tsx:119 "What should we call you?" -> "What do we call you?" (sign-up screen)
- src/pages/Settings.tsx:177 "What should we call you?" -> "What do we call you?"
- src/pages/Reflect.tsx:168 "Answer the way things have actually been, not the way you think they should be." -> "...not the way you think they ought to be" is also banned; use "not a way you hope they would be."
- src/lib/privacyRequests.ts:13 hint "Tell us what is wrong and what it should say." -> "Tell us what is wrong and what it needs to say." (check this is not a rule-banned "need to")
- src/lib/authErrors.ts:28 is a regex on a Supabase message, not shown.
Diet/weight: no weight-loss copy found in UI. Calories and "Net calories" are the only diet-adjacent items (section 1). replySafety.ts diet words are a safety filter, correct.
Diagnosis: no diagnosing claims. PublicLayout.tsx:63, Terms.tsx:40, appointmentSummary.ts:253 say "does not diagnose", which is fine. src/lib/reflection.ts:17-21 lists PHQ-9-style items ("Poor appetite or overeating", "a failure or have let yourself or your family down"); these are questionnaire items shown in /reflect; CLAUDE.md already covers it, flag only for review against "no diagnostic language".
Pressure: Dashboard.tsx rhythm text "One more day makes a full week" (src/lib/dashboard.ts:45 `... more days make a full week, whenever it suits you.`) is progress-counting but softened; acceptable. Dashboard "Set a goal" link fine.
'senior': zero hits in src, index.html, public. Brief wording "elder"/"older person": code uses "older person" (Landing.tsx:152, Terms.tsx:58); fine.
Adults 50: Landing.tsx:73 "Adults 50 and over" and index.html:16 "adults 50+" conflict with free-at-60 framing (not a brief rule, but confirm the audience age).

## 5. Relationships: "went together", not "caused"
- Compliant: src/lib/insights/overview.ts:146 NOT_CAUSE "It shows what went together, not what caused what."; src/pages/Insights.tsx:103, :134, :199 use "gone together", "caused"/"causes" only in negation.
- Landing.tsx:19 "what tends to go along with what" -> acceptable; optional "what tends to go together".
- No lowers/raises/causes in generated strings (src/lib/insights/engine.ts uses up/down measure labels only). No violations.

## 6. Sign-up fields (src/pages/AuthPage.tsx, SignupWelcome.tsx, BirthPrompt.tsx)
Collected on sign-up (AuthPage.tsx:117-260, metadata at :82-97):
1. Display name: one name only, no spaces, max 40 (lines 118-132; validateDisplayName in src/lib/signup.ts:19). OK.
2. Birth month + birth year, two selects (AuthPage.tsx:135-171). Stored as birth_month, birth_year strings. No day. OK.
3. Home city, optional (AuthPage.tsx:174-192).
4. Email and password (194-220).
5. Two consent checkboxes: required health-data consent, optional marketing (221-260).
Also on the sign-up screen: WaitlistForm (AuthPage.tsx:329-331) which collects an email for the native-app waitlist; a second email box beside the sign-up email may confuse. Consider hiding it on /signup.
BirthPrompt.tsx: month + year only (lines 54-82), for older accounts. OK. Min age 18 (signup.ts:8) with message `Build Your Pillars is for people 18 and older.` (:50).
Divergence from brief: the brief says collect month/year only "when age eligibility is needed"; the app always asks at sign-up (needed for the free-at-60 plan, so defensible). Name is called "full_name" in metadata (AuthPage.tsx:83) though it is a single nickname.
Copy ok: AuthPage.tsx:169, Landing.tsx:156, BirthPrompt.tsx:57 all say month and year, never the day.
Remaining note: AuthPage.tsx:106 notice and Terms.tsx:52 claims fine.

## 7. Pricing facts
- src/lib/billing.ts:6 `$2.99 a month`; :7 `$34.99 a year`; :111 'Free for everyone 60 and over' (FREE_AGE = 60 in signup.ts:9). Consistent with brief.
- CaregiverPlanCard.tsx via billing.ts:88: "You can follow ${who} with a caregiver plan, $34.99 a year. ${who} has already said yes." Permission is stated; the CTA only shows if enforced. Consistent.
- Landing.tsx:141-154, Terms.tsx:57-58 same numbers. No conflicts found.
- Landing.tsx:148 "For everyone under 60. Free while we are in beta." and billing.ts:15 are consistent.
- Mismatch to note: HealthDataPrivacy.tsx:243 "We have no payments yet. If we add paid plans, a payment company (Stripe) will receive..." is stale given pricing is published; update to match billing.md.
- Landing "Who it is for": "Adults 50 and over" (Landing.tsx:73) vs free for 60+; clarify.

## 8. Founder attribution and no "team hackathon"
- src/lib/about.ts:1 FOUNDERS = ['Miah Shull Olmsted', 'Robert Olmsted']: brief says Robert 'Bob' Olmsted (72) and Miah Shull Olmsted (60); the name 'Bob' never appears, and order is Miah first. Used by Why.tsx:10 ("By Miah Shull Olmsted and Robert Olmsted") and Settings.tsx:364 ("Founders: ...").
- src/pages/Why.tsx:14 "Robert is 72 and Miah is 60" hard-coded ages (will go stale; brief gave the ages, so acceptable once) and Why.tsx:35 sign-off "Miah and Robert".
- src/pages/Terms.tsx:82 "We are a small team." -> "We are two people." (the brief says only the two founders).
- Hackathon/team/Cynthia hits (none user-visible, all comments or non-bundled):
  - README.md:7 "It began as a hackathon entry in September 2026 (Outskill C14, Group 63)." -> rewrite or remove (public repo).
  - src/pages/Dashboard.tsx:359 comment "TEMPORARY (hackathon): AI reflection"; src/features/aiReflection/AiReflectionCard.tsx:1; src/features/aiReflection/fingerprint.ts:1; src/vite-env.d.ts:6; src/lib/insights/overview.ts:3 and src/pages/Insights.tsx:50 ("Suggested by Michael (team feedback)"); the repo is called OutskillC14GRP63.
  - package.json name/other: no 'hackathon' hit in index.html or public/.
- 'Cynthia': zero hits in src, public, index.html.
- src/lib/about.ts:4 ABOUT_STORY is clean.

## 9. Color as the only identifier
Reasonably good; pillar cards all carry text titles. Cases to fix or confirm:
1. Error vs success messages differ only by text-alert vs text-current (no icon or prefix): src/components/SharingSettings.tsx:105, EmailPreferences.tsx:65, PrivacyCenter.tsx:36, Goals.tsx:149 and LogHabits.tsx:378 (`bg-alert/10 text-alert` vs `bg-current/10 text-current`), Settings.tsx:195,216,245,288,321, Following.tsx:44. Add a prefix such as "Could not save:" in text, or an icon (check mark / warning).
2. src/pages/Goals.tsx:211 `border-ember/40 bg-ember/10` replace-goal alertdialog: has role and a question heading; ok but color-only emphasis.
3. src/components/BirthPrompt.tsx:82, CaregiverPlanCard.tsx:42, Plan.tsx:93 errors `text-ember` with role="alert": text carries the meaning; fine, but same color as the Move pillar, so a Move colour is also the error colour (rename token or use text-alert).
4. src/pages/Goals.tsx:252 `<span className={'absolute ... w-1.5 ' + gcfg.accent} aria-hidden />` accent stripes use bg-ember / bg-dusk / bg-current / bg-sprout (goals.ts:23-29); the card also shows the goal label, so OK. Two Drink goals use different stripes (bg-current for water, bg-sprout for calories) with no distinction beyond the label.
5. src/pages/Insights.tsx:33 `border-current/40` solid vs dashed `border-line` for likely vs not-likely: has a dashed/solid difference plus text (check there is a label), borderline.
6. src/pages/Insights.tsx:236 progress bar `bg-current`: has the "x of y days logged" heading; ok.
7. src/pages/Dashboard.tsx:12-18 COLORS water vs nutrition: water uses var(--color-current), the pillar uses sprout; the line chart (TrendChart.tsx:91,100) and progress ring color are the only visual difference; each has a text label and %. OK.
8. src/components/SharedLevelView.tsx:17-22,63 bars coloured by pillar with heading text; ok. The "·" for empty days is a distinct symbol. OK.
9. src/components/MonthCalendar.tsx:83-89 uses ★ and ✓ plus colour: fine.
10. src/pages/Landing.tsx:86 pillar cards use a coloured top border (borderTopColor) plus the h3 name; fine.
Net: no pillar is identified by colour alone. The real gap is #1 (state: error versus success).

## 10. Tests that will need updating
- src/lib/careShares.test.ts:155 expects 'Nothing logged'.
- src/lib/appointmentSummary.test.ts:251 `fewDaysNote(0)` toContain 'not logged any days'.
- src/lib/careShareLevels.test.ts:192 asserts text not matching /miss|skipp|no entry|lost|streak/i (keep; extend).
- src/lib/healthMapping.test.ts:11 `PILLARS.nutrition.subtitle` toMatch /water/i (current subtitle 'Water and hydration' passes; 'Hydration' alone would fail).
- Tests referencing pillar key 'eat' (careShareLevels.test.ts:132,142,144; email/templates.test.ts:32) stay valid if the key is kept; a new test should assert the email label is 'Drink'.
- src/lib/about.test.ts:17-19 hackathon wording guard: keep.
- src/lib/email/templates.test.ts and any PILLAR_TAGLINE snapshot: check after changing copy.
- Add: a test that no src/** user-visible string contains 'Eat', 'Calories eaten', 'Water intake', ' !'.

## Top 10 for the next two hours (public-facing first)
1. index.html:16,18 and public/manifest.webmanifest:4: replace Eat and remove the old "Live Well. p.s. judge yourself a lot less." (this is what search and share previews show).
2. src/pages/Why.tsx:22 (Eat -> Drink; "Balance includes mental health") and :18 ("Missed days"); add founder/'Bob' decision to about.ts.
3. src/pages/Landing.tsx: line 23 (gap -> day off), line 51 (rewrite), move the p.s. to the end of the page (PublicLayout footer), review :73 audience age.
4. src/components/AuthShell.tsx + AuthPage.tsx:119 + SignupWelcome.tsx:11: show tagline and signature on mobile, "What do we call you?", "drink" instead of "eating".
5. src/pages/Dashboard.tsx: :291 exclamation mark, :68/:105/:392/:409 "Not logged" -> "Day off", and remove "Net calories" (:373, :447).
6. src/lib/goals.ts:28-29: 'Water intake' -> 'Water'; retire 'Calories eaten' (also appointmentSummary.ts:44, healthMapping.ts:34, dashboard.ts netCalories).
7. src/pages/Settings.tsx:177 ("should") and :364 founders line; src/pages/Terms.tsx:82 "small team".
8. Shared-state strings: careShares.ts:249, careShareLevels.ts:231, TrendChart.tsx:110,115, MonthCalendar.tsx:73, SharedLevelView.tsx:70,86, LogHabits.tsx:571, AppointmentSummary.tsx:178, appointmentSummary.ts:234,242; then update the three tests in section 10.
9. SharingSettings.tsx:48 and email/templates.ts:45: pillar label 'Eat' -> 'Drink' (supporter-facing, and in emails).
10. Privacy.tsx:114,144,165, HealthDataPrivacy.tsx:136,234,243 and AiConsentDialog.tsx:66: remove calories/eating wording so legal text matches the product; README.md:7 remove the hackathon sentence.
