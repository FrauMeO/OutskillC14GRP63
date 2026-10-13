# Brief: Build Your Pillars brand guidelines, first draft in Figma

For: the thread that will draft the guidelines in Figma. Prepared by: Claude (build session), 2026-10-12, from the shipped app (src/index.css, src/lib/pillars.ts, CLAUDE.md product principles) and Miah's Brand System 2026 notes. Deliver a DRAFT (v0) for Miah to react to. Mark every guess "proposed".

## 1. What the brand is
Build Your Pillars (buildyourpillars.com): a gentle, private health tracker across four pillars, Eat, Sleep, Move, Balance (Balance = mental health, equal in weight to the others). Tagline: "Build your pillars of health. Live Well." with the sign-off "p.s. judge yourself a lot less." Founders: Miah Shull Olmsted and Robert Olmsted. Audience: adults 50+ and the people who care about them; free for 60+. Promise: no shame, no streaks, no scoring, you choose how much to share, private by design, no ads, no insurer or provider behind it.
Brand personality: calm, warm, patient, plain-spoken, quietly dignified. Never clinical, never cutesy, never pushy, never "wellness-influencer".

## 2. Voice and words (binding, from the product principles)
- Reflect, don't judge: "You logged...", "Days with more sunshine went along with...". Never "good day", "bad day", "failed", "on track", "streak lost", "missed".
- A day not logged is a gap, never a zero, a mark or a red badge. A full week = any 4 logged days of 7.
- Association, never cause ("tends to go together"). Personal, never compared with other people.
- Encouraging, kindly: "Change is hard, be gentle with yourself." "Your future self is grateful for the self-care you are putting in today."
- Plain words, 6th to 8th grade, no jargon ("permissions", "sync" need explaining). No diagnosis, no diet or weight talk, no "should".
- Crisis messages are direct and are never softened by encouragement.
- AI is always labelled and described plainly ("Written by AI (Claude). Only your numbers, ratings and chosen feelings are sent; never your notes, name or email.").
Provide a one-page voice chart: say this / not this, with 10 examples including error messages, empty states, consent dialogs and the doctor-visit summary.

## 3. Colour (from the code, these are the live tokens: keep the names)
Core: Spruce #1E3B37 (text, headers), Spruce soft #2C4F4A, Mist #EDF1EE (page background), Sage #7E9C8E (secondary), Line #D5DDD8 (borders), Current #2F6F8F (links, water, info).
Pillars (fixed, never reused for other meanings): Eat = Sprout #4F6F2A; Sleep = Dusk #5B5A8C; Move = Ember #B8752F; Balance = Bloom #8A4A6E.
Special: Sun #946200 (milestones and celebrations only); Alert #A63D32 (reserved for real errors and crisis resources, NEVER for missed days or goals).
Tasks: (a) build Figma variables with these exact names; (b) compute and show WCAG 2.2 AA contrast for every text/background pair (text and pillar colours on Mist and on white; flag any pair under 4.5:1, and large text under 3:1); (c) propose tints for backgrounds and chart fills; (d) propose an optional dark palette, labelled proposed (the app is light only today); (e) state that colour is never the only carrier of meaning (pair with icon or label).

## 4. Typography
Display: Bricolage Grotesque Bold 700 (self-hosted, Latin subset, SIL OFL 1.1; the only web font the app loads). Body: the device's own font (ui-sans-serif / system-ui / -apple-system / Segoe UI / Roboto), chosen on purpose so the app downloads no fonts (low-data users). Public Sans appeared in earlier brand work; it may be used in print and marketing, not in the product: flag this as a decision.
Sizes: body 18px minimum in anything an older person reads (supporter views, public pages, consent dialogs), 16px absolute floor; scalable to 200% without breaking layout; line height about 1.5; short lines (about 65 characters). Provide a type scale and Figma text styles.

