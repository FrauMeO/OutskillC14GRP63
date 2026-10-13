# Caregiver Feature Brief — Build Your Pillars

For: Claude agents building the caregiver feature
Prepared: October 12, 2026
Based on: a review of the live app (demo account, msolmsted+demo) and current AARP/OATS research

---

## 1. Product context (what already exists)

Build Your Pillars is a habit and well-being tracker for older adults built around four pillars: **Eat, Sleep, Move, Balance**. Tagline: "Build your pillars of health. Live Well." / "p.s. judge yourself a lot less."

Current sections:

| Section | What it does |
|---|---|
| Dashboard | Today vs. goals per pillar, last 7 days charts, local weather/air quality/daylight, on-demand AI reflection ("Coach me on my week") |
| Log habits | Mood (5-point), energy, stress, feelings chips (incl. Lonely, Overwhelmed, Anxious), exercise, steps, sleep, water, notes; calendar back-fill |
| Goals | One daily target per habit (demo: 10,000 steps, 7.5 h sleep, 2 L water) |
| Insights | Weather-vs-habit correlations with multiple-comparison checking ("Likely patterns" vs. "Worth exploring"); explicitly "not what causes what" |
| Settings | Name, home city (location rounded to ~11 km), daily reflection toggle, gentle check-ins (offered after 10+ harder days, max once per 14 days, "Only you can see your answers"), delete reflection history, download all data / spreadsheet |

Demo data: one year (365 logged days) of the co-founder's anonymized Apple Health data.

### Design principles already in the product — the caregiver feature must keep these

1. **Non-judgmental tone.** "Rest days are part of the rhythm: any 4 logged days in seven make a full week." "Every one of them counts." No streak shaming, no red failure states.
2. **The user owns their data.** "Everything you have logged belongs to you." Export is one click.
3. **Radical transparency about AI.** Every AI surface states exactly what is sent to Claude (numbers, ratings, feelings, goals) and what is never sent (name, email, location, notes, reflection answers), and that nothing is saved.
4. **Correlation, not causation.** Insights are framed as "what tends to happen together," with "Something to try, if you like."
5. **Privacy by minimization.** Location rounded; check-in answers private to the user.

**Core rule for this feature: the caregiver view is an extension of the older adult's privacy promise, not an exception to it.** Today the app says "Only you can see your answers." Any sharing must be opt-in, granular, visible, and revocable by the older adult.

---

## 2. The market need

