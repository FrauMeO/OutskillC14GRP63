# Development log

A record of how Personal Health Manager was built in Claude Code: what was decided, by whom,
and why. Read it with `CLAUDE.md` (especially **Product principles**), `docs/handover.md`,
`docs/schema-log.md` and the stage reports in `docs/reports/`. Newest sessions go at the end.

---

## Session 1: 2026-09-25 to 2026-09-26 (Miah with Claude Code)

### Purpose, in Miah's words

> "This entire app is an alternative to self-judging and is meant to act as a counter to the
> world of social media-induced hyperfixation on narrow ideals of health, wellness, and beauty."
> "Keep building gentle awareness and reflection throughout."

This became the **Product principles** section of `CLAUDE.md` on 2026-09-26. Every later
decision below should be read in that light.

### 1. Moving from the Claude chat to Claude Code
- Cloned `FrauMeO/OutskillC14GRP63` into `~/Projects`, copied the handover package in (hidden
  files included, the old README and LICENSE kept, the `1 - Set Up` helper and macOS `Icon`
  files left out), checked that no `.env` was included, then committed and pushed after Miah said yes.
- GitHub sign-in used the GitHub CLI device flow. Miah authorized it herself in her browser.
- **Rule kept throughout:** Claude never types passwords. When Miah pasted her Supabase password
  in chat, Claude did not use it and suggested changing it.

### 2. Supabase: moving off the Impact Arts account
- The handover project (`dfjkeuqycklxnvitmjby`) sat in the Impact Arts organization
  (FacilityRecordsHolding). Miah: "I don't want this owned by Impact Arts."
- It held no user data, so instead of a transfer, Miah created a fresh project in her personal
  organization OlmstedDataPlayground: **`gzsawayrorlcjmpssalc`**.
- Miah applied migrations 0001 and 0002 by hand in the SQL editor (Claude's own attempt to do it
  through the browser was blocked by a safety check). Claude verified the result.
- The Supabase connector was re-authorized for the personal organization. `.env.local` points at
  the new project; the old project is to be deleted by Miah.
- Migration 0003 revoked public execute on Supabase's `rls_auto_enable` helper (advisor warnings).
- Login settings: Site URL and redirect URL `http://localhost:5173`, email confirmation kept on.
  Leaked password protection: Miah turned it on; the advisor still reported it off at last check.

### 3. Demo account and sample data
- Supabase rejects `.test` email addresses, so the demo account is `msolmsted+demo@gmail.com`,
  confirmed through the normal email link.
- The 59-day sample (Philadelphia with a Seattle trip) was loaded from the Apple Health importer.

### 4. Rewriting the prompts before building
- Miah asked Claude to improve Prompt 4 for this codebase before acting on it. Claude kept the
  existing schema policy, named the real project and files, and added a checkpoint.
- Miah then supplied a new **Prompt 3** (mood logging, weather with insights, gentle check-in).
  Decisions: build Prompt 3 first; split it into stages 3A, 3B, 3C; one approval checkpoint per
  stage; keep a Log Habits form for exercise, sleep, water and notes; reverse geocoding by
  BigDataCloud; keep multiple feelings alongside the three 1 to 5 ratings.
- Revised texts live in `docs/prompts/`.

### 5. Feelings: from reactions to reflection (3A)
- First set (from the old Prompt 3): angry, sad, stable, happy, energized. Miah: the words should
  be synonyms of the faces, not duplicates of the Mood words.
