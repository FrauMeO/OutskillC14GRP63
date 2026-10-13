# Lovable first prompt (paste everything below the line)

Set the Knowledge file first. Then paste only the text below the line into a new Lovable project.

---

Build a clickable demo front end for "Build Your Pillars of Health" using Lovable's default stack (React, Tailwind, shadcn/ui). Follow the project Knowledge file for voice, tokens, accessibility and the Never do list. All data is mock data defined in code (a single `src/mock/data.ts`). There is no backend, no database, no real sign-in and no network calls. State lives in React state and `localStorage` only for the demo.

Product in one line: a gentle health tracker for adults 50+ across four pillars, Drink. Sleep. Move. Balance., that never judges a day.

## Global requirements

1. Routes: `/` landing, `/sign-in`, `/today`, `/week`, `/sharing`, `/privacy`. After sign-in go to `/today`. A tab bar at the bottom on phones and a left sidebar on desktop, with four items in this order and these labels: "Today", "Week", "Sharing", "Privacy". Use the current page marker (Sun) plus a text label, never colour alone.
2. Apply the design tokens from Knowledge as CSS variables and map them to the Tailwind theme and shadcn variables. Headings use Bricolage Grotesque; body uses the system stack.
3. Add a text-size control in the header with three options labelled "Standard", "Large", "Largest" (18, 22, 26px). It changes the root font size and persists in `localStorage`.
4. Every screen ends with a footer containing, in this order: "This is for reflection. It is not medical advice and it does not diagnose anything." then, as the very last line, `p.s. live well` in body-size text (not a heading).
5. A skip link "Skip to main content" appears on focus. All interactive elements have the 3px focus ring. All targets are at least 44px.
6. Pillars are always shown in the order Drink, Sleep, Move, Balance, each with its word, a solid filled inline SVG icon (water glass, moon, footsteps, balanced stones) and fixed position. Never colour alone.
7. A day with no entry is "Day off". No streak counters, no "missed", no zero, no red for low numbers.
8. No exclamation marks and no word "should" anywhere in the UI copy.
9. Mock people only: the demo user is "Alex" (first name only), born "March 1958". Mock caregiver is "Sam" with email `sam@example.com`. All numbers are invented.

## Screen 1: Landing (`/`)

Layout, top to bottom (single column, max width 56rem, generous spacing):
10. Header: wordmark "Build Your Pillars" at left, text-size control and a "Sign in" button at right.
11. Hero on a Spruce panel with Mist text: the stacked lockup, one word per line: "Drink." "Sleep." "Move." "Balance." Under it the tagline "Build your pillars of health." and a primary button "Try the demo" (goes to `/sign-in`).
12. Section "A gentle way to notice your days": one sentence, "Four pillars, one entry card each. Add as much or as little as you like. A day without an entry is a day off, and that is fine." Then four pillar cards (word, filled icon, one plain line each): Drink "Water and other drinks." Sleep "How you rested." Move "Movement, your way." Balance "Mood, energy, stress and how you feel."
13. Section "Your information stays yours": three short points: "You choose what to enter." "You can download or delete everything." "Sharing with someone you trust is your choice, and you can stop at any time." Link "Read how we handle your information" to `/privacy`.
14. Section "What it costs": three plain cards. "Free for people 60 and older." "$2.99 a month for everyone else." "Caregiver plan, $34.99 a year, only with the older person's clear permission." Cards are text only, no buy buttons.
15. Section "Get the app" (heading exactly "Get the app"): two placeholder badge boxes side by side, labelled "App Store (coming soon)" and "Google Play (coming soon)", each rendered as a bordered, non-clickable box 44px or taller with a visible word label, plus a text link "Use it on the web: buildyourpillars.com" (opens in a new tab; the link text states it opens in a new tab). Add a small note: "Badges are placeholders in this demo."
16. Section "Who made it": "Built by Bob Olmsted and Miah Shull Olmsted, a husband and wife who wanted a gentle way to share and understand a health journey together." Two photo placeholders labelled "Photo of Bob (placeholder)" and "Photo of Miah (placeholder)".
17. Global footer (requirement 4).

States: the text-size control changes all text; at 200% zoom the hero stacks and badges wrap to two rows.

## Screen 2: Sign-in (`/sign-in`)

Layout: on desktop a split screen, Spruce panel at left with the stacked lockup and tagline, Mist panel at right with the form (form max width 28rem). On phones the Spruce panel becomes a short banner above the form.
Form heading: "Welcome". Helper line: "We only ask for what we need."
Fields (each with a visible label above the input, 2px Spruce border):
18. "Your name" (single field, helper "A first name is enough.").
19. "Month of birth" (select, January to December) and "Year of birth" (select, current year minus 110 to current year minus 18). Helper: "We use this only to work out your plan. We do not ask for your full birth date. You must be 18 or older."
Button: "Continue" (primary, Spruce, white text). Under it, plain text: "This is a demo. Nothing you type here is saved or sent anywhere."
States: empty submit shows an inline error beside each missing field, with an alert icon and text, for example "Please add your name." and "Please choose your month and year of birth." in Alert colour, and focus moves to the first error. Valid submit stores name and birth month and year in React state and routes to `/today`. If age is 60 or over, show a calm line on `/today` under the greeting: "Your plan: free for people 60 and older." Otherwise: "Your plan: $2.99 a month."
No password field, no email field, no social login.