- About one in four adults 50+ are caregivers, yet this group has relatively low adoption of tools designed for caregiving. ([AgeTech Collaborative from AARP](https://home.agetechcollaborative.org/startup/blogs/mark-ogilbee/2025/01/23/agetech-and-beyond-how-technology-is-shaping-life?hlmlt=BL))
- A survey of 350+ caregivers found the digital tools they rely on most (patient portals, insurance sites) can add to their stress; practical tech support is a key need. ([OATS from AARP, "Caring for Caregivers"](https://oats.org/press-release-caring-for-caregivers/))
- Data privacy is the top barrier to tech adoption for adults 50+ (about one-third), followed by ease of use (20%), setup and support (19%), cost (16%), awareness (12%). ([AARP](https://www.aarp.org/pri/topics/technology/internet-media-devices/2025-technology-trends-older-adults/))
- 3 in 5 adults 50+ say technology is not built for their age group. ([AARP PRI](https://www.linkedin.com/posts/aarp-pri_tech-techtrends-technology-activity-7421563327115403265-YCSr)) Among those 80+, only 48% feel they have the needed digital skills. ([Aging and Health Technology Watch](https://www.ageinplacetech.com/blog/aarp-2026-tech-trends-what-difference-decade-makes))
- Families increasingly use AI to monitor aging parents at home, and the privacy tradeoff is a live public concern. ([The News Tribune](https://www.thenewstribune.com/living/article317430217.html))
- 89% of adults 50+ rank aging in place as important. ([AARP/CTA](https://www.aarp.org/pri/topics/technology/internet-media-devices/aging-technology-agetech/))

**Positioning implication:** most caregiver tools are surveillance-first. Build Your Pillars can differentiate as **connection-first and consent-first**: the older adult invites support, rather than being monitored.

---

## 3. Users and jobs to be done

**Primary: the older adult (account owner)**
- "I want my daughter to know I'm okay without her calling to check every day."
- "I want to choose what she sees, and stop sharing whenever I want."
- "I don't want to feel watched or judged."

**Secondary: the caregiver (invited supporter)** — adult child, spouse, friend, paid aide
- "Tell me if something has changed, not every number."
- "Give me something useful to bring to a doctor's appointment."
- "Help me support without nagging."

**Note:** many users are both. A 60-year-old may track her own pillars while caring for an 85-year-old parent. Support one account being both an owner and a supporter.

---

## 4. Requirements

### Must have (MVP)

1. **Invite flow, owned by the older adult.** Owner sends an invite by email or link; the supporter creates their own login. No caregiver-initiated access requests that the owner can't easily decline.
2. **Granular sharing, per pillar and per data type.** Defaults: OFF for everything. Owner toggles: Eat / Sleep / Move / Balance, and separately: mood, feelings, notes. **Notes and gentle check-in answers are never shareable** (consistent with current promises).
3. **Sharing levels:**
   - "Just that I'm logging" (a simple "checked in today" signal) — suggest this as the gentle starting point
   - "Weekly summary" (pillar-level, trend words, not raw numbers)
   - "Full detail" for selected pillars
4. **Plain-language consent screen** showing exactly what the supporter will and won't see, with a preview of the supporter's view. Mirror the style of the existing Claude disclosure.
5. **Always-visible sharing indicator** for the owner (e.g., "Shared with: Anna — Sleep, Move") on Dashboard and Settings, with one-tap "Pause sharing" and "Stop sharing."
6. **Revocation is instant and silent-safe.** Stopping sharing should not send the supporter an alarming message; a neutral "sharing settings changed" at most.
7. **Read-only supporter view.** Supporters cannot edit logs, goals, or settings.
8. **Same tone rules for supporters.** No red alerts for missed days. Use the existing "4 of 7 days is a full week" framing.

### Should have

9. **Gentle change notices (opt-in by the owner):** e.g., "Sleep has been lower than usual for about a week." Use the existing Insights statistics (compare to the person's own baseline, minimum data thresholds). Never diagnose.
10. **"Thinking of you" nudge:** supporter can send a one-tap warm message ("Thinking of you", "Want to take a walk?"). This turns data into connection. Ties to the Balance pillar's Lonely feeling chip.
11. **Appointment summary:** owner-generated printable/PDF one-pager of the last 30/90 days by pillar for doctor visits, which the owner can share with a supporter. Addresses the "portals add stress" finding.
12. **Supporter digest by email** (weekly), for supporters who won't open an app.

### Could have (later)

13. Multiple supporters with different access levels.
14. Shared calendar of appointments / medication reminders (check scope against medical-device and HIPAA considerations first).
15. Paid-aide role with time-limited access.
16. AI "supporter coach": tips for the caregiver on how to support well, using only data the owner has shared. Must follow the same disclosure pattern as the current reflection feature.

### Won't have (explicitly out of scope)

- Covert monitoring, location tracking of the owner, or supporter access without owner consent.
- Emergency/fall detection claims (the app is not a medical alert device).
- Sharing of notes, reflection answers, or gentle check-in responses.

---

## 5. Safety and edge cases

- **Low mood / distress signals:** if the owner logs sustained hard days, the supporter should not receive an alarming alert unless the owner pre-chose that. Offer the owner (not the supporter) resources first. Include crisis resources (988 Suicide & Crisis Lifeline in the US) in the owner's gentle check-in flow if not already present.
- **Coercion / elder abuse risk:** a supporter could pressure the owner to share. Keep revocation easy, private, and without notification drama. Consider a periodic "Are you still happy sharing with Anna?" prompt (e.g., every 90 days).
- **Cognitive decline / proxy accounts:** some caregivers will manage the account on behalf of the person. Treat as a separate, later "managed account" mode with clear labelling; don't blur it into MVP.
- **Account deletion:** deleting the owner account removes all supporter access immediately.
- **Data export:** include sharing history (who had access to what, when) in "Download all my data."

---

## 6. Accessibility requirements (both roles)

- Minimum 18 px body text in the supporter view; scalable to 200% without layout breakage.
- WCAG 2.2 AA contrast; don't rely on colour alone for trend states.
- Large tap targets (at least 44×44 px).
- Plain language, about 6th–8th grade reading level; no jargon like "permissions" or "sync" without explanation.
- Invite and acceptance flows must work entirely by email link for supporters who won't install an app.
- Consider passwordless sign-in (email code/magic link) for supporters, since forgotten passwords are a major drop-off point.

---

## 7. Data and privacy model (suggested)

- `care_relationships`: owner_id, supporter_id, status (invited/active/paused/revoked), created_at, revoked_at
- `share_scopes`: relationship_id, pillar, data_type, level (presence/summary/detail)
- `share_audit_log`: every grant, change, revoke, and supporter view (visible to owner)
- Enforce scopes server-side (row-level security), not just in UI.
- If supporter-facing AI summaries are added, send only in-scope fields, and state that on screen.

---

## 8. Success metrics

- % of active owners who invite at least one supporter
- % of invites accepted within 7 days
- Owner retention (30/90-day) for those with vs. without a supporter
- Sharing revocations and pauses (watch for spikes: may mean the feature feels invasive)
- "Thinking of you" messages sent per active relationship per week
- Qualitative: owner agrees "I feel supported, not watched" (target 80%+ in user testing)

---

## 9. Validation before full build

- Test the consent screen and supporter preview with 5 older adults (include 2 aged 80+) and 5 caregivers.
- Key question to answer: what is the default sharing level owners are comfortable with?
- The [AgeTech Collaborative from AARP](https://www.aarp.org/personal-technology/technology-older-adults-aarp-ceo/) offers testing opportunities with older adults.

---

## 10. Observations from the app review relevant to this work

- Gentle check-ins currently promise "Only you can see your answers." Keep that promise unchanged.
- The AI reflection disclosure is a strong pattern; reuse it for any supporter-facing AI.
- No Apple Health connection was visible in Settings during the review, even though the demo year comes from Apple Health data. If a live Apple Health sync is planned, decide early whether health-derived data (steps, sleep) is shareable with supporters under the same per-pillar scopes.
- The demo dashboard showed "Not logged" for the current week while Insights reported 365 logged days, so the demo data appears to end before today. For caregiver demos, extend the demo data to the current date so the supporter view isn't empty.
