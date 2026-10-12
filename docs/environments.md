# Environments (2026-10-12)

| | Production | Test and beta |
|---|---|---|
| Supabase project | PersonalHealthManager, ref `gzsawayrorlcjmpssalc` | BuildYourPillars-Test, ref `gabumzdkjpeqwhsezzts` (created 2026-10-12, $10/month, Pro org OlmstedDataPlayground, US East) |
| Used by | buildyourpillars.com (the live site) | Vercel preview and local dev, the next beta round (Robert's anonymised Apple Health data), and first runs of Stripe test mode and Resend |
| Accounts today | 13, all test accounts | none yet |
| Migrations applied | 0001-0016, 0018, 0019, 0020 (0017 email not applied) | 0001, 0002, 0004-0016, 0018, 0019, 0020 (0003 skipped on purpose: it revokes `public.rls_auto_enable()`, which only exists on the production project; 0017 email not applied) |

Parity check on 2026-10-12: tables and columns, row-level-security policies, table and function grants for anon/authenticated, and trigger counts are identical. The 30 shared functions are identical after removing comments and whitespace. Production has one extra function, `rls_auto_enable()`.

## Rules
- Real money or outside parties (Stripe, Resend, store uploads) are set up in TEST first.
- Real people's data never goes into TEST without their consent; Robert's data is loaded only after redaction (see scripts/build-travel-demo.ts) and only into TEST.
- Every production database change is read, tested in a rolled-back block, and approved by Miah.
- Raw health exports stay out of git and out of shared folders.

## Still to do (Miah, in the Supabase dashboard of the TEST project, Authentication)
1. Turn email confirmation ON.
2. Add the Vercel preview address and http://localhost:5173 to URL Configuration (Redirect URLs).
3. Turn on leaked password protection (also on production).
Then (needs Miah's go-ahead): point the Vercel PREVIEW environment variables VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY at the TEST project; leave Production variables on production.
