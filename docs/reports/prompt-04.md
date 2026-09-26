# Prompt 4 report: Dashboard with progress tracking

Date: 2026-09-25. Branch: `prompt-04-dashboard` (built on 3B; not merged). Project: `gzsawayrorlcjmpssalc`.

## Status
Done, pending Miah's browser review.

## Files changed
- Migration `supabase/migrations/0006_dashboard_metrics.sql`, test `supabase/tests/dashboard_test_after_0006.sql`.
- `src/lib/dashboard.ts` (+ tests), `src/components/ProgressIndicator.tsx`, `src/components/TrendChart.tsx`, `src/pages/Dashboard.tsx` (rewritten).
- `src/lib/goals.ts`, `src/lib/checkin.ts`, `src/pages/LogHabits.tsx`, `src/lib/database.types.ts`, `src/index.css` (tokens `sprout` for nutrition, `bloom` for wellbeing).
- `scripts/generate-sample-export.mjs`, `import-apple-health.mjs`, `verify-import.mjs`, `generate-sample-checkins.mjs`, `build-demo-seed.mjs`, `verify-seed.mjs`; regenerated sample files.
- `sample-data/snapshots/2026-09-25-demo/` (data snapshot, pushed before the migration).
- New dependencies: `recharts` 3.10.1 and `react-is` (allowed by the prompt).

## Schema
0006 as above; details and reasons in `docs/schema-log.md`. The paused 3C migration must become 0007.

## Earlier-prompt code changed
See the schema log. In short: goal types, Log Habits (steps, source), and every sample-data script.

## Assumptions
1. Kept the sample dates fixed (Miah agreed at the checkpoint). Dashboard tests use a fixed "today".
2. No default targets: a metric without a goal shows "Set a goal". This removes handover bug 3 (dashboard 2 L vs Goals form 2.5 L).
3. Saving a day from Log Habits marks it `manual`, so an edited Apple Health day switches from rings to bars.
4. Steps: when the Watch and iPhone both report a day, the Watch total counts (a day-level version of Apple's source priority).
5. Only one log per metric per day exists (unique row per day), so no same-day summing is needed in the app; summing happens in the importer.
6. Wellbeing counts toward the streak with mood, energy or stress. Feelings alone do not count.
7. Charts use the card's colour; water keeps its fixed `current` colour inside the Nutrition card.

## Tests
- `npm test`: 54 pass (12 new for the dashboard: progress over 100, ring vs bar, null vs zero, local-date boundaries including month, year and daylight-saving changes, gaps in the 7-day series, a streak longer than 7 days, a broken streak with its control, today incomplete, the empty state).
- `npm run test:import`: importer PASS on 60 days and 9 fields with two controls CAUGHT (15-minute sleep change; doubled steps). Seed PASS with control CAUGHT; planted pattern present.
- Insights (3B) still pass on the new sample: the planted pattern is Likely, the moon is not, shuffled mood 2 of 200 runs.
- A regression was caught and fixed: adding 2026-09-14 first shifted the check-in random draws and dropped the planted pattern to adjusted p 0.148. The fix restores the exact 3B check-ins; no threshold was changed.
- Rolled-back SQL test for 0006: all expected results.
- Browser: every card value on 2026-09-25 matches a direct query of that row; streak 1; charts show gaps for days without a value.
- `npm run build` passes. Security advisor: only "Leaked password protection disabled" (Auth setting).

## Open questions
1. Leaked password protection still reports as off. Recommended: check the switch under Authentication > Attack Protection and click Save.
2. Rings only appear for Apple Health days, and today's entry is manual, so the live dashboard currently shows bars. Recommended: accept; a real Apple Health import for today will show rings.
3. 3C is paused with an unapplied draft migration. Recommended: renumber it to 0007 and resume after reviewing this dashboard.
