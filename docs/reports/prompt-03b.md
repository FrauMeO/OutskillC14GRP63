# Prompt 3B report: Insights

Date: 2026-09-25. Branch: `prompt-03b-insights`, built on `prompt-03a-checkin` (neither pushed).

## Status
Done, pending Miah's browser check (stage checkpoint). No schema changes in this stage.

## What was built
- `src/lib/insights/stats.ts`: normal and t distributions, average ranks, Spearman (t approximation), Mann-Whitney U (normal approximation with tie and continuity corrections, rank-biserial effect), Benjamini-Hochberg. No new dependencies.
- `src/lib/insights/engine.ts`: 19 factors (15 continuous, 4 yes/no: rainy day over 2 mm, snow day, UV 6 or more, AQI over 100) against 6 measures (mood, energy, stress, sleep, exercise, water). Only paired days count; factors that never vary are skipped. Likely: BH-adjusted p at most 0.10, at least 21 paired days, effect at least 0.3, and at least 5 days in each yes/no group. Worth exploring: p below 0.05 before correction and effect at least 0.3.
- `src/pages/Insights.tsx`, route `/insights`, sidebar entry: progress until 14 logged days, then Likely and Worth exploring, grouped by factor family, association-only sentences with day counts, Open-Meteo attribution and non-commercial note.

## Results on the sample data (59 days)
- 96 comparisons ran (factors with no variation, such as snow and pollen, were skipped).
- Likely: 1, the planted pattern. "On rainy days (over 2 mm) your mood averaged 2.8, compared with 3.8 on dry days (55 days)." Adjusted p 0.061 (limit 0.10), rank-biserial -0.62.
- Worth exploring: 5. Stress on rainy days (expected: sample stress is generated opposite to mood), rain amount and precipitation amount with mood (the same pattern as amounts), and sunshine and humidity with sleep (chance links between real weather and sample sleep; this is what the tier is for).
- Moon: not Likely for any measure (negative control).
- False-positive check: mood shuffled across days 200 times with a fixed seed; 1 of 200 runs (0.5%) produced a Likely mood pattern (limit 10%). Control: unshuffled data does produce one.

## Assumptions
1. Continuous sentences compare the top and bottom thirds of days by that factor, so every sentence can give two averages and a day count.
2. Yes/no groups need at least 5 days each to be Likely (added; the prompt did not set a group minimum). Comparisons need at least 10 paired days to run at all.
3. Correlated factors (rain, precipitation, humidity) are all shown, grouped under one heading, as the prompt asked.
4. Test files are excluded from the app type check (`tsconfig.json`), because one reads the sample fixture with Node's file API; Vitest still runs them.
5. The planted pattern passes with an adjusted p of 0.061; it would not pass at a 5% false discovery rate. Recorded, not tuned.

## Tests
- `npm test`: 42 pass, including textbook checks (IQ and TV-hours Spearman, separated-groups Mann-Whitney, the Handbook of Biological Statistics BH example), the sample-data pattern and moon control, wording rules, and the shuffle check.
- `npm run test:import`: PASS with both controls CAUGHT. `npm run build`: passes.
