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
  wording is **"Build four pillars of health. Live well. Judge yourself less."**
- Miah asked to map the pillars cleanly to Apple Health and Google. `src/lib/healthMapping.ts` and
  `docs/health-mapping.md` map every measure to Apple Health, Google Health Connect and the Google
  Health API, with tests. Findings: Apple has State of Mind (mood and our six feelings, one to one)
  and PHQ-9 results; Health Connect has no mood or stress data; the Google Health API (a web API)
  has Moods; Google Fit is deprecated in 2026. Energy and stress are app only everywhere.

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