- Miah asked what current writing uses. Claude found that recent practice starts from pleasantness
  and energy (the Mood Meter, Apple Health's State of Mind) rather than Ekman's six basic
  emotions. Miah: Ekman's set is "reactionary, not reflective".
- Miah asked to match Apple Health's labels and add a positive sixth, **Grateful**. Final set,
  all exact `HKStateOfMind.Label` names (checked against Apple's header), migration 0005:
  **Frustrated 😤, Overwhelmed 😩, Calm 🙂, Peaceful 😌, Confident 😎, Grateful 🥰.**
- Repeats of a feeling are blocked in the database so counts stay honest.

### 6. Location and weather (3A)
- Location is stored per day, rounded to about 11 km, because weather must match where the
  person was. Device location is used only when logging today; otherwise the day's saved place,
  then the home city. Saving is never blocked. The form shows the day's location (Miah's request).
- Weather and air quality come from Open-Meteo (free, non-commercial) and are fetched once per
  day and place; today's forecast is replaced once after the day ends.
- Real historical weather for the sample dates is committed as a fixture so tests run offline.

### 7. Insights (3B)
- Spearman and Mann-Whitney tests with Benjamini-Hochberg correction across 96 comparisons.
  "Likely patterns" and "Worth exploring" (clearly labelled as early hints).
- A planted pattern (lower mood on days with over 2 mm of rain) is found as Likely; the moon (a
  negative control) is never Likely; with mood shuffled 200 times, false Likely patterns appear in
  about 1% of runs.
- Wording describes association, never cause, and always gives the number of days. Early wording
  such as "more high temperature" was rewritten into natural phrases.
- Recorded honestly: the planted pattern passes with adjusted p 0.061 (limit 0.10). When a later
  change briefly pushed it to 0.148, the sample was restored rather than the threshold loosened.

### 8. Dashboard (Prompt 4)
- Five cards (Exercise, Sleep, Nutrition, Wellbeing, Notes), four 7-day charts, a logging streak.
- Progress shows value, goal and percentage as text and as a ring (Apple Health days) or bar
  (manual days). No goal means "Set a goal", never an empty ring or a default target.
- The streak counts logging only, never meeting goals. Missing days are gaps, not zeros.
- Sample dates stay fixed (Insights tests depend on them). A data snapshot was pushed to
  `sample-data/snapshots/2026-09-25-demo/` before migration 0006.
- Pull request FrauMeO/OutskillC14GRP63#1 brings 3A, 3B and 4 into `main`.

### 9. Gentle check-in (3C): language and resources
- **Why 3C paused:** at its checkpoint Claude asked for approval of the resources and the
  migration; Miah's next message moved on to Prompt 4, so Claude did not treat it as approval.
- **Thresholds (Miah):** keep a total above 6 as a cautious early prompt. Above 6: one resource.
  Above 10: a different resource. Above 15: the national line and two resources, with a gentle
  suggestion to call their doctor. Item 9 above 0: crisis resources first, whatever the total.
- **Countries (Miah):** launch in the US, Canada, India, the UAE and Germany, so resources follow
  the home country with a simple structure instead of US-only lines:

  | Score | Shown |
  |---|---|
  | 7 to 10 | findahelpline.com (the person's country page) |
  | 11 to 15 | the country's national support line |
  | 16 or more | national line, findahelpline.com, emergency number, gentle suggestion to see their doctor |
  | Item 9 above 0 | first: national line (24/7 where available) and emergency number |

  National lines: US and Canada 988 (emergency 911); India Tele-MANAS 14416 (112); Germany
  TelefonSeelsorge 0800 111 0 111 or 0800 111 0 222 (112); UAE 800 HOPE, 8 am to 8 pm only
  (999 police, 998 ambulance, so the UAE item-9 screen leads with those at night).
  Anywhere else: findahelpline.com.
- **Talking to a friend (Miah):** from a total of 7 up, the wording gently encourages talking with
  a friend or family member too, more directly as scores rise.
- **Words (Miah):** use "harder", not "heavier" (it may not translate well). The 11 to 15 message
  says a support line also offers confidentiality and no judgment. Never use the word
  "screening"; frame it as reflection: *"This is encouragement to reflect a little more deeply
  today. It is not medical advice."*
- Approved wording (2026-09-26):
  - **7 to 10:** "Thank you for taking a moment for yourself. Your answers suggest the last two
    weeks may have felt harder than usual. It can help to talk with someone you trust, like a
    friend or family member, about how you've been feeling. If you'd like more support, here's a
    place to start."
  - **11 to 15:** "Thank you for being honest with yourself. It sounds like things have been hard
    lately, and you don't have to carry that alone. Consider reaching out to a friend or someone
    close to you today, even just to say you've been having a tough time. A support line can also
    listen, confidentially and without judgment, any time you need it."
  - **16 or more:** "Thank you for sharing this. It sounds like you've been going through a lot.
    Please consider talking with your doctor soon, and letting a friend or family member know how
    you're feeling, so you have people alongside you. You can also reach these services now."
  - **Item 9:** "You mentioned having thoughts of being better off dead or of hurting yourself.
    You deserve support right now. Please contact one of these services, or someone you trust who
    can be with you. If you're in immediate danger, call your emergency number."
  - **Every result screen ends:** "This is encouragement to reflect a little more deeply today.
    It is not medical advice."
- The PHQ-2 and PHQ-9 questions themselves keep their standard wording, because changing a
  validated questionnaire changes what its scores mean. Only the framing around them uses
  reflection language. The new table is named `reflections`, not `screenings`.

### 10. Encouragement throughout (2026-09-26)
- Miah: use language like "change is hard, be gentle with yourself", "Growth takes work and time
  (and can be painful at times), but you are worth it" and "Your future self is grateful for the
  self-care you are putting in today".
- These became `src/lib/encouragement.ts` (Miah's three lines first, five more in the same voice),
  one line per day, shown after saving a day, under the dashboard streak and on reflection
  results. Not used in the item 9 crisis message, which stays direct.
- Added to CLAUDE.md principles as point 7, "Encourage, kindly".

### 11. The most important rule for the gentle check-in (2026-09-26)
- Miah: "The most important thing is to make sure that the code only triggers these comments
  after a trend line shows frequency collected with >10 sequential entries."
- Implemented in `src/lib/reflection.ts`: the check-in is offered only when there is an unbroken
  run of **more than 10 consecutive calendar days with a mood or stress check-in**, ending today
  or yesterday, **and** at least 7 of the last 14 logged days were harder days (mood 1 or 2, or
  stress 4 or 5), **and** nothing was offered in the last 14 days, **and** the setting is on.
- A missed day, or a day with habits but no mood or stress, breaks the run. Tests cover 10 vs 11
  in a row, gaps, habit-only days, and a run that ended two days ago.
- The demo sample never reaches this (its check-ins have gaps), so browser testing needs a
  dedicated test account or fixture.

### 12. Pacing encouragement and celebrating showing up (2026-09-26)
- Miah: encouragement "can become cumbersome if issued too often"; randomize it so it never
  appears more than once every 5 entries. Every two weeks, give positive feedback for completing
  the daily entry. In the tracker, mark every 5 days of completion (not necessarily sequential).
- Decisions (Miah chose the recommended option each time):
  - A completed entry is **any saved day**. Editing an old day is not a new entry.
  - **Encouragement** appears only in the save confirmation, on entries picked from a fixed random
    sequence per person with gaps of 5 to 8 entries (`src/lib/milestones.ts`). The always-on line
    under the dashboard streak was removed. Reflection results keep theirs (they are rare).
  - **Every 14th entry** gets a soft glow that blooms and fades, with "N days of showing up for
    yourself." and "Thank you for making time for yourself." With reduced motion, a still colour.
  - **Every 5th completed day** gets a star and the milestone colour (`sun`) in a new month
    calendar on Log Habits, with spoken labels such as "your 50th completed day".
- Guard rail: celebrations mark arrivals only. Nothing marks a missed day, resets or says a run
  was broken; days without an entry are simply blank.

### 13. The four pillars (2026-09-26)
- Miah proposed four named pillars: **Eat Real** (nutrition, "clear and credible"), **Sleep Well**
  (sleep), **Move More** (exercise, "accessible"), **Steady On** (stress management, resilience,
  emotional regulation), replacing "Sleep. Water. Movement." on the sign-in page.
- Claude recommended keeping the database and code keys unchanged (they describe the data and map
  to Apple Health, the importer, tests and statistics) and putting the names in one file,
  `src/lib/pillars.ts`, so renaming or translating is a one-file change. Agreed.
- Claude raised, for the record, that "Eat Real" can echo clean-eating language, "Move More" can
  read as "never enough", and "Steady On" is a British idiom that can sound like a telling-off and
  may not translate; alternatives were offered (Sleep Well, Move Well, Eat Well, Stay Steady).
  **Miah chose her originals.** Revisit with native speakers when translating for India, the UAE
  and Germany.
- Mapping: Sleep Well = sleep, time in bed, awake minutes; Move More = exercise minutes, steps,
  stand hours, active calories; Eat Real = water, calories eaten, net calories; Steady On = mood,
  energy, stress, feelings, and the gentle check-in and reflection.
- Open question from this discussion: whether calories eaten belong on the dashboard at all,
  given how strongly calorie counting pulls toward self-judgment.

### 14. Eat, Sleep, Move, Balance, and the health-platform mapping (2026-09-26)
- Miah proposed **Eat** (including water), **Sleep**, **Move**, **Balance**, replacing section 13's
  names. Claude agreed: plain words that translate cleanly, no judgment built in, a gentle rhythm.
  Subtitles keep each pillar clear: Eat, food and water; Sleep, sleep and rest; Move, movement,
  your way; Balance, stress, mood and how you feel. Order everywhere: Eat, Sleep, Move, Balance.
- Tagline, from Miah's words ("Create the pillars of health in your own house. Live long. Judge
  yourself less."). Claude's polished version was rejected ("terrible brand slogan"); Miah's final
  wording, after trying "four", is **"Build your pillars of health. Live Well."** with a lighter
  line beneath it: *"p.s. judge yourself a lot less"*.
- Miah asked to map the pillars cleanly to Apple Health and Google. `src/lib/healthMapping.ts` and
  `docs/health-mapping.md` map every measure to Apple Health, Google Health Connect and the Google
  Health API, with tests. Findings: Apple has State of Mind (mood and our six feelings, one to one)
  and PHQ-9 results; Health Connect has no mood or stress data; the Google Health API (a web API)
  has Moods; Google Fit is deprecated in 2026. Energy and stress are app only everywhere.

### 15. Thirteen feelings (2026-09-26)
- Bob (Miah's husband) asked for six more feeling words. Miah added a second neutral and swapped
  Content for Tired. Final 13: pleasant Calm, Peaceful, Confident, Grateful, Hopeful, Proud;
  neutral Steady, Meh; unpleasant Frustrated, Overwhelmed, Anxious, Lonely, Tired.
- Apple mapping: ten by name; Steady -> Content (Miah's choice), Meh -> Indifferent (Apple's only
  flat label; people only ever see "Meh"), Tired -> Drained. Migration 0008.
- Noted for translation: "Meh" is informal English.

### 16. Email and domain (2026-09-26)
- Supabase's built-in email sender hit its hourly limit during testing ("email rate limit
  exceeded"). Before launch, connect a real email provider under Authentication > Emails > SMTP.
- Free options compared: Resend (3,000/month, official Lovable connector; recommended), Brevo
  (300/day), Mailjet (6,000/month, 200/day); SendGrid is no longer free.
- Any provider needs a domain Miah owns, with SPF and DKIM records. Miah plans to put the domain on
  Vercel (account msolmsted@gmail.com, username fraumeo, Hobby plan; main team "olmsted-portfolio").
- Domain: short "four pillars" names were all taken. Miah chose **buildyourpillars.com** (matches the
  tagline; $11.25 a year on Vercel), available across social media handles and domain endings.
  Miah buys it herself in Vercel (payment and registrant details are hers); Claude then sets up the
  Vercel project, the domain, Supabase redirect URLs and Resend. Suggested: also claim
  @buildyourpillars handles and buildyourpillars.app.

### 17. Hackathon: AI reflection, sign-up, and the name (2026-09-26)
- **AI daily reflection (temporary).** The hackathon asked for natural-language feedback. Miah
  chose Claude over OpenAI ("I feel like the info is more secure"), then Opus 5.5. An opt-in
  "Reflect on today" card calls the `daily-reflection` Edge Function, which sends only today's
  numbers, ratings and feelings. Hard days get a fixed message and never reach AI; replies that
  judge, diagnose or talk diet are filtered. Removal steps are at the top of
  `supabase/functions/daily-reflection/logic.ts`.
- **Getting the key working.** The first saved secret was named `Anthropic_API_Key` and held an
  invalid key; the second key was valid but not scoped to a workspace, so each request now sends
  the workspace ID. Verified live: a reply from `claude-opus-5-5` on the Demo account.
- **Sign-up.** Teammates hit "email rate limit exceeded" (Supabase's built-in sender allows about
  two emails an hour). With Miah's go-ahead, email confirmation was turned off for the hackathon.
  Turn it back on once a real email sender (Resend) is set up.
- **Insights overview (Michael's feedback).** A first-time user saw a mostly empty Insights page.
  The top now shows the last four weeks (days logged per pillar), this week against the person's
  own usual (medians, previous eight weeks), and up to two gentle invitations drawn from their own
  patterns. Invitations say "if you like" and never "should" or "because".
- **Weekly coach (Michael's AI coach, reworked).** Michael wrote a coach (new table, new function,
  a card). Checked against the schema: `select("*")` would have sent location columns, its CORS
  headers would block the browser call, and it saved AI text. Claude first proposed a reflection
  without goals; Miah pushed back: "there is a way to view a coach differently than a judge". So:
  "Coach me on my week" on the existing card, with the person's own goals, where a goal not
  reached is information, never failure, and one small next step is offered as an invitation.
  Same function and safeguards; calories-eaten goals are never sent; nothing saved.
- **Travel demo year (Demo account).** Miah's own Apple Health year, made public-proof: daily
  totals only (steps, exercise, stand hours, active energy, sleep, time in bed, awake), dates
  rotated, rounded (steps 100, exercise 5 min, sleep a quarter hour), city centres only, and none
  of the personal details in her trip files. 365 days through 50 places she has been, no more
  than 21 in Philadelphia and 21 in the Seattle area, each with real weather. Water and
  faces check-ins are made up (she tracks those in other apps); her real short-sleep nights and
  heavy exercise days are kept. The recording week is kept gentle so the reflection and coach
  speak. Built by `scripts/build-travel-demo.ts`; the old Demo data is backed up in
  `sample-data/snapshots/2026-09-26-demo-before-travel-year/`. The Apple Health importer now
  counts each stood hour once (it had counted up to 52 a day).
- **Weekly rhythm instead of a daily streak.** From a scan of what people say about health apps
  (a third quit one because it made them feel worse; broken streaks make people give up). A day
  counts when anything is logged, any 4 logged days in the last 7 make a full week, a week in
  progress never breaks the run, and nothing names missed days or a lost streak.
- **Reflection on demand or automatic: the person chooses.** Team feedback: success criterion 1.3
  says the AI summary updates after each log, but the reflection was written on demand. Miah chose
  a Settings switch, "Write my daily reflection automatically after I log" (migration 0009,
  `profiles.auto_reflection`, off by default). Off: the card says it is written when you ask. On:
  the Dashboard writes a fresh reflection once per changed entry (notes edits do not count), kept
  in memory only, so nothing is saved.
- **Download my data, and "Why am I seeing this?".** Also from the scan (privacy worry is rising;
  unexplained suggestions are ignored). Settings → Your data downloads everything the person holds
  as JSON, or the daily log as a spreadsheet (CSV), built in the browser from their own rows, so
  nothing is sent anywhere. Each "Something to try" suggestion now opens to show the evidence from
  the person's own days, how strong it is, and that it is association, not cause.
- **Bug: switching days could drop Balance values silently (Michael).** Two causes: picking
  another day with unsaved changes replaced the form without asking, and the form stayed editable
  while a day loaded, so a quick click could be overwritten when the load arrived. Fix: the form
  is locked while a day loads or saves; switching days, leaving through the menu, logging out or
  closing the tab with unsaved changes asks first ("Save, then open", "Discard changes", "Keep
  editing"); an "Unsaved changes" note shows beside Save. `isDirty` is tested with controls.
- **Fifteen more weather factors, for mood and energy.** Miah asked for at least 12 more links
  between weather and mood or energy. All fifteen are worked out from weather already stored (no
  migration, and they apply to everyone's past days): warm-ups and cool-downs from the day before,
  sudden cool-downs and warm-ups (5°C), pressure rising or falling and drops of 5 hPa, the day
  after rain, the third rainy day in a row, days lengthening or shortening over a week, the
  day-to-night swing, hot days (30°C+), cold days (5°C or less), days that felt hotter than the
  thermometer, grey days (under 2 h sun), the sunny share of daylight, and muggy days. Compared
  with mood and energy only, to keep the multiple-testing correction gentle. Guards still pass:
  the planted rain pattern is found, the moon never is, and shuffled data raises a false Likely
  pattern in at most 10% of runs. New positive control: a planted "sudden cool-downs lower mood"
  pattern is found; random energy is not. City check: 16 of 16 OK, no new false alarms.
- **City check (16 cities).** `npm run check:cities` runs the app's own city search, weather,
  Dashboard weather line and Insights for 16 cities (both hemispheres, the date line, desert,
  equator at altitude, Europe for pollen, poor air). No accounts, nothing written to Supabase.
  First run: 16 of 16 OK; each city's own today is used (Delhi to Auckland were already on the
  27th); pollen only in Europe. Made-up check-ins had one planted pattern (rain lowers mood),
  found in Honolulu and Auckland; Atlanta showed one chance finding (rain and stress), within the
  10% false-discovery rate the engine is set to.
- **Today's weather on the Dashboard.** Miah asked to see the weather that Insights compares with:
  "Today in Atlanta: 15–28°C, dry, …", linking to Insights, with Open-Meteo credited.
- **Name.** The app is now "Build Your Pillars" in the header, the browser tab and CLAUDE.md,
  matching buildyourpillars.com. Historical documents keep the old name.

### 18. Demo video, deck and submission (2026-09-26)
- **Narrated demo video, 4:27.** The first cut (the Loom recording with narration laid over it)
  had long silences and was cut to 2:56, which dropped features the brief highlights. Miah asked
  for the full brief in about 4½ minutes. Claude wrote a 10-paragraph script from the brief;
  ElevenLabs read it in the Bomani voice, one clip per paragraph, placed back to back with
  half-second pauses. A timed script then drove the live app on the Demo account on each spoken
  cue (clicks, typing, scrolling, a visible pointer) while the screen was recorded at 1920 × 1080,
  so the screen follows the voice with no dead air. Claude wrote the daily reflection and the
  weekly coach reply live during the take.
- **What the video checks and hides.** Every cue was checked against its words, no silence over
  1.5 s. The Demo login email is hidden in the sidebar and blurred in Settings; browser pop-ups
  and the Chrome extension's marker are covered. The Privacy scene was filmed again so the daily
  log downloads and opens as a spreadsheet. A closing cutaway shows the real `npx vitest run`
  output (125 passed). The end card names Group 63: Michael Stuewing, Mushtaq Ahmed, Miah Shull
  Olmsted and Muzzafar Shaikh. Loom: https://www.loom.com/share/ade24c3c61e74865b0c4c3d2d1fc5e9d
- **Script corrected to match the app.** Insights shows one "Something to try" suggestion for the
  Demo data, so the line "two small things to try" was re-recorded as "a small thing to try".
- **Demo account changes (approved by Miah).** Three goals added (water 2 L, sleep 7.5 h, steps
  10,000) so the Dashboard and the weekly coach have goals to work with. Today's entry
  (2026-09-26) was removed before each take so logging could happen on camera; the final take
  logged it again (mood Happy, energy High, stress Low, Calm and Grateful, water 2.2 L, sleep
  7.25 h, 13,000 steps).
- **Brief, package and deck.** The product brief, a demo video package (creative brief, script,
  shot list, feature coverage) and the Outskill pitch deck were filled in and exported. The deck
  keeps Outskill's template, colours and fonts; research sources are in its speaker notes.
- **Submitted** to the Outskill AI Accelerator hackathon (group 63) before the deadline of
  27 September, 10:00 a.m. IST.

### Working agreements that emerged
- Claude shows every migration and waits for approval; destructive or tightening changes state
  the affected row count first.
- Every test has a positive control: a case that must fail or be caught, so a pass means something.
- Claude does not tune statistical thresholds to make a test pass; it reports and fixes the cause.
- Claude pushes to GitHub only when Miah asks.
- Stages end with Miah testing in the browser before the next stage starts.

### Open items at the end of this session
- Leaked password protection still reported as off by the advisor.
- Delete the old Impact Arts project `dfjkeuqycklxnvitmjby` (Miah).
- Merge PR #1 after review.
- The old branch `prompt-03c-gentle-checkin` holds the superseded draft; 3C continues on
  `prompt-03c-reflection`.
- Future: translations for the launch countries (the interface is English only).
- After judging: remove the AI reflection; turn email confirmation back on with Resend.
- After judging: decide whether the Demo account keeps the three goals and the recorded entry for
  2026-09-26.
- Later: a sleep-quality field, crisis lines for Oman, a design pass, and automated checks on
  GitHub (CI).

### 18. Demo year extended to today (2026-10-12)
- Miah approved extending the Demo account. The year had ended on 2026-09-26, so the Dashboard showed "Not logged" for the current week. Added 16 days (2026-09-27 to 2026-10-12), now 381 days in all, all in Philadelphia (where the year ends), with real Open-Meteo weather for each day fetched by the app's own `fetchConditionRange`. Habit values are copies of the first 16 days of the year (the same rotation idea as the original build), notes left empty. Additive only; nothing was deleted or changed. The 10-12 weather row is a forecast (`is_final` false) and refreshes by the app's normal rule.
- Not reproducible from `scripts/build-travel-demo.ts` (that builds a 365-day year ending 2026-09-26); if the year is rebuilt, set its `LAST_DAY`.

### Public pages for people and machines, and the "asks first" copy (2026-10-13, branch feat/brand-asks-first)
- **Prerender.** `npm run build` now ends with `node scripts/prerender.mjs`. It renders `/`, `/sharing`, `/why`,
  `/privacy`, `/terms` and `/health-data-privacy` to real HTML in `dist/` with `react-dom/server` (no new dependency),
  with each page's title, description, canonical, Open Graph tags and JSON-LD. The app hydrates on top of that text.
  The Supabase client is swapped for a stub that throws if called, so a public page can never need a session or the network.
  The empty shell is kept as `dist/app-shell.html`, and `vercel.json` sends every other route there.
- **Static files.** `public/llms.txt`, `public/sitemap.xml` (public routes only) and `public/robots.txt` are real files, so they
  are no longer swallowed by the SPA fallback. `vite preview` now behaves like Vercel for `/sharing` and app routes (see `vite.config.ts`).
- **Copy.** Lead claim, hero line, offer wording, the credit line and the canonical description live in `src/lib/brandCopy.ts`.
  The six `/sharing` questions live in `src/lib/siteMeta.ts` and feed both the page and the FAQPage markup. No dollar figures
  anywhere public (the Terms price section now uses the offer wording). `src/lib/publicCopy.test.ts` scans the pages, `index.html`,
  `llms.txt` and the manifest for the banned and safety words.
- **Not done here.** The welcome-back lines exist as `src/lib/welcomeBack.ts` with tests but nothing in the app calls them yet.
  Billing code still holds the old prices (`src/lib/billing.ts`) because it is not public copy; Miah to decide.



## 2026-10-14 — remediation after frozen A0 audit

Addressed sharing freshness, invitation handoff, mixed pillar/monthly permissions, appointment preparation/printing/coverage, and stale agent instructions. A0 is immutable; candidate R1 evidence lives in the Box Evaluation/2026-10-14-Remediation-R1 folder. See docs/reports/2026-10-14-baseline-remediation.md. 737 tests plus build/import and isolated SQL controls passed; participant results remain unmeasured.