## 5. Logo and marks
Existing v0 files (Miah's Drive: My Drive/Brand System 2026/_work-in-progress/byp-and-miah-v0/01-logos): byp-mark.svg, byp-mark-on-dark.svg, horizontal and stacked lockups (PNG), app icons (1024 PNG, iOS square SVG, rounded SVG). The mark is four vertical pillars. If you cannot read these files, say so and ask for an upload rather than inventing a new mark. Draft: clear space, minimum sizes, one-colour and on-dark versions, app-icon safe zone (iOS and Android adaptive), favicon, what never to do (no stretching, no recolouring pillars, no gradients, no drop shadows).
Naming rules: "Build Your Pillars" (title case) in full; "Pillars" as the short form; pillars always in the order Eat, Sleep, Move, Balance; never "BYP" in anything public.

## 6. Components and patterns (from the app: Settings, Dashboard, sharing, consent)
Document with specs and states (default, focus, disabled, error): buttons (min 44px target, visible focus ring), inputs and selects, checkboxes with long consent wording, cards, the weekly rhythm ("4 of 7 days") display, 7-day trend charts where gaps are shown as dots not zeros, pillar cards, plan cards (free / $2.99 a month / $34.99 a year caregiver), consent dialogs (focus trap, Escape = "Not now"), privacy badges ("Only you can see this"), the "Shared with" line, read-only supporter views, empty and offline states ("Saved on this device. It will upload when you are back online."), the 90-day "still happy sharing?" banner, printable doctor-visit summary (black on white, 12pt+).

## 7. Imagery, illustration, iconography
Real, varied adults aged 50 to 90 in everyday settings (kitchen tables, walks, hands, tea, gardens); no stock-photo clichés (gripping canes, pill bottles, hospital beds), no before and after bodies, scales, tape measures or calorie imagery, no flames or trophies for streaks. Illustration: simple rounded shapes built from the four pillar colours; icons rounded, 2px stroke, with text labels. No photos of real named people without written consent. Include accessibility rules for alt text.

## 8. Low-data and mobile
Brand assets must be light: SVG first, no web fonts beyond the one above, compressed images, no autoplay video. Specify app icon, splash, store screenshot frames (ask for current required sizes; do not guess), and a "native app" variation where prices are hidden per store rules.

## 9. Applications to draft (v0)
Landing page hero, sign-up and consent screens, a dashboard card set, social banners (existing sizes in use: Facebook cover 1640x624, LinkedIn 1128x191, X header 1500x500, YouTube banner 2560x1440, profile picture 1080 square), a 3-minute pitch deck cover and slide template, an email template (calm, 18px, no tracking pixels), the doctor-visit summary page.

## 10. Hard limits (privacy and honesty)
Do not include or imply: any health condition of the founders or anyone else, any real person's health data, caregiving of a third party, a hackathon or team, HIPAA compliance, medical advice or diagnosis, unverified statistics, testimonials, or "clinically proven" claims. The founders' ages appear only on the public "Why we built it" page. Keep the footer line: "This is not medical advice or a diagnosis." Show placeholders (clearly marked) for anything uncertain.

## 11. How to structure the Figma file
Pages: Cover and status; Principles and voice; Logo; Colour; Typography; Layout and grid (mobile 375, tablet, desktop; 16px side gutters); Components; Data visualisation; Imagery and icons; Accessibility checklist; Applications; Do and don't. Use Figma variables and text styles named to match the code (spruce, mist, sage, line, current, sprout, dusk, ember, bloom, sun, alert; font-display, font-sans) so a developer can map them to src/index.css. Add a final page "Open questions for Miah".

## 12. Open questions to list at the end (do not decide silently)
1. Keep the four-pillar mark as is, or refine it? 2. Public Sans in marketing: yes or no? 3. Dark mode: now or later? 4. Photography versus illustration for the landing page. 5. Whether the founders appear in brand imagery. 6. Relationship to Miah's other brands (Brand System 2026): standalone, or a shared family look? 7. The app icon on iOS and Android adaptive masks.

## 13. Output requested
A first-draft Figma file with the pages above, with every guess marked "proposed", plus a one-page summary of what you could and could not build and what you need from Miah.
