# Billing: plans, Stripe, and what Miah does (2026-10-12)

Written for Miah, not for engineers. Everything here is **built but not switched on**: nothing is
deployed, no SQL is applied, no Stripe account is touched. Until `billing_enforced` is turned on, **everyone uses
everything free** (the beta).

## 0. The rules, and the decisions that are still yours

The rules (yours, 2026-10-12): free for anyone 60 or over (birth month and year, self-declared, no ID
checks); $2.99 a month for everyone under 60; a caregiver plan of $34.99 a year, only when the older person
has an active accepted share with them; the caregiver plan is needed to **view** a shared pillar view; the
older person's own plan is never affected by whether their caregiver pays.

**Decisions I did not make silently (details in the sections named):**

| # | Decision | My default in the code | Section |
|---|---|---|---|
| 1 | Stripe Tax on or off, and who files tax in each of the 5 places | Off (code ready: set `STRIPE_TAX_ENABLED=true`) | 3 |
| 2 | Access while a payment is failing (`past_due`) | **No access** once Stripe says `past_due`; only `active` and `trialing` count | 7 |
| 3 | What an under-60 legacy account with no birth data gets once billing is on | Must give birth month and year first (status `needs_birth`); until then no paid features | 5 |
| 4 | Refunds, cancellation timing, disputes | Not decided; see section 10 | 10 |
| 5 | Currencies beyond USD | USD only to start | 3 |
| 6 | iOS: web-only sale, with the App Review risk in section 2 | Web checkout only | 2 |
| 7 | Whether to promise notice before charging starts | Terms already say "We will tell you before any charge begins" and the Plan page matches | 9 |

## 1. Research: current Stripe facts (read 2026-10-12)

| Topic | What the official page says | Where I used it |
|---|---|---|
| Current API version | "The current version is 2026-09-30.endive." Monthly releases, no breaking changes; a major release twice a year. https://docs.stripe.com/api/versioning | `STRIPE_API_VERSION` in `supabase/functions/_shared/stripeCore.ts`, sent as the `Stripe-Version` header. **The webhook endpoint in the dashboard must be created with the same version**, because event shape follows the endpoint's version. |
| Checkout Sessions, subscription mode | `mode=subscription`, `line_items`, `success_url`, `cancel_url`, `client_reference_id` (max 200 chars), `metadata`, `subscription_data`, `automatic_tax`, `customer`. Hosted page is the default `ui_mode`. https://docs.stripe.com/api/checkout/sessions/create | `create-checkout`. Hosted page only, so **no card data touches our servers**. |
| Customer Portal | `POST /v1/billing_portal/sessions` with `customer` and `return_url`; returns `url`. https://docs.stripe.com/api/customer_portal/sessions/create | `billing-portal` |
| Webhook signing | `Stripe-Signature: t=...,v1=...`; HMAC-SHA256 of `timestamp.rawBody` with the endpoint secret; ignore every scheme except `v1`; compare in constant time; default tolerance 5 minutes; never a tolerance of 0; the body must be the raw text. https://docs.stripe.com/webhooks | `verifyStripeSignature` (tested, including exact boundary and a wrong-signature control) |
| Webhook behaviour | Events can arrive twice and **out of order**; track event ids; return 2xx quickly; retries for up to 3 days in live mode (a few hours in a sandbox); event destinations are created in Workbench. https://docs.stripe.com/webhooks | `stripe_events` table; the handler re-reads the subscription from Stripe on every event so order does not matter |
| Subscription statuses | `active`, `trialing`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`. "When a subscription changes to canceled or unpaid, revoke access." https://docs.stripe.com/billing/subscriptions/webhooks | Mapping in section 7 |
| Idempotency keys | Header `Idempotency-Key`, up to 255 characters, all v1 POSTs, kept at least 24 hours, a reused key with different parameters is an error; avoid personal data in keys. https://docs.stripe.com/api/idempotent_requests | One key per person + plan + UTC day for checkout; one key per person for the customer. Keys contain a random user id, never an email. |
| Test clocks | "Simulations" with test clocks advance time in a **sandbox** so renewals, failures and cancellations can be watched. https://docs.stripe.com/billing/testing/test-clocks | Test plan, section 11 |
| Test cards | `4242 4242 4242 4242` succeeds; `4000 0027 6000 3184` needs 3D Secure; `4000 0000 0000 0002` declines; `4000 0000 0000 9995` insufficient funds; `4000 0000 0000 0341` attaches, then later charges fail. Any future expiry (for example 12/34), any 3-digit CVC. https://docs.stripe.com/testing | Test plan |
| Stripe Tax | Calculates tax in many places. https://docs.stripe.com/tax/supported-countries : **United States** and **Canada** and **Germany** and **UAE**: supported as customer location, all product types; business location also supported. **India**: digital products, IGST, customer location only (your business cannot be based in India). | Section 3 |

**SDK choice: no Stripe SDK.** Plain `fetch` to `https://api.stripe.com/v1` plus a 30-line signature check
using Web Crypto, which Deno has built in. Reason: the official `stripe` npm package works in Deno (Supabase's own
examples use `npm:stripe` with `Stripe.createFetchHttpClient()` and `constructEventAsync` with a
`createSubtleCryptoProvider()`), but I could not confirm the current package version from a primary source
today (the npm search returned nothing), Supabase's examples I found pin versions from 2023 to 2024, and the
SDK adds weight and a moving target for three small calls. **Unverified:** I have not run any of this against
Stripe; see section 12. If you prefer the SDK later, only `_shared/stripe.ts` and the signature function change.

