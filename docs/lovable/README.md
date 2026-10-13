# Lovable build kit: Build Your Pillars of Health
1. `lovable-knowledge.md`: the project Knowledge file (product rules, voice, v1.1 accessible tokens, accessibility rules, Never do list, five OPEN DECISION items with defaults).
2. `lovable-first-prompt.md`: ONE prompt that builds the clickable demo front end (six screens, numbered requirements, exact copy, states, acceptance checks A1 to A12).
3. Order of use: first paste `lovable-knowledge.md` into Lovable > Project settings > Knowledge, then paste only the text below the line in `lovable-first-prompt.md` into a new project.
4. Lovable will NOT produce the real app. The Supabase-backed app (auth, consent ledger, billing, AI function, tests) lives in this repo; Lovable output is a demo/prototype with mock data only.
5. Do not connect Lovable to Supabase, Stripe or any production key, and do not import real health data.
6. Credits warning: every Lovable prompt and edit spends credits. Send the first prompt once, then use small, specific follow-ups. This kit was written without calling Lovable.
7. Read the OPEN DECISION list at the end of the Knowledge file before sending; edit the defaults if you decide differently.
8. Repo status: `src/lib/pillars.ts` now says Drink with the new tagline and signature (branch `feat/accessible-tokens`). "Not logged" labels still need to become "Day off"; see `docs/audit-brief-vs-app.md`.
9. Sources were the Desktop AgeTech briefs, byp-v1.1-accessible tokens, and this repo's docs; none were edited.
10. Nothing was committed, pushed or deployed.
