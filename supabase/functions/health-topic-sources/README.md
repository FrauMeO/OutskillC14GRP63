# health-topic-sources (edge function)

Short, sourced explanations for a pillar topic, from public-health websites only, found with
[Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search). Built 2026-11-14.
**Not deployed. No screen uses it yet.**

## What it does

The app sends `{ pillar, topic }`, for example `{ "pillar": "sleep", "topic": "caffeine" }`.
The function answers with at most 5 sources:

```json
{ "pillar": "sleep", "topic": "caffeine",
  "sources": [{ "title": "Self-help tips to fight tiredness - NHS",
                "url": "https://www.nhs.uk/live-well/sleep-and-tiredness/self-help-tips-to-fight-fatigue",
                "snippet": "Caffeine is a stimulant which means it makes you feel more awake. But it can also disrupt…",
                "source_domain": "nhs.uk" }] }
```

`pillar` is one of the database keys `nutrition` (Drink), `sleep`, `exercise` (Move) and `wellbeing` (Balance).
The browser helper is `src/lib/healthTopicSources.ts` (`fetchHealthTopicSources(pillar, topic)`).

## Privacy: what leaves the app

Tavily receives **only** the search words: the checked topic plus fixed pillar words (`sleep`, `hydration`,
`physical activity`, `mental wellbeing`), with the settings below and the Tavily key. The function calls Tavily
from Supabase's servers, so Tavily never sees the person's internet address either.

Never sent: the user id, email or login token, entries, check-ins, feelings, notes, location, or any other
field or header from the request. `handler.safety.test.ts` sends a request loaded with all of these and checks
that none of them reach the outbound request (with a positive control that a planted value is caught).

The topic is checked before anything is sent:

- 2 to 80 characters and at most 10 words, after trimming.
- Letters, digits, spaces and `' ’ , & / -` only, so an email or web address cannot get through.
- No run of 3 or more digits (a phone number, a year, a weight or a dose). `B12` and `omega-3` are fine.
- No words about the person (`I`, `I'm`, `I've`, `I'd`, `I'll`, `me`, `my`, `mine`, `myself`): the topic should be
  general ("sleep and caffeine"), not a description of the person ("my insomnia").

Logs hold codes and HTTP status only, never the topic, the person or Tavily's reply.

## Sources it may use

Only these public-health domains and their subdomains (`TRUSTED_DOMAINS` in `logic.ts`; keep this list in step):

| Domain | Who |
|---|---|
| `nih.gov` | US National Institutes of Health (includes NIA, NHLBI, NIH News in Health) |
| `cdc.gov` | US Centers for Disease Control and Prevention |
| `who.int` | World Health Organization |
| `medlineplus.gov` | MedlinePlus, US National Library of Medicine |
| `nhs.uk` | UK National Health Service |

Left out (`EXCLUDED_DOMAINS`): `ncbi.nlm.nih.gov`, `pubmed.ncbi.nlm.nih.gov` and `pmc.ncbi.nlm.nih.gov`, the
research databases inside nih.gov. On the first live check all five results were research abstracts, full of
figures, so they are left out in favour of plain-language pages. Remove a line in `logic.ts` to let them back in.

The list is sent to Tavily as `include_domains`, and every result is checked again afterwards: https only, on the
list, not a look-alike (`nih.gov.example.com`), no duplicates. Snippets are plain text, at most 300 characters.

Tavily settings: `search_depth: "basic"` (1 credit per lookup), `max_results: 8` (5 returned after the checks),
no AI-written answer, no raw pages, no images.

## Checks and limits

In order: login (the person's own token; `verify_jwt` stays on), a readable body, pillar and topic, key present,
the person's lookup limit, Tavily (10 second timeout), result checks. Every failure ends in a plain message.

Lookup limit: 20 per person per hour, to protect the Tavily credits. It is best effort (it lives in one running
copy of the function and resets on a cold start). A firm limit needs a database table, so a migration.

## Files

| File | What |
|---|---|
| `logic.ts` | Pure rules: topic checks, query, the Tavily request, result shaping, origins, the lookup limit |
| `handler.ts` | The request handler, with login, fetch, key and clock passed in (so tests run the real thing) |
| `index.ts` | Deno entry point: the real login check, the secret, `Deno.serve` |
| `logic.test.ts`, `handler.safety.test.ts` | vitest; part of `npm test` |
| `../../../scripts/check-health-topic-sources.ts` | Live check through the real handler, using Tavily's keyless mode (no key needed) |

## Run the checks

```
npm test
npx vite-node scripts/check-health-topic-sources.ts sleep "caffeine"
```

## Set up and deploy (Miah runs these; nothing has been deployed)

Install the Supabase CLI if it is missing (`brew install supabase/tap/supabase`), then `supabase login`.
Try the TEST project first (docs/environments.md), then production.

```
supabase secrets set TAVILY_API_KEY=tvly-YOUR-KEY --project-ref gabumzdkjpeqwhsezzts
supabase functions deploy health-topic-sources --project-ref gabumzdkjpeqwhsezzts
```

Production, once the test project works:

```
supabase secrets set TAVILY_API_KEY=tvly-YOUR-KEY --project-ref gzsawayrorlcjmpssalc
supabase functions deploy health-topic-sources --project-ref gzsawayrorlcjmpssalc
```

Typing the key on the command line leaves it in the shell history. To avoid that, put the one line
`TAVILY_API_KEY=tvly-...` in a file outside the repo and run `supabase secrets set --env-file <that file> --project-ref ...`.
Do not add `--no-verify-jwt`.

## Before a screen uses it (Miah's decisions)

- Where it appears, and the wording of every message (`MESSAGES` in `logic.ts` are drafts).
- Whether Tavily is listed in "Who has my data" (`src/lib/dataRecipients.ts` and the Health Data Privacy page).
  It receives the topic text only, but the person types it.
- Sources for Canada, India, the UAE and Germany (only US, UK and WHO sources today).
- Snippets are the source's own words and may say "causes" or "lowers". Show them as quotes from the named
  source, so the app's own voice keeps "association, never cause".
