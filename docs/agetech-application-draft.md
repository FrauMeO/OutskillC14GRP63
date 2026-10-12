# AgeTech After Dark: application draft (due 2026-10-12, 11:59 pm)

Prompt: "How does your tech solution help make aging easier?"

## Answer (about 280 words)

Build Your Pillars is a gentle health tracker for people who want to look after themselves without being judged, tracked or sold to.

It began at home. My husband Robert (72) and I (60) wanted a simple way to share our health journey, and everything we tried was confusing, or felt like pressure. So we built one.

**You choose how much to share.** Enter a little or a lot: water, sleep, movement, mood. Leave anything blank. There is no all-or-nothing, no streak to lose, and a missed day shows as a gap, never a zero. Someone can come back after a week and simply carry on.

**Mental health sits beside water and sleep.** Mood, energy and stress are one of four pillars (Eat, Sleep, Move, Balance), because these are the areas where many older adults struggle quietly. About one in four older adults is dehydrated [1], insomnia symptoms are reported by a large share of them [2], and 28% screen positive for depression in a large review [3]. On a hard day the app does not hand the day to AI. It shows a caring message and, if needed, crisis lines for your country.

**Private by design.** It is not tied to any insurer or medical provider, and it has no ads and no paywall. Most adults over 50 worry about how companies use their data (67%) and about records reaching people other than their doctors (58%) [4]. Your information stays yours: each person sees only their own, locations are rounded to about 11 km, the AI sees numbers only, and everything can be downloaded.

**Live now at buildyourpillars.com**, with a year of real, anonymised data in the demo and 125 automated tests.

Next: Apple Health and Google Health Connect syncing, and optional sharing so a remote caregiver can follow along, only if the person invites them.

## Sources (check each before submitting)

1. Low-intake dehydration in non-hospitalised older adults, meta-analysis, Clinical Nutrition 2023: https://www.sciencedirect.com/science/article/pii/S0261561423001851 (24% overall; very wide confidence interval, 0.07–0.46)
2. Insomnia in Older Adults, PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC7731454/ (symptoms 30–48%, disorder 12–20%)
3. Prevalence of depression in older adults, meta-analysis, 2022: https://www.sciencedirect.com/science/article/abs/pii/S0165178122001251 (28.4% screened positive; varies by tool and region)
4. 2020 AARP Big Health Data Survey, adults 50+: https://www.aarp.org/pri/topics/work-finances-retirement/fraud-consumer-protection/2020-big-health-data-survey.html (67%, 58%)

## Verified against the originals (2026-10-12)

- [1] PubMed 37330324 abstract: 24% overall (95% CI 7–46%); community 19% (CI 0–48%); long-term care 34%. Authors: "one in every 4"; evidence quality LOW because studies differ so much. Measured by blood osmolality.
- [2] The paper gives NO pooled figure. It lists ranges from 48 studies: insomnia disorder 17–60%, symptoms 8.2–74.8%, and "up to 75%" in its introduction. My earlier "30–48%" came from a search summary, not this paper, so it is removed. Perplexity brief asks for a better single figure.
- [3] PubMed 35316691 abstract: 28.4% across 48 studies, high heterogeneity, screening-tool based (not diagnosed depression).
- [4] AARP page: 67% and 58%; 800 adults 50+, interviewed 4–25 Feb 2020.

## Facts to confirm before it goes in

- Founders: Miah Shull Olmsted (60) and Robert Olmsted (72), per Miah on 2026-10-12. No teammate commits exist in git. The repo, deck and video still say Group 63 / Outskill; adjust before reviewers see them.
- Apple Health sync and caregiver sharing are NOT live in the code (Apple Health is a file importer; Google Health Connect is only mapped in docs/health-mapping.md). The draft lists them as "Next".
- "A year of real data": the demo year is yours, anonymised and date-shifted.
