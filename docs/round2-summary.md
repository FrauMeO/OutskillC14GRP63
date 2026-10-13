# Round 2 accessibility and copy pass

Branch `feat/a11y-round2`, from `feat/accessible-tokens`. Local commits only; nothing pushed, no migrations or services touched.

## What changed
1. `AuthShell.tsx`: a compact footer (tagline, then `p.s. live well`) shows below `md`, so phone sign-in and sign-up end with the signature.
2. New `src/components/Notice.tsx`: glyph (warning or tick) plus visible prefix ("Problem:" or "Done:"), keeping `role="alert"` for errors and `role="status"` for confirmations. Replaced the ad-hoc markup in Settings, Goals, LogHabits, AuthPage, ForgotPassword, ResetPassword, Insights, Dashboard, Reflect, Following, FollowingPerson, Plan, AppointmentSummary, SharingSettings, EmailPreferences, PrivacyCenter, DeleteAccount, CityPicker, BirthPrompt, CaregiverPlanCard, ReminderSetting, HealthImport, WaitlistForm, AiReflectionCard. No `text-ember` is left on error text.
3. "should" removed from user-visible copy: "What would you like us to call you?" (AuthPage, Settings), Reflect.tsx, and the privacy request hint in `privacyRequests.ts`. `authErrors.ts` still matches Supabase's English "should" text, but that is a pattern, not shown copy.
4. "Eat" as a pillar name changed to "Drink" in the daily-reflection AI prompts and its label, Privacy.tsx ("eating" became "water"), and code comments. The email templates were already Drink and the shared copy is unchanged and identical.
5. Terms: "We are a small, founder-led team." `p.s. live well` added as the last line of the public footer, which is also the last line of the Why page.

## Left deliberately
- "Calories eaten" and "Net calories (eaten minus active)" labels, and the `calories_consumed` goal: founder decision.
- Stored keys (`eat`, `share_eat`, `goal_type` values) unchanged.
- HealthDataPrivacy.tsx "We have no payments yet." (line ~243) is stale (Plan page and billing exist). Not changed.
- Neutral (uncoloured) status lines such as "Loading..." were not converted.

## Decisions needed
- Calories-eaten wording (see above).
- The HealthDataPrivacy payments line.
- Landing already shows the signature in its hero, and now again in the footer; confirm that is acceptable.
- The AI consent dialog still says "food calories you logged", which describes real data.

## Notes
- The worktree started on `main`, not `feat/accessible-tokens`; I rebased onto the latter with `git checkout -B`.
- Final: `npx tsc -b` clean, `npm test` 47 files / 619 tests passing, `npm run build` succeeds.