## Screen 3: Today (`/today`)

Layout: page heading "Today" with the date; greeting "Good morning, {name}." (time based: morning, afternoon, evening); plan line (see Screen 2). Below, a 2 by 2 grid on desktop and a single column on phones of four pillar entry cards in this fixed order: Drink, Sleep, Move, Balance. Each card has the pillar word as its heading, the filled icon at 32px or larger, a one-line entry control, and a small "Day off" or value status line.
Entry controls (one per card, all optional):
20. Drink: stepper in glasses, "Add a glass" and "Remove a glass" buttons, shown as "3 glasses".
21. Sleep: select with "Hours slept" values from 3 to 12 in half hours.
22. Move: stepper in minutes, "Add 10 minutes" and "Remove 10 minutes".
23. Balance: five buttons "1" to "5" labelled "How do you feel? 1 is low, 5 is good" and a row of feeling chips: "Calm", "Grateful", "Tired", "Lonely", "Anxious" (toggle chips with a check icon when on).
Each card has a button "Save" and, once saved, the status line "Saved for today".
States:
- Empty (nothing entered): the status line reads "Day off so far" with a dashed outline gap, never a zero. Under the grid, one calm line: "Rest days are part of the rhythm. Add what you like, or nothing at all."
- Filled: value shown in words, e.g. "3 glasses".
- Hard day: if Balance is 1 or 2 or "Lonely" or "Anxious" is on, show a fixed kind message in a bordered card labelled "A kind message from the app": "That sounds like a heavier day. There is nothing to fix. A glass of water and a few quiet minutes can help, if you like." No AI text on hard days. Footer line stays "p.s. live well".
Below the pillar cards, an "From your numbers" card containing the AI label component:
24. Label (top of the card, body-size, with a small sparkle-free text icon): "Written by Claude from your numbers".
25. Mock reflection text (fixed string from mock data, not generated): "Your water and your walks went together this week. Something to try, if you like: a short stroll after lunch."
26. Footer line inside the card: "Not medical advice. Nothing is saved." followed by "Claude sees your numbers and feelings, never your name or location."
Show this card only after an "Ask for a reflection" button is pressed; before that show the button and the sentence "This is optional. Claude is an AI made by Anthropic." On a hard day the button is replaced by the fixed kind message above.
Last item before the footer: a small week strip (see Screen 4) titled "This week".

## Screen 4: Week view (`/week`)

Layout: heading "Your week". A row of seven day columns (Monday to Sunday on desktop; a vertical list on phones), today marked with the Sun border plus the text label "Today". Under it, four rows in the fixed pillar order, each row starting with the pillar's filled icon and word, then one cell per day.
Cells: a bar (height from the mock value) with a text value, or, for no entry, a dashed outline with the words "Day off". Never zero, never red. Bars use Spruce; meaning never relies on colour: each cell has a text value.
Summary line above the grid, from mock data: "4 of 7 days is a full week. This is a full week." If fewer than 4 days have entries: "A fresh week. Add what you like." No counts of days away.
Controls: "Previous week" and "Next week" buttons (44px, labelled). Mock data covers three weeks; a week beyond the data shows the empty state.
Empty state (a week with no entries): "A quiet week. Every day is a day off, and that is fine. Add something whenever you like." with a button "Go to Today".
Reflection card from Screen 3 repeats under the grid with the same AI label, and "Something to try, if you like: ..." wording. Insight text uses "went together", never "caused".
Mock data: week 1 has entries on 5 days, week 2 on 3 days (so shows "A fresh week"), week 3 empty.

## Screen 5: Caregiver sharing consent (`/sharing`)