## 2. Selling in the iOS and Android apps (Capacitor)

**What the rules say (primary sources):**

- **Apple, App Review Guidelines** (https://developer.apple.com/app-store/review/guidelines/, I read the live text on 2026-10-12; the fetched copy carried no "last updated" date and was cut off after section 5.3):
  - 3.1.1: to unlock features or functionality (the guideline lists subscriptions and premium content) you must use in-app purchase, and apps may not use their own mechanisms to unlock content.
  - 3.1.1(a): developers may apply for entitlements to link to their own website to buy digital content or services. "These entitlements are not required for developers to include buttons, external links, or other calls to action in their United States storefront apps." Outside the US storefront, apps and their metadata may not include buttons, external links or other calls to action that direct customers to purchasing mechanisms other than in-app purchase.
  - 3.1.3(a) "Reader" apps may offer free account creation and account management for existing customers, with an informational link (outside the US storefront that needs the External Link Account Entitlement). Reader apps are for content such as media; **I could not confirm that a health tracker qualifies**, so I do not rely on it.
  - 3.1.3(b) Multiplatform services: users may access subscriptions or features "acquired in your app on other platforms or your web site ... provided those items are also available as in-app purchases within the app." **This is the real risk for us:** if the app unlocks features that were bought on the web, Apple may require the same items to be sold by in-app purchase too.
  - 3.1.3(f): free stand-alone companion apps to a paid web tool need no in-app purchase "provided there is no purchasing inside the app, or calls to action for purchase outside of the app." Examples given are VoIP, cloud storage, email, hosting. Whether our app fits is a judgment call, not stated.
- **US court rulings (secondary sources, not Apple or a court's own page):** the Ninth Circuit largely upheld the order that lets US-storefront apps link to web purchases, and sent the commission question back to the trial court; the Supreme Court granted review in June 2026 on the narrow contempt question only; reports as of 2026-10 say US link-outs are currently allowed with no commission, with one report saying otherwise. Sources: https://www.fenwick.com/insights/publications/ninth-circuit-largely-upholds-ruling-in-epic-v-apple , https://macdailynews.com/2026/08/14/u-s-supreme-court-clears-path-for-app-store-commission-showdown-as-apple-must-defend-its-rates-in-lower-court/ . **Treat as unverified and moving.** This only affects the US storefront. Our users are also in Canada, India, the UAE and Germany, where the strict rule applies.
- **Google Play Payments policy** (https://support.google.com/googleplay/android-developer/answer/10281818): Play billing is required for in-app purchases of digital goods and services, including subscriptions and cloud services. In the app, developers generally may not direct people to non-Play payment methods by link or purchase-encouraging language (programs exist for the US under a court order, the EEA, India and South Korea). Consumption-only ("reader style") apps are allowed: a person can log in and use content bought elsewhere, but **nothing can be purchased from within** such an app. Links to account management, privacy and help pages are allowed if they do not lead to a prohibited payment.

**What a Capacitor build may show (my reading, v1):**

| Allowed | Not allowed |
|---|---|
| The person's plan in plain words ("Free for everyone 60 and over", "Free while we are in beta") | A "Subscribe" or "Choose this plan" button |
| The plain sentence "Manage your plan on buildyourpillars.com" as text, with no link and no price | Any price ($2.99, $34.99) or purchase wording |
| Everything free (60+, and everyone during the beta) | A link or button that opens Stripe or a web checkout (outside the US storefront; unverified even inside it) |
| Using an account that was set up on the web | A caregiver "buy" button |

**Recommendation for v1: web checkout only.** People buy at buildyourpillars.com. The native apps show the plan
as text and the sentence "Manage your plan on buildyourpillars.com". This is already what the code does
(`isNativeApp()` hides every price and button; tests prove it). Why: it is the only option that is the same in every
country and needs no entitlement, no in-app-purchase product, and no change to what we tell Apple and Google.

**Honest risk to decide before billing goes live (not before the beta):** with billing on, an under-60 person or a
caregiver who bought on the web and then signs into the iOS app unlocks features without in-app purchase. Under 3.1.3(b)
Apple may ask for in-app purchase as well. Options when that day comes: (a) keep the iOS app fully free and make the web the
only place paid features exist (the paid features are caregiver viewing, which is a shared view; decide if viewing on iOS is
allowed), (b) use the US-storefront link-out, (c) add in-app purchase for iOS and Android (Apple and Google take a
share; that is not built). **During the beta none of this applies, because nothing is unlocked by payment.** Mention in
App Review notes that the app is free to use and that accounts and plans are managed on the website.

Cannot be confirmed from primary sources, so unverified: the exact current US ruling status; whether the plain sentence
without a link counts as a "call to action" in non-US storefronts (it names a website but offers no purchase); whether
a wellness tracker qualifies as a reader app.

## 3. Tax and currency (decide, do not guess)

- **Stripe Tax supports all five places as customer locations** (US, Canada, Germany, UAE; India for digital products only, IGST, and the business itself cannot be based in India). Source: https://docs.stripe.com/tax/supported-countries . Stripe Tax calculates and collects; it does **not** register you or file for you. Registration is a separate step in each place, and rules about when you must register depend on how much you sell there. I am not a tax adviser; please ask yours.
- **Recommendation:** turn Stripe Tax **on** from the first live sale, and add each place only when your accountant says you must collect there. In the Stripe dashboard (Tax > Registrations) you add a place only once you are registered. Where you have not added a registration, Stripe does not charge tax there. This keeps the prices honest ($2.99 plus tax where required) without guessing thresholds. Cost: Stripe charges a fee for Stripe Tax; check the current price on stripe.com/tax (I did not verify it).
- **Decisions you must make:** (1) are prices tax-inclusive or tax-added? Stripe lets you set it per Price (`tax_behavior`). Germany and the UAE customers usually expect tax-inclusive prices; US and Canada customers usually expect tax added. (2) Which place do you register in first? (3) Which legal entity sells (this decides the Stripe account country and many tax questions)? (4) Currencies: USD only to start. Charging a person in Germany in US dollars works but their bank adds a foreign-exchange fee; add EUR, CAD, INR and AED prices later by adding currency options to the same Price (dashboard: Price > Add currency). Checkout also has an "Adaptive Pricing" option (shows local currency; check current terms before using it).
- India has additional rules for card subscriptions (the card network requires a customer approval for recurring charges). I did not verify the current rules: **unverified**, test with an Indian card early.
- The code supports tax already: with `STRIPE_TAX_ENABLED=true` Checkout collects the billing address and turns on automatic tax. Nothing else changes.

## 4. What was built (this branch)

| File | What |
|---|---|
| `supabase/migrations/0018_billing.sql` | `app_settings` (`billing_enforced` false), `customers`, `subscriptions`, `stripe_events`, functions `plan_from_birth`, `plan_for` (server only), `subscription_grants_access`, `my_entitlement()`, `viewer_may_view(owner)`, `profile_birth_needed()` |
| `supabase/tests/billing_test_after_0018.sql` | Rolled-back test. Run against a scratch Postgres with a stub `auth` schema it printed `RESULT ALL PASS` (47 values, with a control for each rule). **Run it on the real database after applying 0018.** |
| `supabase/functions/_shared/stripeCore.ts` (+ `.test.ts`) | Pure logic: signature check, who may buy what, event mapping, form encoding. 23 tests. |
| `supabase/functions/_shared/stripe.ts` | Deno helpers: Stripe REST call, signed-in user, service client |
| `supabase/functions/create-checkout/index.ts` | Starts Checkout |
| `supabase/functions/billing-portal/index.ts` | Customer Portal link |
| `supabase/functions/stripe-webhook/index.ts` | Receives Stripe events |
| `src/lib/billing.ts` (+ test) | Prices, wording, which button to show, native detection. 24 tests. |
| `src/lib/billingClient.ts` | Hook `useBilling()` and the two calls to the functions |
| `src/pages/Plan.tsx` | Route `/plan`, "Your plan" |
| `src/components/CaregiverPlanCard.tsx` | Supporter-side card |
| `src/components/BirthPrompt.tsx` | Month and year of birth for legacy accounts |
| `src/lib/signup.ts` | **Not part of this branch.** It exists on the main checkout (uncommitted there). I copied it only so tests and the build run here and did not commit it. The files above import `validateBirth`, `MONTHS` and `birthYearOptions` from it. |

How the pieces behave:

- **Who gets what.** `plan_for` computes age exactly like `ageFrom` in `signup.ts` (whole years by calendar month; a person counts as 60 from the start of their 60th birth month). Test: born this month 60 years ago = free; one month short = standard; no birth data = unknown.
- **Beta.** While `billing_enforced` is false: `my_entitlement()` says everyone has everything, `viewer_may_view()` says yes, and `create-checkout` refuses to start a charge when the Stripe key is a live key (`sk_live_`). A **test** key still works so you can test during the beta.
- **Checkout rules, enforced by the server** (`decideCheckout`, tested): a person aged 60 or over cannot buy the monthly plan; a person with no birth data must give it first; the caregiver plan needs an active accepted care share where they are the viewer; nobody can buy a plan they already have. The Price id comes from the environment, the redirect addresses are fixed on https://buildyourpillars.com, and the Stripe call carries an idempotency key per person, plan and day.
- **Privacy.** Stripe gets the person's email (needed for receipts) and a random user id. The caregiver subscription deliberately does **not** record which older person it is for. No notes, feelings or health data go to Stripe. Stripe becomes a processor: add it to the privacy policy (section 9).

## 5. Legacy accounts (no birth month and year)

Accounts made before sign-up asked for birth data have `plan = 'unknown'`.

- **During the beta:** treated as free; everything works.
- **At next login:** `profile_birth_needed()` is true, and the app should show `BirthPrompt` (month and year only; it refuses under 16 using the same `validateBirth` as sign-up).
- **After billing is on:** an `unknown` person has `status = 'needs_birth'` and no paid features until they answer, so nobody under 60 can avoid the plan by never answering, and nobody over 60 is charged (the monthly checkout is refused for `unknown` until they give their birth data). You may prefer to keep them free forever instead; that is a one-line change in `my_entitlement`.
- Age is self-declared; there are no ID checks. A person could enter a false year to get free access; that is the rule you chose.

## 6. Mount points (where the main session wires the UI)

1. `src/App.tsx`: inside the protected `AppLayout` route, add `<Route path="/plan" element={<Plan />} />` (import `./pages/Plan`).
2. Navigation: a link "Your plan" to `/plan` in `src/components/AppLayout.tsx` or in Settings (text only, no badge).
3. `src/pages/Following.tsx` or `FollowingPerson.tsx` (supporter side): render `<CaregiverPlanCard name={ownerName} />` near the top, only for an active share.
4. Legacy accounts: in `src/pages/Dashboard.tsx` (or `AppLayout`) when `profile_birth_needed()` is true, render `<BirthPrompt />`. The simplest version: the Plan page already shows it when needed, so a calm link to `/plan` is enough for v1.

## 7. Wiring the care-sharing functions after 0015 is applied (not done: another agent owns them)

Only a caregiver with a paid caregiver plan may VIEW a shared pillar view. The one-line check, to add at the top of
`shared_days`, `shared_week_summary` and `shared_goals` (and anything else that returns an owner's data to a viewer),
after the existing "is this viewer allowed" check and before any data is returned:

```sql
-- inside each viewer-facing function body, right after the share lookup (s is the care_shares row):
if not public.viewer_may_view(p_owner) then return; end if;   -- plpgsql functions that return a table
```

For a `language sql` function add `and public.viewer_may_view(p_owner)` to the `where` clause. Behaviour:
billing off: always true (no change); billing on: true only for a viewer with an active or trialing
`caregiver_yearly` subscription whose period has not ended. `followed_people()` should **keep listing** the people, so the
supporter can still see the "Anna has said yes" card and buy the plan; only the data is withheld. After wiring, add a
control case to `care_sharing_v2_test_after_0015.sql`: with billing on and no caregiver row, the viewer gets 0 rows; with a
caregiver row, the usual rows.

Statuses and access (`subscription_grants_access`): `active` and `trialing` count. `past_due`, `unpaid`, `canceled`,
`incomplete`, `incomplete_expired`, `paused` do not. Stripe's advice is to notify at `past_due` and revoke at `canceled` or
`unpaid` (https://docs.stripe.com/billing/subscriptions/webhooks). I chose the stricter rule because it is one clear
sentence; **decision 2:** you may prefer to keep access during `past_due` (Stripe retries for days) so that a stalled card never
cuts off someone's view of a parent. If so, change `subscription_grants_access` to also accept `past_due`. In Stripe,
set Settings > Billing > Subscriptions and emails > "Manage failed payments" for retry timing and what happens at the end.

## 8. Deploying (for Miah's main session; nothing here has been run)

Order matters: apply SQL, set secrets, deploy functions, then the Stripe webhook, then wire the UI.

1. Apply `0018_billing.sql` (after 0015 and 0016 are in), then run `billing_test_after_0018.sql` and expect `RESULT ALL PASS`.
2. Set secrets (names only; values come from the Stripe dashboard, never into chat or the repo):
   `STRIPE_SECRET_KEY` (a **test** key, `sk_test_...` or a restricted `rk_test_...` key with write access to Checkout Sessions, Customers, Billing Portal Sessions and read access to Subscriptions),
   `STRIPE_WEBHOOK_SECRET` (`whsec_...`),
   `STRIPE_PRICE_STANDARD_MONTHLY`, `STRIPE_PRICE_CAREGIVER_YEARLY` (the `price_...` ids),
   optional `STRIPE_TAX_ENABLED` (`true`), optional `STRIPE_API_VERSION` (to override the pinned version).
   `supabase secrets set NAME=value` for each. A publishable key is **not** needed (hosted Checkout).
3. Deploy: `supabase functions deploy create-checkout`, `supabase functions deploy billing-portal`,
   `supabase functions deploy stripe-webhook --no-verify-jwt` (Stripe sends no Supabase token; the signature is the gate).
   The `_shared` folder is bundled automatically with each function.
4. The webhook URL is `https://gzsawayrorlcjmpssalc.supabase.co/functions/v1/stripe-webhook`.

## 9. What Miah does in Stripe (test mode first)

Work in a **sandbox / test mode** account until section 11 is done. Create the Stripe account yourself; do not share keys in chat.

1. **Account.** Create the Stripe account (business details, legal entity, bank). You can use test mode before it is fully activated.
2. **Products and Prices** (Product catalog > Add product), USD:
   - Product "Build Your Pillars" (name shown on receipts): Price **$2.99**, recurring, **monthly**. Internal nickname `standard_monthly`. Copy the `price_...` id into `STRIPE_PRICE_STANDARD_MONTHLY`.
   - Product "Build Your Pillars caregiver plan": Price **$34.99**, recurring, **yearly**. Nickname `caregiver_yearly`. Copy the id into `STRIPE_PRICE_CAREGIVER_YEARLY`.
   - Set the tax behavior on each Price (inclusive or exclusive) if you will use Stripe Tax (section 3).
3. **Webhook.** Developers > Webhooks (Workbench) > Create an event destination > Your account > **Snapshot** payload (the code reads full event objects) > API version `2026-09-30.endive` (the same as in the code) > select exactly these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` > destination type Webhook endpoint > the URL from section 8. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
4. **Customer Portal** (Settings > Billing > Customer portal): turn on: update payment method, view invoice history, **cancel subscriptions** (choose "at the end of the billing period"), and show your Terms and Privacy links. Leave plan switching **off** (one plan per product; the app decides who may buy). Set the business information and the return/redirect to `https://buildyourpillars.com/plan`.
5. **Emails** (Settings > Billing > Subscriptions and emails): turn on receipts and failed-payment emails and "upcoming renewal" reminders. These emails come from Stripe, which keeps our code from sending any.
6. **Retries** (same page): choose Smart Retries and decide what happens when retries run out (cancel the subscription is the simplest; see decision 2).
7. **Stripe Tax:** decide (section 3). If yes: Tax > turn on, set your head-office address and product tax code ("Software as a service" or the digital-services code Stripe suggests), and add registrations only where your accountant says to collect.
8. **Go live later:** repeat steps 2 to 5 in live mode (live Prices have different ids; the live webhook has a different secret), put the live values into the secrets, then flip the switch (section 12).

**Terms and Privacy copy to change when billing goes live (you edit the words; these are the places):**

- `src/pages/Terms.tsx` lines 55 to 59, section "What it costs": already states $2.99, $34.99, beta and cancel-any-time. Still needed: the refund rule (section 10), when a charge takes effect, taxes ("prices include or exclude tax"), what happens when a payment fails, who the seller is, and that plans are managed on the website. Line 59 has a `LEGAL REVIEW` marker for exactly this.
- `src/pages/Privacy.tsx`: add **Stripe** to "Who else handles your data" (around lines 191 to 217) with what Stripe receives (email address, a random account id, payment details typed on Stripe's own page, which we never see or store), and add payment records to "What we collect and why" (around line 92 to 128) and "How long we keep it" (around line 233 to 240): Stripe must keep invoices and payment records for tax law even after you delete your account; say how long (ask your accountant). Also the statement "We do not sell your data..." stays true. Confirm a Stripe data processing agreement is accepted in the dashboard (Settings > Compliance).
- `src/pages/Landing.tsx` lines 143 to 155 (the three plan cards) and line 29 ("No ads, ever. Free for everyone 60 and over."): already say $2.99 and "Free while we are in beta". Remove "Free while we are in beta" from the $2.99 card on the day billing starts.
- `src/pages/Why.tsx` line 27 and `src/lib/about.ts` line 4: "free for everyone 60 and over" stays true; check they do not imply everything is free for everyone.
- `docs/agetech-application-draft.md` line 15 and `docs/gdpr-compliance.md` (line 113: "Legal obligations (tax records) ... Only if payments are added" now applies, add Stripe as a recipient and a payment-records retention row).
- The **delete account** function (`0012_delete_my_account.sql`) removes our rows (the new tables cascade) but **does not delete the Stripe customer**. Before launch, either add a step (an edge function that calls `DELETE /v1/customers/{id}` and cancels subscriptions) or state in the privacy policy that Stripe keeps payment records. I did not build this; it also matters for Apple guideline 5.1.1(v).

## 10. Refund and cancellation decisions (yours)

Not decided in the code. Please choose, then write it in Terms:

1. **Cancellation:** at the end of the paid period (my recommended default, and the portal setting in step 4) or immediately with a part refund?
2. **Refunds:** no refunds / a short window (for example 14 days, simple and kind) / pro-rata. Germany and the EU give consumers a withdrawal right for digital services unless they agree to start immediately and lose it (confirm with a lawyer; I did not verify this).
3. **Yearly caregiver plan:** if the older person ends sharing the next day, does the caregiver get a refund? (The caregiver then has no one to view.) A simple rule: a full refund within 30 days if sharing ended; none after.
4. **Failed payments:** how many retries and how long before access ends (decision 2).
5. **Disputes and refunds in Stripe** are not handled automatically by the code: a refund in the dashboard does not cancel the subscription. After refunding, also cancel the subscription in the dashboard. (Stripe lists `charge.refunded` and `charge.dispute.created` as events worth handling later.)
6. **Price changes:** the promise "we will tell you before any charge begins" (Terms line 58) needs a process: who writes to the beta users, how many days before.

## 11. Test plan (Stripe sandbox, test keys)

Prepare: sections 8 and 9 in test mode, billing still off. Use two or three throwaway accounts you control (never real people).

1. **Beta is truly free.** With `billing_enforced = false`: the Plan page says free while we are in beta, no button. Open a shared view as a caregiver with no plan: it works. Calling `create-checkout` with a **test** key still creates a Checkout (that is how you test); calling it with a live key must answer "not charging yet".
2. **Turn billing on in the test project only** (section 12). Under-60 account: Plan page shows "Your plan: $2.99 a month" and a button. Choose it, pay with `4242 4242 4242 4242`. Return to `/plan?checkout=success`; within a minute the plan reads active. Check the `subscriptions` row and the `stripe_events` row.
3. **Free person.** A 60+ account (born 60 years ago this month, the boundary): shows "Free for everyone 60 and over". Calling `create-checkout` with `standard_monthly` is refused. A person born one month later is charged normally.
4. **Caregiver.** A caregiver with no share cannot buy (403). After the elder accepts a share, the card says "You can follow {name} with a caregiver plan, $34.99 a year. {name} has already said yes." Buy it with the test card; the supporter view then opens. Elder's own plan does not change.
5. **Declines and 3D Secure:** `4000 0000 0000 0002` (declined, nothing created), `4000 0027 6000 3184` (authentication window, then success).
6. **Test clocks** (Billing > Test clocks, in the sandbox): create a clock, create a customer on it, subscribe with `4000 0000 0000 0341` (attaches fine, later charges fail). Advance one month. Expect `invoice.payment_failed` then the subscription going `past_due`; confirm the Plan page says "Your last payment did not go through. No problem." and access follows decision 2. Advance past the retries: the subscription cancels and access ends. Repeat with `4242...` and advance a year: renewal succeeds, `current_period_end` moves forward.
7. **Cancel in the portal.** Open "Manage or cancel my plan", cancel at period end: the page says the plan is set to end on the date, and everything still works until then. Advance the clock past the date: access ends.
8. **Webhook safety.** In the Stripe CLI (`stripe listen`/`stripe trigger`) or the dashboard "Resend": resend the same event twice (second is ignored, one row); send a request with a wrong secret or an old timestamp (400); send an unknown type (200, nothing written). Out of order: resend an old `customer.subscription.updated` after a newer one: the row still shows the latest state, because the function re-reads Stripe.
9. **Native.** Run the Capacitor shell: the Plan page shows no price, no button, no link, only "Manage your plan on buildyourpillars.com" (when billing is on).
10. **Legacy account.** An account with no birth data: during the beta, a prompt appears; after billing is on it is stuck at "needs birth" until it answers; under 16 is refused.

## 12. Flipping the switch, and what is unverified

**Turn billing on** (database owner / SQL editor only; clients cannot write this table):

```sql
update public.app_settings set value = 'true'::jsonb, updated_at = now() where key = 'billing_enforced';
```

Turn it off again the same way with `'false'`. It takes effect at once, because every check reads it live. Before
switching it on in production: live Prices and live webhook in place, Terms and Privacy updated (section 9), refund
rules chosen (section 10), the beta users told (Terms line 58 promises it), and the iOS decision in section 2 made.

**Unverified (I could not run or confirm these):**

- Nothing was run against Stripe (no account or keys). The Stripe REST calls, parameter names, the nested form encoding, the
  webhook flow and the shape of `current_period_end` on subscription items (newer API versions moved it from the
  subscription to its items; the code reads both) are written from the official docs, not exercised. **First real test:
  section 11, items 2 and 8.**
- The Edge Functions and `_shared` imports were not run in Deno or deployed. `stripeCore.ts` (pure logic) is tested in vitest.
- The SQL passed my scratch Postgres test with a stub `auth` schema, not the real Supabase project. Run the test file on the real project after applying.
- `stripe` npm package current version (not needed, no SDK); Stripe Tax pricing; the current US Apple link-out status (secondary sources only); whether Apple counts the plain "Manage your plan on buildyourpillars.com" sentence as a call to action outside the US; Indian recurring-card rules; EU withdrawal-right details.
- Apple page text was read through section 5.3 only (the fetch was cut off); nothing later affects billing as far as I can tell.
- The `current_date` in the database is UTC, so a person born in a month is counted from the first of that month in UTC.
