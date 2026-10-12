# tests-safety: adversarial safety cases for the AI reflection

Synthetic cases only. No real user data, no network, no API key. Added 2026-10-12 as part of `docs/ai-safety-plan.md`.

## Run

```
npx vite-node tests-safety/run-against-checker.mjs              # report; exit 1 only if a case NOT in baseline.json fails
npx vite-node tests-safety/run-against-checker.mjs --strict     # exit 1 on any failing case (the target state)
npx vite-node tests-safety/run-against-checker.mjs --update-baseline   # accept today's failures as known gaps
```

`vite-node` is already a repo dev dependency (via vitest). The script imports the real functions from
`supabase/functions/daily-reflection/logic.ts` (`cleanReply`, `cleanCoachReply`, `isHardDay`, `isHardWeek`,
`describeDay`, `describeGoals`, `userMessage`), so it tests the code that ships.

## What the cases are

`cases.json`, 69 cases, each with a category, a severity and a reason.

| kind | what it runs | expectation |
|---|---|---|
| `reply` / `coachReply` | a hostile or sloppy MODEL REPLY through the output filter | `reject` (user sees the fixed kind message) or `pass` (a good reply must survive) |
| `day` | a logged day through `isHardDay`, or through `userMessage` (the exact text the model receives) | `hardDay` true/false, or `promptMustNotMatch` a pattern |
| `goals` | goals through `describeGoals` | `promptMustNotMatch` |
| `week` | days through `isHardWeek` | `hardWeek` true/false |

Cases marked POLICY QUESTION encode a proposed rule (for example "mood 2 with anxious is a hard day"). If the
founders decide otherwise, change the expectation, not the code.

## Baseline and CI

`baseline.json` records `passCount` and `total` (how many cases passed when it was last updated) and `knownFailures`
(case ids that still fail, each either a plain id or `{ "id": ..., "reason": ... }`). Since the checker rewrite
(`src/lib/replySafety.ts`) all 69 cases pass and `knownFailures` is empty.

The gate runs inside `npm test`: `tests-safety/cases.test.ts` fails the build when fewer cases pass than `passCount`,
when a case outside `knownFailures` fails, when a listed known failure starts passing (so the list never goes stale), or
when cases were deleted (`total`). Raise `passCount` when you fix more cases; never lower it to hide a regression. Do
not weaken a case to make it pass: a case that is a policy question or unsafe by design stays in `knownFailures` with a
reason.

`run-case.mjs` is the single place that decides how each case kind is run; both the report script and the gate use it.

## Limits (be honest in the DPIA)

- A keyword filter cannot be made complete. Many `reject` cases here are semantic ("slim down", "ought to").
  Closing them needs either a much stricter reply format (see the plan, section 4) or a second classifier.
- These cases test the deterministic checks, not the model. For the model itself, run garak offline
  (plan, section 3a) against a staging copy of the edge function with synthetic data.
- Add every real-world near miss as a new case (paraphrased, never the user's data).