Layout: heading "Sharing with someone you trust". Intro: "You choose who sees what. They can only look. You can pause or stop at any time." Section "Who can see your pillars" with the current state card.
Empty state (default): "You are not sharing with anyone." and a button "Invite someone".
Invite form (shown when "Invite someone" is pressed, below the intro):
27. Field "Their email" (placeholder `sam@example.com`, demo only).
28. Group "Which pillars" with four checkboxes in fixed order: Drink, Sleep, Move, Balance (Balance has hint "Balance means your mood, energy, and stress scores.").
29. Group "How much they see" with three radio options: "Days only: which days you added something." "Weekly summary: a weekly summary in words, with no numbers." "Day by day: your day-by-day numbers for those pillars."
30. Button "Review before sending" (disabled until an email, at least one pillar and one level are chosen).
Consent dialog (shadcn Dialog; the safe button "Not now" is first in tab order and has initial focus; Escape means Not now):
- Title: "Share with {email}?"
- Body, each as its own labelled paragraph: "What they will see: {ticked pillars}. {level sentence}." "What they will never see: your notes, your feelings list, your places, or your check-in answers." "Why: so someone you trust can follow along. That is the only reason." "They can only look. They cannot change anything. They will see your first name." "You are in charge. You can pause or stop sharing any time. It stops at once. You can also see on which days they looked." "The invitation ends by itself after 14 days if they do not accept."
- Unticked checkbox: "I agree to share this with {email}."
- Buttons: "Not now" (outline) and "Send invitation" (disabled until the box is ticked).
- Link: "Read how we handle your information" to `/privacy`.
Active state after "Send invitation" (mock only, nothing is sent): a card "Sharing with Sam (sam@example.com)" showing status text "Invited, waiting for Sam" then a button "Pretend Sam accepted" for the demo, which changes it to "Active". The card always lists, in words: pillars shared (word plus icon), the level, the start date, and a visible line "Visible to you: Sam can see {pillars} at the {level} level." Buttons: "Pause sharing" (status becomes "Paused, Sam sees nothing now"), "Resume", and "Stop sharing" (inline confirm: "Stop sharing with Sam? They will not be able to see anything." with "Keep sharing" and "Stop sharing"). After stopping: "Sharing with Sam has ended. They cannot see anything now." and the empty state returns.
Adding a pillar or raising the level on an active share reopens the dialog with first line "You are changing what Sam can see." and a fresh unticked checkbox. Lowering or pausing never asks.
Section "Who looked" (the access log, owner-visible): a list with mock rows "Sam looked on Tuesday" and "Sam looked on Friday" (only when active), or "No one has looked yet." Never show numbers about how often.
Caregiver plan: a calm text card "Caregiver plan: $34.99 a year. It needs your clear permission, which you give by sending the invitation above." No buy button.
Appointment summaries: a clearly labelled card "Appointment summaries. Coming in version 3. Join the waitlist." with an email field labelled "Email (demo only, not saved)" and a button "Join the waitlist" that shows "Thank you. This is a demo, so nothing was saved." Do not show any sample summary.

## Screen 6: Privacy page (`/privacy`)

Layout: heading "How we handle your information", a left table of contents on desktop, plain headings and short paragraphs (6th to 8th grade). Sections with these exact headings and copy:
31. "What we ask for": "A first name, and your month and year of birth. Nothing else is needed to start."
32. "What you enter": "Things like drinks, sleep, movement, mood and feelings. You choose what to add. A day with nothing added is a day off."
33. "What we do with it": "We use it to show you your own days and trends. We do not sell it. We do not use it for ads."
34. "Sharing": "Nothing is shared unless you say yes. If you invite someone, you choose the pillars and how much they see. They can only look. You can pause or stop at any time, and you can see when they looked."
35. "Help from Claude (AI)": "This is a separate choice. If you say yes, an AI called Claude, made by Anthropic in the United States, writes a few gentle sentences. It sees your numbers and feelings. It never sees your name, your location, your notes or your check-in answers. We save nothing. On a hard day we send nothing and show a fixed, kind message instead." Include a demo switch labelled "Use AI help for reflections" (default off). When off, the "Ask for a reflection" button on Today is replaced by "AI help is off. Nothing will be sent."
36. "Your choices": buttons "Download my data" and "Delete my account" that each show a demo-only message ("This is a demo. Nothing was downloaded." and "This is a demo. Nothing was deleted."). Do not show a real download.
37. "What this app is not": "Build Your Pillars is for reflection. It is not medical advice and it does not diagnose anything. We do not claim to be a health provider or to meet medical privacy rules for health providers."
End with the global footer.

## Mock data (in `src/mock/data.ts`)

Three weeks of invented entries for the four pillars (see Screen 4 coverage), the fixed reflection string, the fixed hard-day kind message, and the mock caregiver. No real person's data. Include a comment at the top: "Synthetic demo data only."

## Acceptance checks (verify each before you finish; tell me which pass)

A1. Pillars appear in the order Drink, Sleep, Move, Balance on every screen, each with word, filled icon and fixed position. Turning off colours (grayscale) still identifies every pillar.
A2. Search the whole app for "Eat", "missed", "not logged", "streak", "should" and "!" in user-facing copy: zero hits (apart from this prompt's instructions, which are not UI).
A3. Empty Today shows "Day off so far" with a dashed gap; no zero appears anywhere.
A4. Sign-in asks only for a single name plus month and year of birth. There is no password, email, phone or full date.
A5. Tab order works on every screen with a visible 3px ring; the consent dialog focuses "Not now" first and Escape closes it without sending.
A6. "Send invitation" is disabled until the checkbox is ticked; "Stop sharing" ends sharing at once and the empty state returns.
A7. The AI label "Written by Claude from your numbers" and the footer "Not medical advice." appear together on every AI card, and AI never appears on a hard day.
A8. The text-size control switches 18, 22 and 26px and the layout holds at 200% zoom with no horizontal scroll at phone width.
A9. The landing page has a "Get the app" section with App Store and Google Play placeholders and the buildyourpillars.com link.
A10. `p.s. live well` is the last line of every screen, lowercase, not a heading.
A11. No network requests, no API keys and no backend code exist in the project.
A12. Pricing appears only on the landing page and in the plan line: free for 60 and older, $2.99 a month for others, caregiver $34.99 a year with the older person's permission. No claim of HIPAA compliance anywhere.
