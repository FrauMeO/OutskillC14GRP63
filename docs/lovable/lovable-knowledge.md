# Build Your Pillars of Health: Lovable Knowledge

Paste this whole file into Lovable > Project settings > Knowledge. It is the persistent context for every prompt.

## What this project is
A clickable DEMO front end for Build Your Pillars of Health: a gentle health tracker for adults 50+ (caregivers, partners and adult children are the secondary audience). Mock data in code only. No real backend, no sign-in service, no real health data.

Tagline: `Build your pillars of health.`
Fixed signature: `p.s. live well` (lowercase, always the last line on a screen, never a heading, same size as body text).
Founders: Robert "Bob" Olmsted and Miah Shull Olmsted. Never name a hackathon, group number or team. Founder ages appear only on a "Why we built it" page, so omit them here.

## The four pillars
Always written `Drink. Sleep. Move. Balance.` in this order, with these periods, everywhere.
- Drink = hydration (not food, no meal or calorie tracking).
- Sleep.
- Move.
- Balance = includes mental health (mood, energy, stress, feelings).
A day with no entry is a `Day off`. Never "missed", "not logged", zero, failure, or a broken streak. No streak counters, badges or leaderboards. Rhythm wording: "any 4 days in 7 make a full week".

## Voice rules
Calm, warm, grounded, plain-spoken, quietly encouraging, 6th to 8th grade reading level, sentence case.
- Never use the word "should". Offer instead: "Something to try, if you like."
- No exclamation marks anywhere in the UI.
- No diet, calorie, weight-loss or "good/bad food" language.
- No diagnosis. Say "went together", never "caused". Say "lower mood", not "depression".
- No pressure, scolding, "senior" clichés, or humor on hard days or about age, memory, bodies, weight or ability.
- Say what happens to data right where the action happens.

## Privacy and product rules
- Sign-up is data-minimal: one name field and month and year of birth only. Never a full birth date, email or phone in the demo.
- Pricing (state on the landing page only): free for people 60 and older; $2.99 a month for everyone else; caregiver plan $34.99 a year, only with the older person's clear permission.
- Caregiver sharing is permissioned, scoped (per pillar, three levels: days only, weekly summary in words, day-by-day numbers), revocable at any time, and always visible to the older person. It is connection, not surveillance. Caregivers can only look; they never see notes, feelings list, places or check-in answers.
- The AI label reads "Written by Claude from your numbers" with a footer "Not medical advice." AI sees numbers and feelings only, never name or location, and nothing is saved. On a hard day the app shows a fixed kind message instead of AI text.
- Never claim HIPAA compliance, clinical capability, or "clinically proven". Never state the product is a medical device.
- Appointment summaries are a version 3 waitlist concept only. If shown, it is a clearly labelled waitlist card ("Coming in version 3. Join the waitlist."), with no working summary.
- Health data is used only to give the person their own experience: not sold, not used for ads.

## Design tokens (copied from tokens.css, v1.1 accessible)
```css
:root {
  /* Product UI: single colour, high contrast. Verified in contrast-report.md */
  --byp-spruce: #1E3B37;
  --byp-paper: #FFFFFF;
  --byp-mist: #EDF1EE;
  --byp-moss: #40524C;
  --byp-sun: #946200;      /* marker fill or border only; label text is spruce */
  --byp-alert: #8F2B22;  /* form errors only, with icon and text */

  --color-bg-page: var(--byp-mist);
  --color-bg-surface: var(--byp-paper);
  --color-text-primary: var(--byp-spruce);
  --color-text-secondary: var(--byp-moss);
  --color-border-control: var(--byp-spruce);
  --color-border-decorative: #D5DDD8; /* dividers only */
  --color-marker-today: var(--byp-sun);
  --color-error: var(--byp-alert);
  --focus-ring: 3px solid var(--byp-spruce);
  --focus-offset: 2px;

  --font-display: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-body: 1.125rem;   /* 18px standard */
  --text-large: 1.375rem;  /* 22px large */
  --text-largest: 1.625rem;/* 26px largest */

  --radius-chip: 999px; --radius-card: 16px; --radius-sheet: 20px;
  --space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem; --space-12: 3rem;
  --touch-min: 44px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-page: #12211E;
    --color-bg-surface: #1A2C28;
    --color-text-primary: #FAFBF9;
    --color-text-secondary: #BCCFC8;
    --color-border-control: #FAFBF9;
    --color-border-decorative: #2C4F4A;
    --focus-ring: 3px solid #FAFBF9;
  }
}
:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
body { background: var(--color-bg-page); color: var(--color-text-primary); font: var(--text-body)/1.5 var(--font-body); }
```
Map these onto the Tailwind theme and shadcn CSS variables so every shadcn component uses them. Do not use the retired pillar colours (Sage, Sprout, Current, Dusk, Bloom, Ember) anywhere in product UI.

## Accessibility rules
- Body text 18px; offer a text-size control with 22px and 26px. Layout must survive 200% zoom and reflow at 400%.
- Text contrast target 7:1. Secondary text is Moss, never pale grey.
- Controls have 2px Spruce borders (the decorative divider colour is never a control border).
- Visible 3px focus ring on every interactive element, with a 2px offset. Keyboard order follows reading order.
- Touch targets at least 44px.
- Colour is never the only signal. Each pillar is identified by its word, a distinct FILLED (solid) icon, and a fixed position (Drink, Sleep, Move, Balance). Today/selected uses Sun as a marker plus a text label or shape. Errors use Alert plus an icon plus text.
- Icons are solid filled, 32px minimum, always with the word beside them. Use inline filled SVGs: water glass, moon, footsteps, balanced stones.
- Respect reduced motion; motion is short and calm (150ms). No confetti, bouncing or celebration.
- Semantic landmarks, labelled form fields, aria-labels that say "Day off" (never "not logged").
- Fonts: Bricolage Grotesque for headings, system stack for body.

## Never do
- No real health data, real names, real emails or Apple Health exports. Synthetic mock data only, defined in code.
- No production keys, no API keys, no secrets, no Supabase/Stripe/Resend/Claude calls. Do not add a backend.
- Do not ask for another tech stack. Stay with React, Tailwind and shadcn/ui.
- Do not collect payment or take real sign-ups; the app-store badges and Subscribe controls are placeholders.
- Do not add features that are not in the prompt.

## Open decisions (do not resolve these yourself; use the default shown)
- OPEN DECISION: Alert colour. tokens.css v1.1 says `#8F2B22` (7.26:1 on Mist); the Figma brand brief JSON and the consolidated brief say `#A63D32`. Default: `#8F2B22`.
- OPEN DECISION: Touch target. tokens.css and the caregiver brief say 44px; the Figma brand brief says 48px. Default: 44px minimum.
- OPEN DECISION: Body font. Figma brief proposes Public Sans; the low-data direction and tokens.css use a system stack. Default: system stack.
- OPEN DECISION: AI label wording. The brief for this build says "Written by Claude from your numbers"; ai-safety-plan.md uses "Written by AI (Claude, by Anthropic)". Default: the first, with "Not medical advice." in the footer.
- OPEN DECISION: Pillar icons. brand-tokens-v1.1.json says the Figma icons are line icons and distinct filled icons are still needed. Default: custom filled inline SVGs.
