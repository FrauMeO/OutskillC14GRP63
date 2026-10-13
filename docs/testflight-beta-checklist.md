# TestFlight and Play beta: checklist for getting the app onto testers' phones

Written 13 October 2026. Goal: beta testers install Build Your Pillars from a link, before any public store listing. Store listing comes later and is covered in `store-apps-plan.md`.

## Founders (Miah)
1. Confirm the Apple Developer membership under msolmsted@mac.com is active (developer.apple.com/account, Membership page: expiry date, Individual or Organization). Renew if lapsed.
2. On this Mac: `sudo xcodebuild -license accept`, open Xcode once, accept the iOS component install, then Xcode > Settings > Accounts > add msolmsted@mac.com.
3. Confirm the bundle ID `com.buildyourpillars.app` (or give the one already in App Store Connect). Cannot change after first upload.
4. Give the GitHub token `workflow` scope (or move `docs/mobile/workflows/*.yml` into `.github/workflows/` by hand) and set repository Variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only).
5. Decide: ship the first beta without Health import (faster; reminder and offline are the native features) or with it (adds Apple's HealthKit review). Recommendation: without, for the first TestFlight round.
6. Google Play: ask Play support whether a wellness tracker must use an Organization account before paying; keep the reply. Android beta waits on this and on a Java/Android Studio install or the cloud workflow.

## Engineering (Claude Code, after items 1 and 2)
7. `npm run build && npx cap sync ios`, then compile for the simulator with xcodebuild; fix what breaks; run in the simulator panel.
8. Mount `NativeShell` and `ReminderSetting` (written, not yet mounted per mobile-build.md section 4); add the in-app privacy link and the AI opt-in screen if not already present in the mobile shell.
9. Create the App Store Connect app record with the bundle ID; archive and upload a build with Xcode signed by the team; add the demo reviewer account to TestFlight notes.
10. Internal TestFlight (team only, no review) to check install on Miah's and Bob's phones. Then external TestFlight group "Beta testers": needs Apple's Beta App Review (usually a day or two); testers get an email or public link and install TestFlight first.
11. Android: Play internal testing track once the account exists; upload an AAB signed with the upload keystore (make it once, back it up twice).

## Tester-facing text (draft, count-and-age rule applies)
"Build Your Pillars is a gentle, private tracker for adults 50 and over. The web version has been tested with more than a dozen adults aged 60 and over, and the phone app is the same app in a shell you can install. Tap the link, install TestFlight if asked, then install Build Your Pillars. Free during the beta. Tell us what is unclear."
